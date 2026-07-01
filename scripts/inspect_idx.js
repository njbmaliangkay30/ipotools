const { chromium } = require('playwright');
const fs = require('fs');

async function inspectDropdown() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    await page.goto("https://www.idx.co.id/en/market-data/statistical-reports/new-listing-information/");
    await page.waitForTimeout(5000);
    
    // get all select elements and their options
    const selects = await page.$$eval('select', selects => {
        return selects.map(s => ({
            id: s.id,
            name: s.name,
            class: s.className,
            options: Array.from(s.options).map(o => ({ value: o.value, text: o.text }))
        }));
    });
    
    fs.writeFileSync('idx_selects.json', JSON.stringify(selects, null, 2));
    console.log("Saved select info");
    await browser.close();
}
inspectDropdown();
