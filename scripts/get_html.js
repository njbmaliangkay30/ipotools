const { chromium } = require('playwright');
const fs = require('fs');

async function getHtml() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent: "Mozilla/5.0" });
    const page = await context.newPage();
    
    await page.goto("https://www.idx.co.id/en/market-data/statistical-reports/new-listing-information/", { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);
    
    const html = await page.content();
    fs.writeFileSync('idx_page.html', html);
    console.log("Saved idx_page.html");
    await browser.close();
}
getHtml();
