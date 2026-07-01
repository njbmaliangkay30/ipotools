require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { extractInsiderCost, extractUseOfProceeds } = require('../scripts/pdf_extractor_v2.js');

async function testSingle(ticker, id, url) {
  console.log(`\n=================== TEST ${ticker} (ID: ${id}) ===================`);
  const dir = path.join(__dirname, '..', 'scratch', 'pdf');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, `${ticker}.pdf`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const pdfLinks = await page.locator('a[href*="get-propectus-file"], a[href*="get-prop"]').all();
    let pdfUrl = null;
    for (const link of pdfLinks) {
      const href = await link.getAttribute('href');
      if (href) {
        pdfUrl = href.startsWith('http') ? href : `https://e-ipo.co.id${href}`;
        break;
      }
    }

    if (!pdfUrl) {
      console.log('PDF URL not found.');
      return;
    }

    console.log(`Downloading PDF: ${pdfUrl}`);
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.goto(pdfUrl).catch(() => {});
    const download = await downloadPromise;
    await download.saveAs(outPath);
    console.log(`PDF saved to ${outPath}`);

    const buf = fs.readFileSync(outPath);
    const parsed = await pdf(buf);
    
    const cost = extractInsiderCost(parsed.text);
    console.log('\n[→] Hasil Ekstraksi:');
    console.log('    Insider Cost:', cost ? `Rp ${cost}` : 'Not Found');

    const proceeds = extractUseOfProceeds(parsed.text);
    console.log('    Use of Proceeds:');
    if (proceeds.length === 0) {
      console.log('      [KOSONG]');
    } else {
      proceeds.forEach((item, idx) => {
        console.log(`      [${idx+1}] ${item.percentage}%: ${item.description}`);
      });
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

async function run() {
  // Test BACH (id 353)
  await testSingle('BACH', 353, 'https://e-ipo.co.id/en/ipo/353/bach-pt-bach-multi-global-tbk');
  // Test RANS (id 354)
  await testSingle('RANS', 354, 'https://e-ipo.co.id/en/ipo/354/rans-pt-rans-entertainmen-ind');
}

run().catch(console.error);
