const { chromium } = require('playwright');
const fs = require('fs');

async function explore2025() {
    console.log("Membuka IDX untuk mencari dropdown tahun...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    await page.goto("https://www.idx.co.id/en/market-data/statistical-reports/new-listing-information/", { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(5000); 
    
    // Screenshot to see the layout
    await page.screenshot({ path: 'idx_dropdown.png', fullPage: true });
    console.log("Screenshot disimpan sebagai idx_dropdown.png");
    
    // Try to find any select elements or inputs that have 2026/2025
    const elements = await page.$$eval('select, input, button, [role="button"], .vgt-wrap *', els => {
        return els.map(el => {
            return {
                tag: el.tagName,
                text: el.textContent ? el.textContent.trim().substring(0, 50) : '',
                id: el.id,
                className: el.className,
                value: el.value || ''
            };
        }).filter(e => e.text.includes('2026') || e.value.includes('2026') || e.text.includes('2025') || e.text.includes('Year'));
    });
    
    fs.writeFileSync('idx_year_elements.json', JSON.stringify(elements, null, 2));
    console.log("Elemen UI disimpan ke idx_year_elements.json");
    
    await browser.close();
}

explore2025();
