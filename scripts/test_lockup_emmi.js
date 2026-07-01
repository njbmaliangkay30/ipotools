const { chromium } = require('playwright');
const pdf = require('pdf-parse');

async function testSingle() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      javaScriptEnabled: true,
  });

  await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {} };
  });

  const page = await context.newPage();
  
  const detailUrl = "https://e-ipo.co.id/en/ipo/351/emmi-pt-esa-medika-mandiri-tb";
  console.log("Navigating to:", detailUrl);
  await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  const pdfUrl = "https://e-ipo.co.id/en/pipeline/get-propectus-file?id=351&type=prospectus_aktif";
  console.log("Downloading prospectus via page.evaluate...");
  
  const base64Data = await page.evaluate(async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
      });
  }, pdfUrl);

  const base64Content = base64Data.split(',')[1];
  const buffer = Buffer.from(base64Content, 'base64');
  
  console.log("Parsing PDF...");
  const pdfData = await pdf(buffer);
  const text = pdfData.text;
  const cleanText = text.replace(/\s+/g, ' ');

  // Test the segment regex WITHOUT POJK No. 25
  console.log("\n--- Testing lockupSegmentRegex WITHOUT POJK No. 25 ---");
  const lockupSegmentRegex = /(?:pembatasan\s+atas\s+saham|dilarang\s+untuk\s+mengalihkan|lock[- ]?up)[\s\S]{0,800}?(\d+)\s*(?:\([^)]*\)\s*)?bulan/gi;
  let matchLock;
  let matchesCount = 0;
  let bestMatch = null;
  while ((matchLock = lockupSegmentRegex.exec(cleanText)) !== null) {
      matchesCount++;
      const months = parseInt(matchLock[1], 10);
      console.log(`Match ${matchesCount}: months=${months}`);
      console.log(`Matched segment: "${matchLock[0].substring(0, 400)}..."`);
      if (months <= 12 && bestMatch === null) {
          bestMatch = months;
      }
  }
  console.log("Best match found:", bestMatch);

  await browser.close();
}

testSingle();
