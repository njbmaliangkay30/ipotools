require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');

async function test() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    await page.goto('https://e-ipo.co.id/en/ipo/354/rans-pt-rans-entertainmen-ind', { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    
    const content1 = await page.locator('.container').first().textContent();
    const content2 = await page.locator('main').first().textContent();
    const content3 = await page.locator('.table').first().textContent();
    const content4 = await page.locator('body').first().textContent();
    
    console.log("== CONTAINER ==");
    console.log(content1 ? content1.trim().split('\n').slice(0, 20).join('\n') : "null");
    
    await browser.close();
}

test();
