require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const pdf = require('pdf-parse');
const { createClient } = require('@supabase/supabase-js');
const { extractInsiderCost, extractUseOfProceeds, extractLockup, extractDivestasi, extractMaxProceeds } = require('./pdf_extractor_v2.js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MAPPINGS_PATH = path.join(__dirname, '..', 'scratch', 'eipo_mappings.json');
const PDF_DIR = path.join(__dirname, '..', 'scratch', 'pdf');

async function downloadPdf(page, ticker, id, outPath) {
  const types = ['summary', 'prospectus', 'prospectus_awal'];
  for (const type of types) {
    const url = `https://e-ipo.co.id/id/pipeline/get-propectus-file?id=${id}&type=${type}`;
    console.log(`    [→] Coba unduh PDF (${type}) dari ${url}...`);
    try {
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
      await page.goto(url).catch(() => {});
      const download = await downloadPromise;
      if (!download) throw new Error('Timeout atau file tidak ditemukan');
      await download.saveAs(outPath);
      console.log(`    [✓] PDF (${type}) berhasil disimpan ke ${outPath}`);
      return;
    } catch (e) {
      console.log(`    [!] Tipe ${type} belum tersedia, mencoba berikutnya...`);
    }
  }
  throw new Error('Gagal mengunduh semua tipe prospektus.');
}

async function run() {
  console.log('=== MEMULAI PERBAIKAN & RE-SCRAPING DATABASE MASSAL ===');
  
  if (!fs.existsSync(PDF_DIR)) {
    fs.mkdirSync(PDF_DIR, { recursive: true });
  }

  // 1. Baca ID mappings
  if (!fs.existsSync(MAPPINGS_PATH)) {
    console.log('[✗] File mappings eipo_mappings.json tidak ditemukan. Harap jalankan map_eipo_ids_fast.js dulu.');
    return;
  }
  const mappings = JSON.parse(fs.readFileSync(MAPPINGS_PATH, 'utf8'));

  // 2. Ambil seluruh IPO dari database
  const { data: ipos, error: fetchErr } = await supabase.from('ipos').select('*');
  if (fetchErr) {
    console.log(`[✗] Gagal mengambil data IPO: ${fetchErr.message}`);
    return;
  }
  console.log(`Total IPO di database yang akan diproses: ${ipos.length}`);

  // Mulai browser Playwright
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  });
  const page = await context.newPage();

  const targetTicker = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2].toUpperCase() : null;

  try {
    for (let idx = 0; idx < ipos.length; idx++) {
      const ipo = ipos[idx];
      const ticker = ipo.ticker.toUpperCase();
      if (targetTicker && targetTicker !== ticker) continue;
      console.log(`\n[${idx + 1}/${ipos.length}] Memproses Emiten: ${ticker}`);

      // ────────────────────────────────────────────────────────────────────────
      // A. KONEKSIKAN UNDERWRITERS
      // ────────────────────────────────────────────────────────────────────────
      if (ipo.underwriters) {
        const uws = ipo.underwriters.split(',').map(s => s.trim()).filter(Boolean);
        for (const uwStr of uws) {
          const parts = uwStr.split(' - ');
          const code = parts[0]?.trim();
          const name = parts.slice(1).join(' - ').trim();
          if (code && code.length <= 6) {
            const role = uws.indexOf(uwStr) === 0 ? 'lead' : 'co-lead';
            
            // Upsert underwriter ke master table
            await supabase.from('underwriters')
              .upsert({ broker_code: code, name: name || code }, { onConflict: 'broker_code' });

            // Hubungkan di ipo_underwriters menggunakan broker_code (foreign key)
            await supabase.from('ipo_underwriters')
              .upsert({ ipo_id: ipo.id, broker_code: code, role }, { onConflict: 'ipo_id,broker_code' });
          }
        }
        console.log(`    [+] Underwriter relasi disinkronkan.`);
      }

      // ────────────────────────────────────────────────────────────────────────
      // B. PROSES DOKUMEN PROSPEKTUS
      // ────────────────────────────────────────────────────────────────────────
      const eipoId = mappings[ticker];
      if (!eipoId) {
        console.log(`    [!] Skip PDF: ID E-IPO untuk ${ticker} tidak ditemukan di mappings.`);
        continue;
      }

      const pdfPath = path.join(PDF_DIR, `${ticker}.pdf`);
      
      // Unduh jika belum ada di cache lokal atau jika status Offering / --force
      if (!fs.existsSync(pdfPath) || process.argv.includes('--force') || ipo.status === 'Offering') {
        try {
          if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); // hapus cache lama
          await downloadPdf(page, ticker, eipoId, pdfPath);
        } catch (e) {
          console.log(`    [✗] Gagal mengunduh PDF: ${e.message}`);
          if (!fs.existsSync(pdfPath)) continue;
        }
      } else {
        console.log(`    [+] Menggunakan PDF cache lokal.`);
      }

      // Parse PDF
      try {
        const dataBuffer = fs.readFileSync(pdfPath);
        const pdfData = await pdf(dataBuffer);
        const text = pdfData.text;

        // Ekstraksi modular akurat
        const insiderCost = extractInsiderCost(text);
        console.log(`    [+] Harga Insider : Rp ${insiderCost || 'tidak ditemukan'}`);

        const maxProceeds = extractMaxProceeds(text);
        console.log(`    [+] Dana Maksimal  : Rp ${maxProceeds ? (maxProceeds/1e9).toFixed(2) + ' Miliar' : 'tidak ditemukan'}`);

        const price = ipo.ipo_price || ipo.bb_price_low || 0;
        const totalProceedsRp = maxProceeds || ((ipo.offered_shares && price) ? ipo.offered_shares * price : 0);
        const proceeds = extractUseOfProceeds(text, totalProceedsRp);
        const penggunaanDanaRaw = proceeds.length > 0 ? JSON.stringify(proceeds) : null;
        console.log(`    [+] Penggunaan Dana: ${proceeds.length} item`);

        const { adaLockup, lockupMonths } = extractLockup(text);
        console.log(`    [+] Lock-up        : ${adaLockup ? lockupMonths + ' bulan' : 'tidak ada'}`);

        const pctDivestasi = extractDivestasi(text, ipo.offered_shares);
        console.log(`    [+] Saham Divestasi: ${pctDivestasi !== null ? pctDivestasi + '%' : '0%'}`);

        // Hitung ulang Price Gap secara matematis bersih
        let priceGapRatio = null, priceGapLow = null, priceGapHigh = null;
        if (insiderCost && (ipo.ipo_price || ipo.bb_price_low)) {
          const offerLow = ipo.ipo_price || ipo.bb_price_low;
          const offerHigh = ipo.ipo_price || ipo.bb_price_high;
          priceGapLow = offerLow / insiderCost;
          priceGapHigh = offerHigh / insiderCost;
          priceGapRatio = priceGapLow;
          console.log(`    [+] Price Gap      : ${priceGapLow.toFixed(2)}x – ${priceGapHigh.toFixed(2)}x`);
        }

        // Upsert ipo_insider_risk
        const { error: upsertErr } = await supabase.from('ipo_insider_risk').upsert({
          ipo_id: ipo.id,
          harga_perolehan_insider: insiderCost,
          price_gap_ratio: priceGapRatio,
          price_gap_low: priceGapLow,
          price_gap_high: priceGapHigh,
          ada_lockup: adaLockup,
          lockup_months: lockupMonths,
          pct_divestasi: pctDivestasi,
          penggunaan_dana_raw: penggunaanDanaRaw,
          analysis_notes: maxProceeds ? String(maxProceeds) : null
        }, { onConflict: 'ipo_id' });

        if (upsertErr) {
          console.log(`    [✗] Database Upsert Error: ${upsertErr.message}`);
        } else {
          console.log(`    [✓] Database Upsert Sukses.`);
        }

        // Simpan ke ipo_fund_usage
        if (penggunaanDanaRaw) {
          await supabase.from('ipo_fund_usage').delete().eq('ipo_id', ipo.id);
          for (const item of proceeds) {
            await supabase.from('ipo_fund_usage').insert({
              ipo_id: ipo.id,
              percentage: item.percentage,
              description: item.description,
            });
          }
        }

      } catch (e) {
        console.log(`    [✗] Gagal memparsing PDF: ${e.message}`);
      }
    }

    console.log('\n[✓] SELURUH PERBAIKAN DATABASE SELESAI DENGAN SUKSES!');
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
