require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testQuery() {
    const { data, error } = await supabase
    .from('ipos')
    .select(`
      *,
      ipo_signals (*),
      ipo_insider_risk (*),
      decisions (*),
      ipo_underwriters (
        role,
        underwriters (*)
      )
    `)
    .limit(1)
    .single();

    if (error) {
        console.error("SUPABASE ERROR:", error);
    } else {
        console.log("SUCCESS:", data.ticker);
    }
}
testQuery();
