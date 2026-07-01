require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

async function downloadAndExtract(ticker, pageUrl, outPath) {
  console.log(`\n=================== DOWNLOAD ${ticker} ===================`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    console.log(`Navigating to ${pageUrl}...`);
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Cari link download prospektus
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
      console.log('PDF URL not found in page DOM.');
      return;
    }

    console.log(`Downloading PDF: ${pdfUrl}`);
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.goto(pdfUrl).catch(() => {}); // Goto PDF link triggers download
    const download = await downloadPromise;
    await download.saveAs(outPath);
    console.log(`PDF saved to ${outPath}`);

    // Parse PDF
    const buf = fs.readFileSync(outPath);
    const parsed = await pdf(buf);
    const cleanText = parsed.text.replace(/\s+/g, ' ');

    console.log('\n--- 500 Karakter Pertama ---');
    console.log(cleanText.substring(0, 500));

    // Pencarian nominal
    console.log('\n--- Hasil Pencarian "nominal" ---');
    const nominalRegex = /.{0,60}nominal.{0,60}/gi;
    let match;
    let count = 0;
    while ((match = nominalRegex.exec(cleanText)) !== null && count < 8) {
      console.log(`[${count+1}] "${match[0].trim()}"`);
      count++;
    }

    // Pencarian penggunaan dana
    console.log('\n--- Hasil Pencarian "rencana penggunaan" ---');
    const danaIdx = cleanText.search(/[Rr]encana\s+[Pp]enggunaan|[Pp]enggunaan\s+[Dd]ana/);
    if (danaIdx !== -1) {
      console.log('Ditemukan seksi Penggunaan Dana di indeks:', danaIdx);
      console.log(cleanText.substring(danaIdx, danaIdx + 1200));
    }

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await browser.close();
  }
}

async function run() {
  const dir = path.join(__dirname, '..', 'scratch', 'pdf');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // DOSS
  await downloadAndExtract(
    'DOSS',
    'https://e-ipo.co.id/en/ipo/255/doss-pt-global-digital-niaga-tbk', // Note: Ini link fiktif/asumsi, e-ipo id 255. Mari kita cari URL aslinya di e-ipo.
    path.join(dir, 'DOSS.pdf')
  );
}

run().catch(console.error);
