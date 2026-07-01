require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data: ipos } = await supabase.from('ipos').select('id, ticker').in('ticker', ['PRDL', 'JELI']);
  console.log("IPOs:", ipos);
  
  if (ipos && ipos.length > 0) {
    const ids = ipos.map(i => i.id);
    const { data: risks, error } = await supabase.from('ipo_insider_risk').select('*').in('ipo_id', ids);
    console.log("Risks Table Sample:");
    console.log(JSON.stringify(risks, null, 2));
  }
}
test();
