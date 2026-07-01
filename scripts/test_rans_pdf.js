const { chromium } = require('playwright');
const pdf = require('pdf-parse');

async function testSingle() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  const page = await context.newPage();
  
  const pdfUrl = "https://e-ipo.co.id/en/pipeline/get-propectus-file?id=353&type=prospectus_aktif";
  console.log("Downloading PDF from:", pdfUrl);
  
  await page.goto("https://e-ipo.co.id/en/ipo/index", { waitUntil: "domcontentloaded" });
  
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

  const regex = /RENCANA PENGGUNAAN DANA/gi;
  let match;
  console.log("\n--- Scanning all matches of RENCANA PENGGUNAAN DANA ---");
  while ((match = regex.exec(text)) !== null) {
      console.log(`\nMatch at index ${match.index}:`);
      console.log(`"${text.substring(match.index - 100, match.index + 300)}"`);
  }

  await browser.close();
}

testSingle();
