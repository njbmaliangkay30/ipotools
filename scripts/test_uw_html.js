const { chromium } = require('playwright');

async function testSingle() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      javaScriptEnabled: true,
  });

  const page = await context.newPage();
  
  const detailUrl = "https://e-ipo.co.id/en/ipo/351/emmi-pt-esa-medika-mandiri-tb";
  console.log("Navigating to:", detailUrl);
  await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  let content = "";
  try {
      content = await page.locator('#wrapper section:nth-child(2) div div div:nth-child(2)').first().innerText({ timeout: 5000 });
  } catch(e) {
      content = await page.locator('.container, main, body').first().innerText({ timeout: 5000 });
  }

  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  const idx = lines.indexOf("Underwriter(s)");
  console.log("\n--- Underwriters and surrounding text on EMMI page ---");
  if (idx !== -1) {
      console.log(lines.slice(idx, idx + 10));
  } else {
      console.log("Could not find Underwriter(s) in lines.");
  }

  await browser.close();
}

testSingle();
