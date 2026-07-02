require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const fs = require('fs');
const pdf = require('pdf-parse');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Bisa menerima satu tahun '2026' atau multiple '2024,2025,2026'
const yearsInput = process.argv[2] || '2026';
const targetYears = yearsInput.split(',');

const FIELD_PATTERNS = {
    ticker: /A1\s*Stock Code\s*(\S+)/i,
    company_name: /A2\s*Company Name\s*(.+?)(?:\n|A3)/i,
    ipo_price: /B1\s*IPO Price\s*([\d,.]+)\s*IDR/i,
    offered_shares: /B3\s*Offered Shares\s*([\d,.]+)\s*Shares/i,
    subscribed_shares: /B10\s*Subscribed Shares\s*([\d,.]+)\s*Shares/i,
    os_ratio: /B12\s*Oversubscription Ratio\s*([\d.,]+)/i,
    listing_date: /B23\s*Stock Listing Date\s*(\S+)/i,
    listing_board: /D1\s*Listing Board\s*(\S+)/i,
    sector: /D6\s*Sector\s*(.+?)(?:\n|D7)/i,
    has_warrant: /E6\s*Offered Warrants\s*(\d+)\s*Warrants/i,
    pct_working_cap: /FO1\s*IPO_Working Capital\s*([\d.,]+)%/i,
    pct_capex: /FO2\s*IPO_Capital Expenditure\s*([\d.,]+)%/i,
    pct_subsidiaries: /FO3\s*IPO_Participation in Subsidiaries\s*([\d.,]+)%/i,
    pct_debt_payment: /FO4\s*IPO_Debt Payment\s*([\d.,]+)%/i,
    pct_expansion: /FO5\s*IPO_Expansion\s*([\d.,]+)%/i,
    pct_acquisition: /FO6\s*IPO_Acquisition\s*([\d.,]+)%/i,
    uw1_pct: /GU1\s*Underwriter1\s*([\d.,]+)%\s*\|/i,
    uw1_name: /GU1\s*Underwriter1\s*[\d.,]+%\s*\|(.+?)(?:\n|GU2)/i,
    public_pct: /SHIP\s*Public Shares\s*([\d.,]+)%/i,
    par_value: /SH2\s*Par Value\s*([\d.,]+)/i,
    
    // New Benchmark fields
    shareholders_count: /B13\s*Shareholders Through IPO\s*([\d,.]+)\s*Parties/i,
    sector_per: /D10\s*Sector PER\s*([\d.,\-]+)/i,
    sector_pbv: /D11\s*Sector PBV\s*([\d.,\-]+)/i,
    subsector_per: /D12\s*Sub Sector PER\s*([\d.,\-]+)/i,
    subsector_pbv: /D13\s*Sub Sector PBV\s*([\d.,\-]+)/i,
};

