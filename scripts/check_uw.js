require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkUW() {
    const { data: cols, error: colError } = await supabase.rpc('get_columns_for_underwriters');
    
    const { data, error } = await supabase.from('underwriters').select('*').limit(5);
    console.log("UW Data:", data);
    console.log("UW Error:", error);
}
checkUW();
