require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const pdf = require('pdf-parse');
const { extractInsiderCost, extractUseOfProceeds, extractLockup, extractDivestasi } = require('./pdf_extractor_v2.js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const BASE_URL = 'https://e-ipo.co.id';
const TARGET_TICKER = process.argv[2] || 'EMMI';

const STATUS_CLASSIFICATION = ["Pre-Effective","Book Building","Offering","Waiting For Offering","Allotment","Closed","Canceled","Postpone"];
function determineStatus(textList) {
  const found = STATUS_CLASSIFICATION.filter(s => textList.includes(s));
  if (found.length === 0) return null;
  const filtered = found.filter(s => s !== "Book Building");
  return filtered.length > 0 ? filtered[0] : found[0];
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    locale: 'en-US',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
    window.chrome = { runtime: {} };
  });

  const page = await context.newPage();

  try {
    console.log(`[→] Mencari ${TARGET_TICKER} di e-IPO...`);
    let targetUrl = null;

    for (let pageNum = 1; pageNum <= 5 && !targetUrl; pageNum++) {
      const url = `${BASE_URL}/en/ipo/index?page=${pageNum}&per-page=12`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);

      const links = await page.locator('a[href*="/ipo/"]').all();
      for (const link of links) {
        const href = await link.getAttribute('href');
        if (href && new RegExp(`/${TARGET_TICKER.toLowerCase()}-`, 'i').test(href)) {
          targetUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
          break;
        }
      }
    }

    if (!targetUrl) {
      console.log(`[✗] ${TARGET_TICKER} tidak ditemukan di e-IPO pipeline.`);
      return;
    }

    console.log(`\n[→] Scraping ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);

    let content = '';
    try {
      content = await page.locator('#wrapper section:nth-child(2) div div div:nth-child(2)').first().innerText({ timeout: 5000 });
    } catch {
      content = await page.locator('.container, main, body').first().innerText({ timeout: 5000 });
    }

    const data = content.split('\n').map(d => d.trim()).filter(d => d);
    function getNext(key) {
      const idx = data.indexOf(key);
      return (idx !== -1 && idx + 1 < data.length) ? data[idx + 1] : null;
    }

    const status = determineStatus(data);
    const ticker = data[2] || TARGET_TICKER;
    const nama = data[0] || '';
    const sektor = getNext('Sector');
    const website = getNext('Website');

    const rawShares = getNext('Number of shares offered');
    const jumlahSaham = rawShares ? parseInt(rawShares.replace(/[^\d]/g, ''), 10) : null;
    const pctFloat = getNext('% of Total Shares');

    // UW
    const uwIdx = data.indexOf('Underwriter(s)');
    const uwRaw = [];
    if (uwIdx !== -1) {
      let ci = uwIdx + 1;
      while (ci < data.length && !STATUS_CLASSIFICATION.includes(data[ci])) {
        if (data[ci] && !['Shares Offered','Number of shares offered','Sector','Website','% of Total Shares'].includes(data[ci])) {
          uwRaw.push(data[ci]);
        }
        ci++;
      }
    }

    const bbLow = getNext('Low'); const bbHigh = getNext('High');
    const ipoPrice = getNext('IPO Price');

    console.log(`\n✓ ${ticker} | ${status}`);
    console.log(`  Nama   : ${nama}`);
    console.log(`  Sektor : ${sektor}`);
    console.log(`  Saham  : ${jumlahSaham?.toLocaleString()} (${pctFloat}%)`);
    console.log(`  Harga  : Rp${bbLow}–${bbHigh} / IPO: ${ipoPrice}`);
    console.log(`  UW raw : ${uwRaw.join(' | ')}`);
    console.log(`  Website: ${website}`);

    const { data: existingIpo } = await supabase.from('ipos').select('id').eq('ticker', ticker).single();
    const ipoPayload = {
      ticker,
      company_name: nama,
      sector: sektor,
      website,
      offered_shares: jumlahSaham || null,
      public_float_pct: pctFloat ? parseFloat(pctFloat) : null,
      status: status || 'Pre-Effective',
      bb_price_low: bbLow ? parseInt(bbLow.replace(/[^\d]/g,''),10) : null,
      bb_price_high: bbHigh ? parseInt(bbHigh.replace(/[^\d]/g,''),10) : null,
      ipo_price: ipoPrice ? parseInt(ipoPrice.replace(/[^\d]/g,''),10) : null,
    };

    const { data: upsertedIpo, error: ipoErr } = await supabase.from('ipos')
      .upsert(ipoPayload, { onConflict: 'ticker' })
      .select('id').single();

    if (ipoErr) { console.log(`[✗] IPO upsert error: ${ipoErr.message}`); return; }
    console.log(`\n[✓] IPO upserted. ID: ${upsertedIpo.id}`);
    const ipoId = upsertedIpo.id;

    for (const uwStr of uwRaw) {
      const parts = uwStr.split(' - ');
      const code = parts[0]?.trim();
      const name = parts.slice(1).join(' - ').trim();
      if (!code || code.length > 6) continue;

      const role = uwRaw.indexOf(uwStr) === 0 ? 'lead' : 'co-lead';

      const { data: uw } = await supabase.from('underwriters')
        .upsert({ broker_code: code, name: name || code }, { onConflict: 'broker_code' })
        .select('id').single();

      if (uw) {
        await supabase.from('ipo_underwriters')
          .upsert({ ipo_id: ipoId, underwriter_id: uw.id, role }, { onConflict: 'ipo_id,underwriter_id' });
        console.log(`  [UW] ${code} (${role}) synced`);
      }
    }

    console.log('\n[→] Mencari link prospektus...');
    const pdfLinks = await page.locator('a[href*="get-prop"], a[href*="prospectus"], a[href*=".pdf"]').all();
    let pdfUrl = null;
    for (const l of pdfLinks) {
      const href = await l.getAttribute('href');
      if (href) { pdfUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`; break; }
    }

    if (pdfUrl) {
      console.log(`[→] Download PDF: ${pdfUrl.substring(0, 70)}...`);
      const resp = await page.request.get(pdfUrl, { timeout: 60000 });
      if (resp.ok()) {
        const buf = await resp.body();
        const parsed = await pdf(buf).catch(() => null);
        if (parsed?.text) {
          const text = parsed.text;

          // ── Gunakan Modul Baru V10 ──────────────────────────────────────
          const insiderCost = extractInsiderCost(text);
          console.log(`  Insider Cost: ${insiderCost ? 'Rp ' + insiderCost : 'tidak ditemukan'}`);

          if (!ipoPayload.ipo_price) {
            const priceMatch = text.replace(/\s+/g, ' ').match(/Harga\s+Penawaran.*?Rp\s?([\d\.]+)/i);
            if (priceMatch) {
              const offerPrice = parseInt(priceMatch[1].replace(/\./g,''), 10);
              if (offerPrice > 0) {
                await supabase.from('ipos').update({ ipo_price: offerPrice }).eq('id', ipoId);
                console.log(`  Harga Penawaran: Rp ${offerPrice}`);
                ipoPayload.ipo_price = offerPrice;
              }
            }
          }

          // Hitung proceeds estimasi untuk konversi Rp ke %
          const price = ipoPayload.ipo_price || ipoPayload.bb_price_low || 0;
          const totalProceedsRp = (jumlahSaham && price) ? jumlahSaham * price : 0;
          
          const proceeds = extractUseOfProceeds(text, totalProceedsRp);
          const penggunaanDanaRaw = proceeds.length > 0 ? JSON.stringify(proceeds) : null;
          console.log(`  Penggunaan Dana: ${proceeds.length} item`);
          proceeds.forEach(i => console.log(`    [${i.percentage}%] ${i.description.substring(0,70)}`));

          const { adaLockup, lockupMonths } = extractLockup(text);
          console.log(`  Lock-up: ${adaLockup ? lockupMonths + ' bulan' : 'tidak ada'}`);

          const pctDivestasi = extractDivestasi(text, jumlahSaham);
          console.log(`  Divestasi: ${pctDivestasi !== null ? pctDivestasi + '%' : '0%'}`);

          let priceGapRatio = null, priceGapLow = null, priceGapHigh = null;
          if (insiderCost && (ipoPayload.ipo_price || ipoPayload.bb_price_low)) {
            const offerLow = ipoPayload.ipo_price || ipoPayload.bb_price_low;
            const offerHigh = ipoPayload.ipo_price || ipoPayload.bb_price_high;
            priceGapLow = offerLow / insiderCost;
            priceGapHigh = offerHigh / insiderCost;
            priceGapRatio = priceGapLow;
            console.log(`  Price Gap: ${priceGapLow.toFixed(2)}x – ${priceGapHigh.toFixed(2)}x`);
          }

          const { error: riskErr } = await supabase.from('ipo_insider_risk').upsert({
            ipo_id: ipoId,
            harga_perolehan_insider: insiderCost,
            price_gap_ratio: priceGapRatio,
            price_gap_low: priceGapLow,
            price_gap_high: priceGapHigh,
            ada_lockup: adaLockup,
            lockup_months: lockupMonths,
            pct_divestasi: pctDivestasi,
            penggunaan_dana_raw: penggunaanDanaRaw,
          }, { onConflict: 'ipo_id' });

          if (riskErr) console.log(`[✗] ipo_insider_risk error: ${riskErr.message}`);
          else console.log(`[✓] ipo_insider_risk upserted`);

          if (penggunaanDanaRaw) {
            await supabase.from('ipo_fund_usage').delete().eq('ipo_id', ipoId);
            for (const item of proceeds) {
              await supabase.from('ipo_fund_usage').insert({
                ipo_id: ipoId,
                percentage: item.percentage,
                description: item.description,
              });
            }
            console.log(`[✓] ipo_fund_usage: ${proceeds.length} item disimpan`);
          }
        }
      }
    } else {
      console.log('[!] Tidak ada link prospektus ditemukan');
    }

    console.log('\n[✓] Selesai!');
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
