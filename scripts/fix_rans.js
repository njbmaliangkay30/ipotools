require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function fixRans() {
    // 1. Insert LG if not exists
    await supabase.from('underwriters').upsert({
        broker_code: 'LG',
        name: 'Trimegah Sekuritas Indonesia Tbk',
        win_rate: 82.5,
        ara_d1: 15.0,
        avg_ara_streak: 1.8,
        data_points: 20
    }, { onConflict: 'broker_code' });

    // 2. Find RANS
    const { data: rans } = await supabase.from('ipos').select('id').eq('ticker', 'RANS').single();
    if (rans) {
        // Delete random underwriters for RANS
        await supabase.from('ipo_underwriters').delete().eq('ipo_id', rans.id);
        
        // Assign LG
        await supabase.from('ipo_underwriters').insert({
            ipo_id: rans.id,
            broker_code: 'LG',
            role: 'Lead'
        });
        console.log("RANS fixed to LG!");
    } else {
        console.log("RANS not found in ipos table.");
    }
}
fixRans();
