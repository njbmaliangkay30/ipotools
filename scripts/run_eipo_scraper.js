require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const pdf = require('pdf-parse');
const { extractInsiderCost, extractUseOfProceeds, extractLockup, extractDivestasi } = require('./pdf_extractor_v2.js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const BASE_URL = "https://e-ipo.co.id";
const INDEX_URL = `${BASE_URL}/id/ipo/index`; // Gunakan versi bahasa Indonesia
const PAGE_SIZE = 12;

// Klasifikasi status versi Bahasa Indonesia dan Inggris dengan prioritas
const STATUS_PRIORITIES = [
    "Penawaran Umum", "Offering",
    "Penawaran Awal", "Book Building",
    "Penjatahan", "Waiting For Offering",
    "Listed", "Closed", "Canceled", "Postpone", "Pre-Effective"
];

// Mapping status e-IPO ID ke status DB Inggris agar frontend tidak crash
const STATUS_MAP = {
    "pre-effective": "pre-effective",
    "penawaran awal": "book building",
    "book building": "book building",
    "penawaran umum": "offering",
    "offering": "offering",
    "waiting for offering": "waiting for offering",
    "penjatahan": "pre-effective", // masa jeda penjatahan
    "closed": "listed",
    "listed": "listed",
    "canceled": "canceled",
    "postpone": "postpone"
};

function determineStatus(textList) {
    for (const status of STATUS_PRIORITIES) {
        if (textList.some(line => line && line.toLowerCase().includes(status.toLowerCase()))) {
            return STATUS_MAP[status.toLowerCase()] || status;
        }
    }
    return null;
}

function parseDetailPage(textContent, url) {
    const data = textContent.split('\n').map(d => d.trim()).filter(d => d);
    if (textContent.includes('JELI') || textContent.includes('Niramas')) {
        console.log("=== DEBUG DATA JELI ===", JSON.stringify(data, null, 2));
    }
    const record = {};

    function getNext(key) {
        const idx = data.indexOf(key);
        if (idx !== -1 && idx + 1 < data.length) {
            return data[idx + 1];
        }
        return null;
    }

    record.status = determineStatus(data);
    const kodeIdx = data.indexOf("Kode Emiten");
    record.ticker = (kodeIdx !== -1 && kodeIdx + 1 < data.length) ? data[kodeIdx + 1] : (data.length > 2 ? data[2] : null);
    
    const tbkLine = data.find(d => !d.toLowerCase().includes('beranda') && (d.includes('Tbk') || d.startsWith('PT ') || d.startsWith('PT.') || d.includes('Persero')));
    record.nama = tbkLine || (data.length > 0 ? data[0] : null);
    if (record.nama && record.nama.toLowerCase().includes('beranda')) {
        record.nama = record.nama.replace(/^.*\]\s*/i, '').trim();
    }

    record.sektor = getNext("Sektor");
    record.subsektor = getNext("Subsektor");
    if (record.subsektor === "Bidang Usaha") record.subsektor = null;
    record.website = getNext("Situs Web");

    const rawShares = getNext("Jumlah Saham Ditawarkan");
    record.jumlah_saham_ditawarkan = rawShares ? parseInt(rawShares.replace(/[^\d]/g, ''), 10) : null;
    
    const pctTotal = getNext("% dari Total Saham");
    record.pct_total_shares = pctTotal ? parseFloat(pctTotal) : null;

    // Parser Underwriters Indonesia
    const uwIdx = data.indexOf("Penjamin Emisi Efek");
    if (uwIdx !== -1) {
        const uws = [];
        let currIdx = uwIdx + 1;
        while (currIdx < data.length && !["Offering", "Book Building", "Masa Penawaran", "Rentang Harga", "Harga Penawaran"].includes(data[currIdx])) {
            const line = data[currIdx];
            if (line && !line.includes("Partisipan") && line !== "Penjamin Emisi Efek" && line.length > 2) {
                uws.push(line);
            }
            currIdx++;
        }
        record.underwriters = uws;
    }

    const findIdx = pat => data.findIndex(d => pat.test(d));

    function findDateSectionIdx(keywords) {
        for (let i = 0; i < data.length - 1; i++) {
            if (keywords.some(k => data[i].toLowerCase() === k.toLowerCase() || data[i].toLowerCase().includes(k.toLowerCase()))) {
                if (/\d{2}\s+[A-Za-z]+\s+\d{4}/.test(data[i + 1])) {
                    return i;
                }
            }
        }
        return -1;
    }

    // Parser Tanggal Penawaran Awal (Book Building)
    const bbIdx = findDateSectionIdx(["Masa Penawaran Awal", "Book Building"]);
    if (bbIdx !== -1 && bbIdx + 1 < data.length) {
        const dateRange = data[bbIdx + 1];
        const dateMatch = dateRange.match(/(\d{2}\s+[A-Za-z]+\s+\d{4})\s*-\s*(\d{2}\s+[A-Za-z]+\s+\d{4})/);
        if (dateMatch) {
            record.bb_open = formatDate(dateMatch[1]);
            record.bb_close = formatDate(dateMatch[2]);
        }
        if (bbIdx + 2 < data.length) {
            const priceRange = data[bbIdx + 2];
            const nums = priceRange.match(/\d+([.,]\d+)?/g);
            if (nums && nums.length >= 2) {
                record.bb_price_low = parseInt(nums[0].replace(/[.,]/g, ''), 10);
                record.bb_price_high = parseInt(nums[1].replace(/[.,]/g, ''), 10);
            }
        }
    }

    // Parser Tanggal Penawaran Umum (Offering) & Harga Final
    const offeringIdx = findDateSectionIdx(["Penawaran Umum", "Masa Penawaran Umum", "Offering"]);
    if (offeringIdx !== -1 && offeringIdx + 1 < data.length) {
        const dateRange = data[offeringIdx + 1];
        const dateMatch = dateRange.match(/(\d{2}\s+[A-Za-z]+\s+\d{4})\s*-\s*(\d{2}\s+[A-Za-z]+\s+\d{4})/);
        if (dateMatch) {
            record.offering_open = formatDate(dateMatch[1]);
            record.offering_close = formatDate(dateMatch[2]);
        }
        if (offeringIdx + 2 < data.length) {
            const afterOffer = data[offeringIdx + 2];
            if (!afterOffer.includes('-') && (afterOffer.includes('Rp') || /\d/.test(afterOffer))) {
                const nums = afterOffer.match(/\d+([.,]\d+)?/g);
                if (nums && nums.length >= 1) {
                    record.ipo_price = parseInt(nums[0].replace(/[.,]/g, ''), 10);
                }
            }
        }
    }

    // Parser Harga Final (Jika belum dapat atau ada label eksplisit)
    if (!record.ipo_price) {
        const ipoPriceIdx = data.findIndex(d => /Harga Penawaran|Offering Price/i.test(d));
        if (ipoPriceIdx !== -1 && ipoPriceIdx + 1 < data.length) {
            const nums = data[ipoPriceIdx + 1].match(/\d+([.,]\d+)?/g);
            if (nums && nums.length >= 1) {
                record.ipo_price = parseInt(nums[0].replace(/[.,]/g, ''), 10);
            }
        }
    }

    // Parser Tanggal Pencatatan
    const listingIdx = findDateSectionIdx(["Tanggal Pencatatan", "Listing Date"]);
    if (listingIdx !== -1 && listingIdx + 1 < data.length) {
        const dateMatch = data[listingIdx + 1].match(/(\d{2}\s+[A-Za-z]+\s+\d{4})/);
        if (dateMatch) {
            record.listing_date = formatDate(dateMatch[1]);
        }
    } else {
        const simpleIdx = data.findIndex(d => /Tanggal Pencatatan|Listing Date/i.test(d));
        if (simpleIdx !== -1 && simpleIdx + 1 < data.length) {
            record.listing_date = formatDate(data[simpleIdx + 1]);
        }
    }

    return record;
}

