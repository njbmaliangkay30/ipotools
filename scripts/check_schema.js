require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data, error } = await supabase.from('ipos').select('*').limit(1);
  console.log("ipos error:", error?.message || "Success");

  const tables = ['underwriters', 'ipo_underwriters', 'ipo_insider_risk', 'decisions', 'ipo_signals'];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    console.log(`Table ${table}:`, error?.message || "Exists");
  }
}
checkSchema();
