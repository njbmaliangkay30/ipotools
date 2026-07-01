const { chromium } = require('playwright');
const pdf = require('pdf-parse');

async function testPdf() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  await page.goto("https://e-ipo.co.id/id/ipo/index", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  
  const pdfUrl = "https://e-ipo.co.id/id/pipeline/get-propectus-file?id=349&type=summary";
  console.log("Fetching PDF via browser evaluate fetch...");
  
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
  await browser.close();
  
  console.log(`Buffer size: ${buffer.length} bytes`);
  
  console.log("Parsing PDF with pdf-parse...");
  const data = await pdf(buffer);
  const text = data.text;
  
  console.log(`PDF parsed, total text length: ${text.length}`);
  console.log("\nSearching for 392, 266, or dana in text...");
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("392") || lines[i].toLowerCase().includes("miliar") || lines[i].includes("266")) {
          console.log(`[L.${i}] ${lines[i].trim()}`);
      }
  }
}

testPdf();
