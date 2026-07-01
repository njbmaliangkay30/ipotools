require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data: ipo } = await supabase.from('ipos').select('*').eq('ticker', 'JELI').single();
  console.log("=== IPOS TABLE (JELI) ===");
  console.log(ipo);

  const { data: risk } = await supabase.from('ipo_insider_risk').select('*').eq('ipo_id', ipo.id).single();
  console.log("\n=== IPO_INSIDER_RISK TABLE (JELI) ===");
  console.log(risk);
})();
