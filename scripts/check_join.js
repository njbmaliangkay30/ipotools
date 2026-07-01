require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data: ipo, error } = await supabase
    .from('ipos')
    .select(`
      *,
      ipo_signals (*),
      ipo_insider_risk (*),
      decisions (*)
    `)
    .eq('ticker', 'JELI')
    .single();
    
  console.log("Error:", error);
  console.log("JELI ipo_insider_risk:", ipo.ipo_insider_risk);
  console.log("Is array?", Array.isArray(ipo.ipo_insider_risk));
}
test();
