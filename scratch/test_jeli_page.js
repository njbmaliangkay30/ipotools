const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'id-ID'
  });
  const page = await context.newPage();
  await page.goto('https://e-ipo.co.id/id/ipo/349/jeli-pt-niramas-utama-tbk', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const text = await page.innerText('body');
  const lines = text.split('\n').map(d => d.trim()).filter(d => d);
  console.log("=== LINES 30 to 50 ===");
  for (let i = 30; i < Math.min(lines.length, 52); i++) {
    console.log(`${i}: ${lines[i]}`);
  }
  await browser.close();
})();
