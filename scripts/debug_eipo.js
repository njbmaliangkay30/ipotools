require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function debugParser() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    
    // Stealth
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        window.navigator.chrome = { runtime: {} };
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    });
    
    const page = await context.newPage();
    
    console.log("Navigating to index...");
    await page.goto('https://e-ipo.co.id/en/ipo/index', { waitUntil: "domcontentloaded", timeout: 45000 });
    
    await page.waitForTimeout(4000);
    const links = await page.$$eval('a[href*="/ipo/"]', anchors => anchors.map(a => a.href));
    
    console.log("Links found:", links.slice(0, 5));
    
    if (links.length > 0) {
        // filter valid ipo links
        const validLinks = links.filter(l => /\/ipo\/\d+\//.test(l));
        if (validLinks.length > 0) {
            console.log("Navigating to:", validLinks[0]);
            await page.goto(validLinks[0], { waitUntil: "domcontentloaded" });
            await page.waitForTimeout(2000);
            const text = await page.locator('#wrapper section:nth-child(2) div div div:nth-child(2), .container').first().innerText();
            console.log("\n\ninnerText:\n", text);
        }
    }
    
    await browser.close();
}

debugParser();
