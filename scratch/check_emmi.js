require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  // Ambil semua IPO yang ada data UW (string)
  const { data: ipos } = await sb.from('ipos')
    .select('id, ticker, status, underwriters')
    .not('underwriters', 'is', null)
    .order('created_at');
  
  console.log(`Total IPO dengan kolom underwriters: ${ipos?.length}\n`);
  
  // Tampilkan 10 sampel untuk lihat format stringnya
  ipos?.slice(0, 10).forEach(ipo => {
    console.log(`[${ipo.ticker}] ${ipo.status}`);
    console.log(`  -> "${ipo.underwriters}"`);
  });

  // Cek apakah tabel underwriters sudah ada datanya
  const { data: uwTable, count } = await sb.from('underwriters')
    .select('*', { count: 'exact' });
  console.log(`\nTotal rows di tabel underwriters: ${count}`);
  uwTable?.slice(0, 5).forEach(u => {
    console.log(`  ${u.broker_code} | ${u.name}`);
  });

  // Cek juga ipo_underwriters
  const { count: relCount } = await sb.from('ipo_underwriters')
    .select('*', { count: 'exact', head: true });
  console.log(`\nTotal rows di tabel ipo_underwriters: ${relCount}`);
}

run().catch(console.error);
