require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

function parseDanaItems(rawText, totalProceedsRp) {
  if (!rawText) return [];
  const rawParts = rawText.split(' | ').map(p => p.trim()).filter(Boolean);
  let totalPct = 0;
  let sisaItemIdx = -1;

  const parsed = rawParts.map((part, idx) => {
    const firstRpIdx = part.search(/Rp\.?\s?\d/i);
    const leadingSegment = firstRpIdx > 0 && firstRpIdx < 120 ? part.substring(0, firstRpIdx) : part.substring(0, 120);
    const allocationPctMatch = leadingSegment.match(/(?:sekitar|sebesar|sebanyak)[^%]*?(\d+(?:[,\.]\d+)?)\s*%/i)
      || leadingSegment.match(/(\d+(?:[,\.]\d+)?)\s*%\s+(?:akan|untuk|digunakan)/i);
    let pct = allocationPctMatch ? parseFloat(allocationPctMatch[1].replace(',', '.')) : null;

    const lower = part.toLowerCase();
    const isSisa = lower.includes('sisa') || lower.includes('sisanya');
    if (isSisa) sisaItemIdx = idx;
    if (pct !== null) totalPct += pct;

    let desc = part;
    desc = desc.replace(/^\s*[a-zA-Z\d]+\s*[)\.]\s*/, '').trim(); // Bersihkan penomoran awal

    let prevDesc = '';
    while (desc !== prevDesc) {
      prevDesc = desc;
      desc = desc.replace(/^\s*(?:sekitar|untuk|akan digunakan|sebagai|adalah|dan)\s+/i, '').trim();
      desc = desc.replace(/^[\s,;\.-]+/, '').trim();
    }

    const searchArea = desc.substring(20);
    const sentenceEndInArea = searchArea.search(/[\.;]\s+(?=[A-Z]|Keterangan|dengan\s+rincian|dalam\s+hal|Apabila|Selanjutnya|Sesuai)/);
    if (sentenceEndInArea !== -1 && (sentenceEndInArea + 20) < 400) {
      desc = desc.substring(0, sentenceEndInArea + 20).trim();
    } else if (desc.length > 350) {
      const cutAt = desc.lastIndexOf(' ', 350);
      desc = desc.substring(0, cutAt > 0 ? cutAt : 350).trim() + '…';
    }
    desc = desc.replace(/[;,\.\s]+$/, '').trim();
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);

    return { pct, desc, isSisa, raw: part };
  });

  const rpValues = rawParts.map(part => {
    const match = part.match(/Rp\.?\s?(\d{1,3}(?:\.\d{3})*)/i);
    return match ? parseInt(match[1].replace(/\./g, ''), 10) : 0;
  });

  const hasRpItems = parsed.some((item, idx) => item.pct === null && rpValues[idx] > 0 && idx !== sisaItemIdx);
  if (hasRpItems) {
    const denominator = totalProceedsRp > 0 ? totalProceedsRp : rpValues.filter((_, idx) => idx !== sisaItemIdx).reduce((a,b) => a+b, 0);
    if (denominator > 0) {
      parsed.forEach((item, idx) => {
        if (item.pct === null && rpValues[idx] > 0 && idx !== sisaItemIdx) {
          item.pct = Math.round((rpValues[idx] / denominator) * 100);
        }
      });
    }
  }

  totalPct = parsed.reduce((sum, item, idx) => idx === sisaItemIdx ? sum : sum + (item.pct ?? 0), 0);
  
  if (sisaItemIdx !== -1 && totalPct < 100) {
    parsed[sisaItemIdx].pct = Math.round(100 - totalPct);
  }
  if (parsed.length === 1 && parsed[0].pct === null) parsed[0].pct = 100;

  // Saring agar hanya mengembalikan item yang benar-benar memiliki persentase alokasi atau merupakan item sisa
  const cleanParsed = parsed.filter(item => item.pct !== null || item.isSisa);
  return cleanParsed;
}

async function test(ticker) {
  const { data: ipo } = await supabase
    .from('ipos')
    .select('ticker, offered_shares, bb_price_low, bb_price_high, ipo_price, ipo_insider_risk(penggunaan_dana_raw)')
    .eq('ticker', ticker)
    .single();

  if (!ipo || !ipo.ipo_insider_risk) {
    console.log(`\n✗ ${ticker} | No insider risk data found.`);
    return;
  }

  const price = ipo.ipo_price ?? ipo.bb_price_high ?? ipo.bb_price_low;
  const totalProceeds = ipo.offered_shares * price;
  const items = parseDanaItems(ipo.ipo_insider_risk?.penggunaan_dana_raw, totalProceeds);
  const totalPct = items.reduce((s, i) => s + (i.pct || 0), 0);

  const ok = totalPct >= 98 && totalPct <= 102;
  console.log(`\n${ok ? '✓' : '✗'} ${ticker} | Total: ${totalPct.toFixed(1)}% | Price used: Rp${price}`);
  items.forEach((item, i) => {
    console.log(`  [${i+1}] ${item.pct ?? '-'}% | "${item.desc.substring(0, 90)}"`);
  });
}

(async () => {
  await test('WBSA');
  await test('RLCO');
  await test('EMMI');
  await test('RANS');
  await test('BACH');
})();
