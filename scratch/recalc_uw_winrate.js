require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  console.log('=== Menghitung Win Rate UW dari data aktual ===\n');

  // 1. Ambil semua UW dan IPO yang mereka tangani (yang sudah listed)
  const { data: allRels } = await sb.from('ipo_underwriters')
    .select('underwriter_id, role, ipos(ticker, status)');

  if (!allRels || allRels.length === 0) {
    console.log('Tidak ada data di ipo_underwriters.');
    return;
  }

  // 2. Kelompokkan per UW
  const uwStats = {};
  for (const rel of allRels) {
    const uwId = rel.underwriter_id;
    if (!uwId) continue;
    if (!uwStats[uwId]) uwStats[uwId] = { total: 0, wins: 0 };
    uwStats[uwId].total += 1;
    if (rel.ipos?.status?.toLowerCase() === 'listed') {
      uwStats[uwId].wins += 1;
    }
  }

  console.log(`Total UW dengan data: ${Object.keys(uwStats).length}`);
  console.log(`Total relasi ipo_underwriters: ${allRels.length}\n`);

  // 3. Update setiap UW
  let updated = 0;
  for (const [uwId, stats] of Object.entries(uwStats)) {
    const winRate = stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0;
    const { error } = await sb.from('underwriters')
      .update({
        total_ipos: stats.total,
        total_wins: stats.wins,
        win_rate: winRate
      })
      .eq('id', uwId);
    if (error) console.error(`Error update UW ${uwId}:`, error.message);
    else updated++;
  }

  console.log(`Updated ${updated} underwriter records.\n`);

  // 4. Tampilkan hasil
  const { data: result } = await sb.from('underwriters')
    .select('broker_code, name, win_rate, total_ipos, total_wins')
    .gt('total_ipos', 0)
    .order('win_rate', { ascending: false });

  console.log('=== Hasil Win Rate UW ===');
  result?.forEach(u => {
    console.log(`  ${u.broker_code.padEnd(4)} | ${String(u.win_rate).padStart(3)}% | ${u.total_wins}/${u.total_ipos} listed | ${u.name}`);
  });
}

run().catch(console.error);