function cleanNum(val) {
    if (!val) return null;
    let cleaned = val.trim();
    if (cleaned.includes('.') && cleaned.includes(',')) {
        if (cleaned.indexOf(',') > cleaned.indexOf('.')) {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            cleaned = cleaned.replace(/,/g, '');
        }
    } else if (cleaned.includes(',')) {
        if (/(,\d{3})+$/.test(cleaned)) {
            cleaned = cleaned.replace(/,/g, '');
        } else {
            cleaned = cleaned.replace(',', '.');
        }
    } else if (cleaned.includes('.')) {
        if (/(\.\d{3})+$/.test(cleaned)) {
            cleaned = cleaned.replace(/\./g, '');
        }
    }
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

async function run() {
    let results = [];
    const browser = await chromium.launch({ headless: true });
    
    try {
        const context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale: "en-US",
            ignoreHTTPSErrors: true
        });

        const page = await context.newPage();
        
        for (const targetYear of targetYears) {
            console.log(`\n=== Memproses Tahun ${targetYear} ===`);
            await page.goto("https://www.idx.co.id/en/market-data/statistical-reports/new-listing-information/", { waitUntil: 'networkidle', timeout: 45000 });
            await page.waitForTimeout(5000); 
            
            let found = false;
            const currentYearEls = await page.$$('text="2026"');
            for (const el of currentYearEls) {
                const isVisible = await el.isVisible();
                if (isVisible) {
                    await el.click({ force: true });
                    await page.waitForTimeout(1000);
                    
                    const targetYearEls = await page.$$(`text="${targetYear}"`);
                    for (const target of targetYearEls) {
                        if (await target.isVisible()) {
                            await target.click({ force: true });
                            found = true;
                            break;
                        }
                    }
                    if (found) break;
                }
            }
            
            if (found) {
                await page.waitForTimeout(5000);
            }

            let pdfUrls = await page.$$eval('a', anchors => {
                return anchors
                    .filter(a => a.href && (a.href.toLowerCase().includes('.pdf') || a.textContent.toLowerCase().includes('listing information')))
                    .map(a => ({
                        url: a.href,
                        title: a.textContent.trim() || 'Unknown IPO PDF'
                    }));
            });
            
            pdfUrls = [...new Map(pdfUrls.map(item => [item.url, item])).values()];
            pdfUrls = pdfUrls.filter(item => item.url.toLowerCase().includes('.pdf') || item.url.includes('/Portals/'));

            const targetPdfs = pdfUrls;
            
            for (const item of targetPdfs) {
                try {
                    const base64Data = await page.evaluate(async (url) => {
                        const response = await fetch(url);
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        const blob = await response.blob();
                        
                        return new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        });
                    }, item.url);
                    
                    const base64Content = base64Data.split(',')[1];
                    const dataBuffer = Buffer.from(base64Content, 'base64');
                    const pdfData = await pdf(dataBuffer);
                    const text = pdfData.text;
                    
                    const record = {};
                    for (const [field, regex] of Object.entries(FIELD_PATTERNS)) {
                        const match = text.match(regex);
                        record[field] = (match && match[1]) ? match[1].trim() : null;
                    }
                    
                    let insiderCost = cleanNum(record.par_value);
                    
                    const osRatio = cleanNum(record.os_ratio);
                    const ipoPrice = cleanNum(record.ipo_price);
                    const publicPct = cleanNum(record.public_pct);
                    
                    if (record.ticker) {
                      const { data: ipo, error: ipoError } = await supabase
                        .from('ipos')
                        .upsert({
                          ticker: record.ticker,
                          company_name: record.company_name || 'Unknown',
                          sector: record.sector,
                          listing_board: record.listing_board,
                          ipo_price: ipoPrice,
                          public_float_pct: publicPct,
                          pct_working_cap: cleanNum(record.pct_working_cap),
                          pct_acquisition: cleanNum(record.pct_acquisition),
                          listing_date: record.listing_date ? new Date(record.listing_date) : null,
                          status: 'listed'
                        }, { onConflict: 'ticker' })
                        .select('id')
                        .single();
            
                      if (ipo && !ipoError) {
                         await supabase
                          .from('ipo_signals')
                          .upsert({
                            ipo_id: ipo.id,
                            os_ratio: osRatio,
                            sector_per: cleanNum(record.sector_per),
                            sector_pbv: cleanNum(record.sector_pbv),
                            subsector_per: cleanNum(record.subsector_per),
                            subsector_pbv: cleanNum(record.subsector_pbv),
                            shareholders_count: cleanNum(record.shareholders_count)
                          }, { onConflict: 'ipo_id' });

                         if (insiderCost) {
                            await supabase
                              .from('ipo_insider_risk')
                              .upsert({
                                ipo_id: ipo.id,
                                harga_perolehan_insider: insiderCost
                              }, { onConflict: 'ipo_id' });
                         }
                      }
                    }
            
                    results.push({
                        year: targetYear,
                        ticker: record.ticker,
                        company: record.company_name,
                        os_ratio: osRatio,
                        status: record.ticker ? 'Success' : 'Failed'
                    });
                    
                } catch (error) {
                    // Ignore
                }
            }
        } // End year loop
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
        console.log(`\n__RESULT__=${JSON.stringify({ success: true, count: results.length, data: results })}\n`);
    }
}

run();
