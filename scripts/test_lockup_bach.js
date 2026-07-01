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
  
  const detailUrl = "https://e-ipo.co.id/en/ipo/353/bach-pt-bach-multi-global-tbk";
  console.log("Navigating to:", detailUrl);
  await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  const pdfUrl = "https://e-ipo.co.id/en/pipeline/get-propectus-file?id=353&type=prospectus_aktif";
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

  // Let's search for "POJK" and print surrounding
  const regex = /POJK/gi;
  let match;
  console.log("\n--- Searching for POJK in cleanText ---");
  while ((match = regex.exec(cleanText)) !== null) {
      console.log(`\nFound POJK at index ${match.index}:`);
      console.log(cleanText.substring(match.index - 50, match.index + 200));
  }

  await browser.close();
}

testSingle();
