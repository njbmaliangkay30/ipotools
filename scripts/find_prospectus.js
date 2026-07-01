const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
  });
  
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();
  await page.goto('https://e-ipo.co.id/en/ipo/350/prdl-pt-prodia-diagnostic-lin', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  const links = await page.$$eval('a', anchors => anchors.map(a => a.outerHTML));
  console.log("All Links on page:");
  console.log(links.filter(html => html.toLowerCase().includes('pdf') || html.toLowerCase().includes('prospe')));
  
  await browser.close();
})();
