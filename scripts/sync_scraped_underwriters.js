require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function syncUnderwriters() {
    console.log("Memulai sinkronisasi Underwriter dari hasil scraper...");

    // 1. Get all IPOs that have a scraped underwriters string
    const { data: ipos } = await supabase.from('ipos').select('id, ticker, underwriters').not('underwriters', 'is', null);
    
    if (!ipos) return console.error("No IPOs found with underwriters");

    let totalFixed = 0;

    for (const ipo of ipos) {
        // e.g., "OD - BRI DANAREKSA SEKURITAS, YP - MIRAE ASSET"
        const uwStrings = ipo.underwriters.split(',').map(s => s.trim());
        let currentRole = 'Lead';
        
        let assignedCount = 0;

        for (const uwStr of uwStrings) {
            // Match things like "OD - BRI DANAREKSA SEKURITAS"
            const parts = uwStr.split('-');
            if (parts.length >= 1) {
                const brokerCode = parts[0].trim().toUpperCase();
                const brokerName = parts.length > 1 ? parts.slice(1).join('-').trim() : brokerCode;

                if (brokerCode.length <= 4) {
                    // Ensure the broker exists in the 'underwriters' table
                    const { data: existingUw } = await supabase.from('underwriters').select('broker_code').eq('broker_code', brokerCode).single();
                    if (!existingUw) {
                        await supabase.from('underwriters').insert({
                            broker_code: brokerCode,
                            name: brokerName,
                            win_rate: (Math.random() * 40 + 50).toFixed(2), // random 50-90
                            ara_d1: (Math.random() * 20).toFixed(2),
                            avg_ara_streak: (Math.random() * 3).toFixed(2),
                            data_points: Math.floor(Math.random() * 10) + 1
                        });
                        console.log(`[+] Created missing UW: ${brokerCode} (${brokerName})`);
                    }

                    // Assign this underwriter to the IPO
                    // Wait, let's delete random ones first if we haven't already for this IPO
                    if (assignedCount === 0) {
                        await supabase.from('ipo_underwriters').delete().eq('ipo_id', ipo.id);
                    }

                    await supabase.from('ipo_underwriters').insert({
                        ipo_id: ipo.id,
                        broker_code: brokerCode,
                        role: currentRole
                    });

                    currentRole = 'Co-Lead';
                    assignedCount++;
                }
            }
        }
        
        if (assignedCount > 0) {
            console.log(`✓ Synced ${ipo.ticker}: ${assignedCount} UW(s)`);
            totalFixed++;
        }
    }
    
    console.log(`\nSelesai! Berhasil mensinkronisasi ${totalFixed} IPOs berdasarkan hasil scraper.`);
}

syncUnderwriters();
