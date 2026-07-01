require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const { extractInsiderCost, extractUseOfProceeds } = require('../scripts/pdf_extractor_v2.js');

async function testLabs() {
  const dir = path.join(__dirname, '..', 'scratch', 'pdf');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, 'LABS.pdf');

  console.log('=== TEST LABS (id 284) ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // Navigasi ke halaman e-IPO untuk LABS
    const url = 'https://e-ipo.co.id/en/ipo/284/labs-pt-laboratorium-medika-tbk';
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

    // Uji ekstraksi
    const buf = fs.readFileSync(outPath);
    const parsed = await pdf(buf);
    
    console.log('\n--- Hasil Ekstraksi LABS ---');
    const cost = extractInsiderCost(parsed.text);
    console.log('Insider Cost:', cost ? `Rp ${cost}` : 'Not Found');

    const proceeds = extractUseOfProceeds(parsed.text);
    console.log('\nUse of Proceeds:');
    proceeds.forEach((item, idx) => {
      console.log(`  [${idx+1}] ${item.percentage}%: ${item.description}`);
    });

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

testLabs().catch(console.error);
