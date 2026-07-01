const { chromium } = require('playwright');
const fs = require('fs');

async function getScreenshot() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to WBSA...");
  await page.goto("https://e-ipo.co.id/en/ipo/348/wbsa-pt-bsa-logistics-indonesia-tbk", { waitUntil: "networkidle" });
  
  // Ambil data text dari body untuk dianalisis
  const bodyText = await page.innerText('body');
  fs.writeFileSync("wbsa_page_text.txt", bodyText);
  console.log("Saved WBSA page text. Body length:", bodyText.length);

  // Ambil screenshot
  await page.screenshot({ path: "wbsa_screenshot.png", fullPage: true });
  console.log("Saved screenshot to wbsa_screenshot.png");

  // Cari semua link (a href)
  const links = await page.locator('a').all();
  const linkData = [];
  for (const link of links) {
    const text = await link.innerText();
    const href = await link.getAttribute('href');
    linkData.push({ text: text.trim(), href });
  }
  fs.writeFileSync("wbsa_links.json", JSON.stringify(linkData, null, 2));
  console.log("Saved links to wbsa_links.json");

  await browser.close();
}

getScreenshot();
