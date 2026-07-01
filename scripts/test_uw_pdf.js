const { chromium } = require('playwright');
const pdf = require('pdf-parse');

async function testSingle() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  const page = await context.newPage();
  
  const detailUrl = "https://e-ipo.co.id/en/ipo/351/emmi-pt-esa-medika-mandiri-tb";
  await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  const pdfUrl = "https://e-ipo.co.id/en/pipeline/get-propectus-file?id=351&type=prospectus_aktif";
  const base64Data = await page.evaluate(async (url) => {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
      });
  }, pdfUrl);

  const base64Content = base64Data.split(',')[1];
  const buffer = Buffer.from(base64Content, 'base64');
  const pdfData = await pdf(buffer);
  const text = pdfData.text;
  const cleanText = text.replace(/\s+/g, ' ');

  // Search for underwriter terminology in PDF
  const terms = [
      /Penjamin\s+Pelaksana\s+Emisi/gi,
      /Penjamin\s+Emisi/gi
  ];

  console.log("\n--- Searching for underwriter terms in EMMI PDF ---");
  for (const regex of terms) {
      let match;
      console.log(`\nRegex: ${regex.source}`);
      let count = 0;
      while ((match = regex.exec(cleanText)) !== null && count < 5) {
          count++;
          console.log(`  Match ${count} at index ${match.index}:`);
          console.log(`  "${cleanText.substring(match.index - 50, match.index + 200)}"`);
      }
  }

  await browser.close();
}

testSingle();
