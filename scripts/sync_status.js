require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function syncByListingDate() {
  console.log('=== Sinkronisasi Status via Listing Date ===\n');

  // Ambil semua IPO yang punya listing_date dan belum berstatus 'listed'
  const { data: ipos, error } = await supabase
    .from('ipos')
    .select('id, ticker, status, listing_date')
    .not('status', 'eq', 'listed')
    .not('listing_date', 'is', null);

  if (error) { console.error(error); return; }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toUpdate = ipos.filter(d => {
    const ld = new Date(d.listing_date);
    return !isNaN(ld.getTime()) && ld < today;
  });

  if (toUpdate.length === 0) {
    console.log('Tidak ada IPO yang perlu diupdate.');
  } else {
    console.log(`Menandai ${toUpdate.length} IPO sebagai 'listed' berdasarkan listing_date:`);
    toUpdate.forEach(d => console.log(`  - ${d.ticker} | listing_date: ${d.listing_date} | was: ${d.status}`));

    const { error: upErr } = await supabase
      .from('ipos')
      .update({ status: 'listed' })
      .in('id', toUpdate.map(d => d.id));

    if (upErr) console.error('Update error:', upErr);
    else console.log('\n✓ Berhasil diupdate!');
  }

  // Tampilkan status akhir
  const { data: final } = await supabase
    .from('ipos')
    .select('ticker, status, listing_date')
    .order('status')
    .order('ticker');

  console.log('\n=== Status Akhir ===');
  final.forEach(d => {
    const ld = d.listing_date ? d.listing_date.substring(0, 10) : '-';
    console.log(`  ${d.ticker.padEnd(6)} | ${d.status.padEnd(20)} | listing: ${ld}`);
  });
}

syncByListingDate();
