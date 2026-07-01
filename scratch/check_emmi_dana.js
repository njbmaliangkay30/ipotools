require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const pdf = require('pdf-parse');
const fs = require('fs');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  });
  const page = await context.newPage();

  await page.goto('https://e-ipo.co.id/en/ipo/351/emmi-pt-esa-medika-mandiri-tbk', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  const pdfUrl = 'https://e-ipo.co.id/en/pipeline/get-propectus-file?id=351&type=prospectus_awal';
  const resp = await page.request.get(pdfUrl, { timeout: 60000 });
  const buf = await resp.body();
  const parsed = await pdf(buf);
  const text = parsed.text;
  const cleanText = text.replace(/\s+/g, ' ');

  // Cari seksi penggunaan dana
  const danaIdx = cleanText.search(/[Pp]enggunaan\s+[Dd]ana|[Rr]encana\s+[Pp]enggunaan/);
  if (danaIdx === -1) {
    console.log('Seksi penggunaan dana TIDAK ditemukan');
  } else {
    console.log('Seksi ditemukan di index:', danaIdx);
    console.log('\n=== 2000 karakter sekitar Penggunaan Dana ===');
    console.log(cleanText.substring(danaIdx, danaIdx + 2000));
  }

  // Cari semua pola persentase
  console.log('\n=== Semua pola "%" dalam dokumen (50 karakter sebelum dan sesudah) ===');
  const pctRegex = /(\d{1,3}(?:[.,]\d{1,2})?)\s*%/g;
  let m; let count = 0;
  while ((m = pctRegex.exec(cleanText)) !== null && count < 20) {
    const ctx = cleanText.substring(Math.max(0, m.index - 50), m.index + 80);
    console.log(`\n[${m[1]}%] at ${m.index}:`);
    console.log(JSON.stringify(ctx));
    count++;
  }

  await browser.close();
}

run().catch(console.error);
