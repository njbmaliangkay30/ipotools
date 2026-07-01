require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { count: uwCount, error: uwErr } = await supabase
    .from('underwriters')
    .select('*', { count: 'exact', head: true });

  const { count: ipoUwCount, error: ipoUwErr } = await supabase
    .from('ipo_underwriters')
    .select('*', { count: 'exact', head: true });

  console.log("underwriters table count:", uwCount, uwErr ? uwErr.message : "");
  console.log("ipo_underwriters table count:", ipoUwCount, ipoUwErr ? ipoUwErr.message : "");

  if (uwCount > 0) {
    const { data: uwSample } = await supabase.from('underwriters').select('*').limit(5);
    console.log("underwriters sample:", uwSample);
  }
  if (ipoUwCount > 0) {
    const { data: ipoUwSample } = await supabase.from('ipo_underwriters').select('*').limit(5);
    console.log("ipo_underwriters sample:", ipoUwSample);
  }
}

test();
