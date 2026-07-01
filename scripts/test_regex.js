require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const pdf = require('pdf-parse');

async function check() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Test PRDL PDF Text extraction manually
  // I will just download the PDF for JELI or PRDL
  const url = 'https://e-ipo.co.id/en/pipeline/get-propectus-file?id=350&type='; // PRDL
  await page.goto('https://e-ipo.co.id', { waitUntil: 'domcontentloaded' });
  const base64Data = await page.evaluate(async (url) => {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
      });
  }, url);

  const base64Content = base64Data.split(',')[1];
  const dataBuffer = Buffer.from(base64Content, 'base64');
  const pdfData = await pdf(dataBuffer);
  const text = pdfData.text;
  
  const permIndex = text.indexOf("Struktur Permodalan");
  let searchContext = permIndex !== -1 ? text.substring(permIndex, permIndex + 10000) : text;
  
  const insiderCostRegex = /Rp\s?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\,-\s?per\s?saham/i;
  const altInsiderCost = /Nilai\s*Nominal\s*Rp\s?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)/i;
  
  console.log("Context sample:\n", searchContext.substring(0, 500));
  
  let m1 = searchContext.match(insiderCostRegex);
  let m2 = text.match(insiderCostRegex);
  let m3 = text.match(altInsiderCost);
  
  console.log("Match 1:", m1 ? m1[0] : "null");
  console.log("Match 2:", m2 ? m2[0] : "null");
  console.log("Match 3:", m3 ? m3[0] : "null");
  
  await browser.close();
}

check();
