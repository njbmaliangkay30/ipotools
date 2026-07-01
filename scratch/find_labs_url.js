const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Scanning e-IPO for UBC Medical / LABS...');
  for (let pageNum = 1; pageNum <= 5; pageNum++) {
    const url = `https://e-ipo.co.id/en/ipo/index?page=${pageNum}&per-page=12`;
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const links = await page.locator('a[href*="/ipo/"]').all();
    for (const link of links) {
      const href = await link.getAttribute('href');
      const text = await link.innerText();
      if (href && (href.toLowerCase().includes('ubc') || href.toLowerCase().includes('labs') || text.toLowerCase().includes('ubc') || text.toLowerCase().includes('labs'))) {
        console.log(`FOUND: URL=${href} | Text="${text.trim()}"`);
      }
    }
  }
  await browser.close();
}

run().catch(console.error);
