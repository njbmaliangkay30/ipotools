const { chromium } = require('playwright');

async function testSingle() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      javaScriptEnabled: true,
  });

  await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {} };
  });

  const page = await context.newPage();
  
  const detailUrl = "https://e-ipo.co.id/en/ipo/349/jeli-pt-niramas-utama-tbk";
  console.log("Navigating to JELI:", detailUrl);
  await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  let content = "";
  try {
      content = await page.locator('#wrapper section:nth-child(2) div div div:nth-child(2)').first().innerText({ timeout: 5000 });
  } catch(e) {
      content = await page.locator('.container, main, body').first().innerText({ timeout: 5000 });
  }

  console.log("\n--- JELI Web Page Text Content ---");
  console.log(content);

  await browser.close();
}

testSingle();