const MONTH_MAP = {
    januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
    juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
    jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', jun: '06', jul: '07', ags: '08', sep: '09', okt: '10', nov: '11', des: '12',
    january: '01', february: '02', march: '03', june: '06', july: '07', august: '08', december: '12'
};

function formatDate(dateStr) {
    if (!dateStr) return null;
    const clean = dateStr.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length !== 3) return null;

    const day = parts[0].padStart(2, '0');
    const monthName = parts[1].toLowerCase();
    const month = MONTH_MAP[monthName] || '01';
    const year = parts[2];

    return `${year}-${month}-${day}`;
}

async function run() {
    console.log("Memulai E-IPO Scraper (Mode Evasion / Headful)...");
    
    // Gunakan headful mode untuk mengelabui Cloudflare
    const browser = await chromium.launch({ 
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream'
        ]
    });
    
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale: 'id-ID'
        });

        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id'] });
            window.chrome = { runtime: {} };
        });

        const page = await context.newPage();
        
        const targetTicker = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2].toLowerCase() : null;
        let allLinks = [];

        if (targetTicker) {
            try {
                const fs = require('fs');
                const mappings = JSON.parse(fs.readFileSync('scratch/eipo_mappings.json', 'utf8'));
                const id = mappings[targetTicker.toUpperCase()];
                if (id) {
                    console.log(`[→] Fast-path: Langsung ke emiten ${targetTicker.toUpperCase()} (ID: ${id})...`);
                    allLinks = [`https://e-ipo.co.id/id/ipo/${id}/${targetTicker.toLowerCase()}`];
                }
            } catch (e) {}
        }

        if (allLinks.length === 0) {
            console.log(`[→] Membuka ${INDEX_URL}...`);
            await page.goto(INDEX_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
            
            try {
                await page.waitForSelector("#w0", { timeout: 15000 });
            } catch (e) {
                const content = await page.content();
                if (content.includes("cf-challenge") || (await page.title()).includes("Just a moment")) {
                    console.log("  [!] Cloudflare detected — waiting extra...");
                    await page.waitForTimeout(6000);
                    await page.waitForSelector("#w0", { timeout: 15000 });
                }
            }

            let lastPage = 1;
            try {
                const lastLink = await page.locator('ul.pagination li:last-child a, #w0 ul li:last-child a').last();
                const href = await lastLink.getAttribute('href');
                const match = href ? href.match(/page=(\d+)/) : null;
                if (match) lastPage = parseInt(match[1], 10);
            } catch (e) {}

            lastPage = Math.min(lastPage, 5);
            console.log(`[→] Scanning ${lastPage} halaman...`);

            for (let pageNum = 1; pageNum <= lastPage; pageNum++) {
                console.log(`\n[Page ${pageNum}/${lastPage}]`);
                const url = `${INDEX_URL}?page=${pageNum}&per-page=${PAGE_SIZE}`;
                await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
                await page.waitForTimeout(1000);
                
                const buttons = await page.locator('a[href*="/ipo/"]').all();
                for (const btn of buttons) {
                    const href = await btn.getAttribute('href');
                    if (href && /\/ipo\/\d+\//.test(href)) {
                        const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
                        if (!allLinks.includes(fullUrl)) {
                            allLinks.push(fullUrl);
                        }
                    }
                }
            }
        }

        console.log(`\n[→] Ditemukan ${allLinks.length} company links. Mulai scrape detail...`);

        const seenTickers = [];
        const limit = Math.min(allLinks.length, 50);
        
        for (let i = 0; i < limit; i++) {
            const link = allLinks[i];
            if (targetTicker && !link.toLowerCase().includes(targetTicker)) continue;
            console.log(`  [${i+1}/${limit}] Scraping ${link.substring(0, 60)}...`);
            
            try {
                await page.goto(link, { waitUntil: "domcontentloaded", timeout: 20000 });
                await page.waitForTimeout(1000);

                let content = "";
                try {
                    content = await page.locator('body').innerText({ timeout: 5000 });
                } catch(e) {}

                if (content) {
                    const record = parseDetailPage(content);
                    
                    const urlMatch = link.match(/\/ipo\/(\d+)\/([^\/?#]+)/);
                    if (urlMatch) {
                        const slugTicker = urlMatch[2].split('-')[0].toUpperCase();
                        if (!record.ticker || ['FAQ', 'KEMBALI', 'BERANDA'].includes(record.ticker.toUpperCase())) {
                            record.ticker = slugTicker;
                        }
                    }
                    const eipo_id = urlMatch ? parseInt(urlMatch[1], 10) : null;
                    const logo_url = eipo_id ? `https://e-ipo.co.id/id/pipeline/get-logo?id=${eipo_id}` : null;

                    if (record.ticker) {
                        seenTickers.push(record.ticker);
                        
                        const ipoPayload = {
                            ticker: record.ticker,
                            company_name: record.nama,
                            sector: record.sektor,
                            website: record.website,
                            eipo_id: eipo_id,
                            logo_url: logo_url,
                            offered_shares: record.jumlah_saham_ditawarkan,
                            public_float_pct: record.pct_total_shares,
                            bb_price_low: record.bb_price_low,
                            bb_price_high: record.bb_price_high,
                            offering_open: record.offering_open,
                            offering_close: record.offering_close,
                            bb_open: record.bb_open,
                            bb_close: record.bb_close,
                            ipo_price: record.ipo_price,
                            listing_date: record.listing_date,
                            status: record.status || "Pre-Effective",
                            underwriters: record.underwriters ? record.underwriters.join(', ') : null
                        };

                        const { data: ipo, error: dbErr } = await supabase
                            .from('ipos')
                            .upsert(ipoPayload, { onConflict: 'ticker' })
                            .select('id, ticker').single();

                        if (dbErr) {
                            console.log(`    [✗] Database Upsert Error for ${record.ticker}: ${dbErr.message}`);
                        } else {
                            console.log(`    ✓ ${ipo.ticker} | ${ipoPayload.status} | Price: Rp ${ipoPayload.ipo_price || '—'} | Offer: ${ipoPayload.offering_open || '—'} s/d ${ipoPayload.offering_close || '—'}`);
                            
                            // Sync underwriters
                            if (record.underwriters) {
                                for (const uwStr of record.underwriters) {
                                    const parts = uwStr.split(' - ');
                                    const code = parts[0]?.trim();
                                    const name = parts.slice(1).join(' - ').trim();
                                    if (code && code.length <= 6) {
                                        const role = record.underwriters.indexOf(uwStr) === 0 ? 'lead' : 'co-lead';
                                        
                                        await supabase.from('underwriters')
                                            .upsert({ broker_code: code, name: name || code }, { onConflict: 'broker_code' });

                                        await supabase.from('ipo_underwriters')
                                            .upsert({ ipo_id: ipo.id, broker_code: code, role }, { onConflict: 'ipo_id,broker_code' });
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.log(`    [✗] Failed: ${e.message}`);
            }
            await page.waitForTimeout(4000); // Tunggu 4 detik per emiten
        }

        // Sinkronisasi status listed
        if (seenTickers.length > 0 && !targetTicker) {
            console.log(`\n[→] Menyinkronkan status listed...`);
            const { data: dbIpos } = await supabase
                .from('ipos')
                .select('id, ticker, status')
                .not('status', 'eq', 'listed');

            if (dbIpos && dbIpos.length > 0) {
                const toMarkListed = dbIpos.filter(d => !seenTickers.includes(d.ticker));
                if (toMarkListed.length > 0) {
                    console.log(`[→] Menandai ${toMarkListed.length} IPO listed: ${toMarkListed.map(d => d.ticker).join(', ')}`);
                    await supabase
                        .from('ipos')
                        .update({ status: 'listed' })
                        .in('id', toMarkListed.map(d => d.id));
                }
            }
        }

    } catch (e) {
        console.error("Critical error:", e);
    } finally {
        await browser.close();
    }
}

run();
