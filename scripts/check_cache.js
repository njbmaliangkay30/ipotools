require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function checkUW() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from('underwriters').select('ara_d1').limit(1);
    if (error) console.error("Cache Error:", error.message);
    else console.log("Success! Cache is updated.");
}
checkUW();
