const { chromium } = require('playwright');
const fs = require('fs');

async function checkAPI() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();
    
    // go to main page to clear cloudflare
    await page.goto("https://www.idx.co.id/");
    await page.waitForTimeout(3000);
    
    // Evaluate fetch
    const data = await page.evaluate(async () => {
        try {
            const res = await fetch("https://idx.co.id/primary/StatisticalReport/GetNewListingInformation?year=2025");
            return await res.json();
        } catch(e) {
            return { error: e.message };
        }
    });
    
    fs.writeFileSync('idx_api_pdf_2025.json', JSON.stringify(data, null, 2));
    console.log("Saved API response");
    await browser.close();
}

checkAPI();
