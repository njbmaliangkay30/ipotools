require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspectTable(tableName) {
  const { data, error } = await supabase.from(tableName).select('*').limit(1);
  if (data && data.length > 0) {
    console.log(`\nTable ${tableName} columns:`, Object.keys(data[0]).join(', '));
  } else {
    console.log(`\nTable ${tableName} is empty or has error:`, error?.message);
    // Since it's empty, we might not get columns from REST API unless we query information_schema, but we don't have direct SQL access.
  }
}

async function run() {
  await inspectTable('ipos');
  await inspectTable('underwriters');
  await inspectTable('ipo_underwriters');
  await inspectTable('ipo_insider_risk');
  await inspectTable('decisions');
  await inspectTable('ipo_signals');
}

run();
