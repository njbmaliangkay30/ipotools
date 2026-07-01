const { chromium } = require('playwright');
const pdf = require('pdf-parse');
const fs = require('fs');

async function downloadAndExtract() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to WBSA...");
  await page.goto("https://e-ipo.co.id/en/ipo/348/wbsa-pt-bsa-logistics-indonesia-tbk", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  let pdfUrl = null;
  const fullProspectusAnchor = page.locator('a[href*="get-propectus-file"]').filter({ has: page.locator('i.text-danger') });
  if (await fullProspectusAnchor.count() > 0) {
      const href = await fullProspectusAnchor.first().getAttribute("href");
      if (href) pdfUrl = new URL(href, "https://e-ipo.co.id").href;
  }

  console.log("PDF URL found:", pdfUrl);

  if (pdfUrl) {
    const base64Data = await page.evaluate(async (url) => {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }, pdfUrl);

    const base64Content = base64Data.split(',')[1];
    const dataBuffer = Buffer.from(base64Content, 'base64');
    console.log("Parsing PDF...");
    const pdfData = await pdf(dataBuffer);
    
    fs.writeFileSync("wbsa_prospectus.txt", pdfData.text);
    console.log("Saved WBSA prospectus text! Total length:", pdfData.text.length);
  }

  await browser.close();
}

downloadAndExtract();
