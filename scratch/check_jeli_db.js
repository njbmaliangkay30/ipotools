require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: ipo, error } = await supabase.from('ipos').select('*').eq('ticker', 'JELI').single();
  console.log("=== TABLE IPOS (JELI) ===");
  console.log(ipo || error);

  if (ipo) {
    const { data: uw } = await supabase.from('ipo_underwriters').select('*, underwriters(*)').eq('ipo_id', ipo.id);
    console.log("\n=== TABLE IPO_UNDERWRITERS ===");
    console.log(uw);

    const { data: risk } = await supabase.from('ipo_insider_risk').select('*').eq('ipo_id', ipo.id);
    console.log("\n=== TABLE IPO_INSIDER_RISK ===");
    console.log(risk);
  }
}

check();
