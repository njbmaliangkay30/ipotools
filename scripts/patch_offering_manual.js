require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MAN_PATCH = [
  { ticker: 'JELI', open: '2026-06-27', close: '2026-07-01', status: 'offering' },
  { ticker: 'PRDL', open: '2026-06-26', close: '2026-06-30', status: 'pre-effective' },
  { ticker: 'JECX', open: '2026-06-28', close: '2026-07-02', status: 'offering' }
];

async function run() {
  console.log('=== MEMULAI PATCH MANUAL TANGGAL PENAWARAN ===');
  for (const patch of MAN_PATCH) {
    const { error } = await supabase
      .from('ipos')
      .update({
        offering_open: patch.open,
        offering_close: patch.close,
        status: patch.status,
        updated_at: new Date().toISOString()
      })
      .eq('ticker', patch.ticker);

    if (error) {
      console.log(`[✗] Gagal mempatch ${patch.ticker}: ${error.message}`);
    } else {
      console.log(`[✓] Sukses mempatch ${patch.ticker}: Status=${patch.status}, ${patch.open} s/d ${patch.close}`);
    }
  }
}

run().catch(console.error);
