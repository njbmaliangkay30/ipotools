require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const UNDERWRITER_MOCKS = [
    { code: 'OD', name: 'Danareksa Sekuritas', win_rate: 75.5, ara_d1: 18.5, avg_ara_streak: 2.1, data_points: 15 },
    { code: 'YP', name: 'Mirae Asset Sekuritas', win_rate: 68.0, ara_d1: 14.2, avg_ara_streak: 1.5, data_points: 24 },
    { code: 'PD', name: 'Indo Premier Sekuritas', win_rate: 62.5, ara_d1: 10.1, avg_ara_streak: 1.2, data_points: 30 },
    { code: 'CP', name: 'KB Valbury Sekuritas', win_rate: 85.0, ara_d1: 22.0, avg_ara_streak: 3.5, data_points: 8 },
    { code: 'NI', name: 'BNI Sekuritas', win_rate: 55.0, ara_d1: 5.5, avg_ara_streak: 0.8, data_points: 12 },
    { code: 'GR', name: 'Panin Sekuritas', win_rate: 90.0, ara_d1: 24.5, avg_ara_streak: 4.1, data_points: 5 },
    { code: 'AH', name: 'Shinhan Sekuritas', win_rate: 40.0, ara_d1: -5.0, avg_ara_streak: 0.0, data_points: 9 },
    { code: 'HD', name: 'KGI Sekuritas', win_rate: 80.0, ara_d1: 19.0, avg_ara_streak: 2.8, data_points: 11 },
];

async function seedData() {
    console.log("Seeding Mock Data...");

    // 1. Insert Underwriters (Using insert to avoid PK cache issues since it's empty anyway)
    for (const uw of UNDERWRITER_MOCKS) {
        const { error } = await supabase.from('underwriters').insert({
            broker_code: uw.code,
            name: uw.name,
            win_rate: uw.win_rate,
            ara_d1: uw.ara_d1,
            avg_ara_streak: uw.avg_ara_streak,
            data_points: uw.data_points
        });
        if (error) console.error("Error inserting UW:", uw.code, error);
    }
    console.log("✓ Seeded underwriters");

    // 2. Fetch IPOs
    const { data: ipos, error: ipoError } = await supabase.from('ipos').select('id, ticker, status');
    if (ipoError || !ipos) return console.error("Failed to fetch IPOs", ipoError);

    const brokerCodes = UNDERWRITER_MOCKS.map(u => u.code);

    // 3. Inject Signals & IPO Underwriters
    for (const ipo of ipos) {
        // Randomly pick 1-2 underwriters
        const numUw = Math.floor(Math.random() * 2) + 1;
        const shuffled = brokerCodes.sort(() => 0.5 - Math.random());
        const selectedUw = shuffled.slice(0, numUw);

        for (let i = 0; i < selectedUw.length; i++) {
            await supabase.from('ipo_underwriters').insert({
                ipo_id: ipo.id,
                broker_code: selectedUw[i],
                role: i === 0 ? 'Lead' : 'Co-Lead'
            });
        }
        
        // Momentum Signals
        const trends = Math.floor(Math.random() * 100);
        const news = Math.floor(Math.random() * 40);
        const community = Math.floor(Math.random() * 5) + 1; // 1-5
        const sectorMom = (Math.random() * 20 - 5).toFixed(2); // -5 to 15
        
        const osEst = (Math.random() * 50 + 2).toFixed(2);
        const osConf = Math.random() > 0.5 ? 'high' : 'low';

        // Try upsert first for ipo_signals since we know onConflict ipo_id exists
        // Wait, to be safe, just select if it exists, if yes update, if no insert
        const { data: existingSignal } = await supabase.from('ipo_signals').select('id').eq('ipo_id', ipo.id).single();
        
        const signalData = {
            ipo_id: ipo.id,
            google_trends_score: trends,
            news_count_30d: news,
            community_buzz: community,
            sector_momentum_60d: sectorMom,
            os_estimate: osEst,
            os_confidence: osConf
        };

        if (existingSignal) {
            await supabase.from('ipo_signals').update(signalData).eq('ipo_id', ipo.id);
        } else {
            await supabase.from('ipo_signals').insert(signalData);
        }

        console.log(`✓ Seeded signals & UW for ${ipo.ticker}`);
    }

    console.log("Done Seeding!");
}

seedData();
