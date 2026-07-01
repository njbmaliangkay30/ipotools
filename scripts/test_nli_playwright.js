const { chromium } = require('playwright');
const fs = require('fs');
const pdf = require('pdf-parse');

const FIELD_PATTERNS = {
    // Company
    ticker: /A1\s*Stock Code\s*(\S+)/i,
    company_name: /A2\s*Company Name\s*(.+?)(?:\n|A3)/i,

    // IPO
    ipo_price: /B1\s*IPO Price\s*([\d,.]+)\s*IDR/i,
    offered_shares: /B3\s*Offered Shares\s*([\d,.]+)\s*Shares/i,
    subscribed_shares: /B10\s*Subscribed Shares\s*([\d,.]+)\s*Shares/i,
    
    // UPDATED REGEX: Remove trailing 'X' because some IPOs don't include it or have different format
    os_ratio: /B12\s*Oversubscription Ratio\s*([\d.,]+)/i,
    
    listing_date: /B23\s*Stock Listing Date\s*(\S+)/i,

    // Classification
    listing_board: /D1\s*Listing Board\s*(\S+)/i,
    sector: /D6\s*Sector\s*(.+?)(?:\n|D7)/i,

    // Warrant
    has_warrant: /E6\s*Offered Warrants\s*(\d+)\s*Warrants/i,

    // Use of funds (persen)
    pct_working_cap: /FO1\s*IPO_Working Capital\s*([\d.,]+)%/i,
    pct_capex: /FO2\s*IPO_Capital Expenditure\s*([\d.,]+)%/i,
    pct_subsidiaries: /FO3\s*IPO_Participation in Subsidiaries\s*([\d.,]+)%/i,
    pct_debt_payment: /FO4\s*IPO_Debt Payment\s*([\d.,]+)%/i,
    pct_expansion: /FO5\s*IPO_Expansion\s*([\d.,]+)%/i,
    pct_acquisition: /FO6\s*IPO_Acquisition\s*([\d.,]+)%/i,

    // Underwriters
    uw1_pct: /GU1\s*Underwriter1\s*([\d.,]+)%\s*\|/i,
    uw1_name: /GU1\s*Underwriter1\s*[\d.,]+%\s*\|(.+?)(?:\n|GU2)/i,
    
    // Free float
    public_pct: /SHIP\s*Public Shares\s*([\d.,]+)%/i,
};

function cleanNum(val) {
    if (!val) return null;
    let cleaned = val.trim();
    
    // Handle Indonesian format (e.g. 39,59) vs English format (e.g. 3,900.50)
    if (cleaned.includes('.') && cleaned.includes(',')) {
        if (cleaned.indexOf(',') > cleaned.indexOf('.')) {
            // e.g. 1.000,50
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            // e.g. 1,000.50
            cleaned = cleaned.replace(/,/g, '');
        }
    } else if (cleaned.includes(',')) {
        // if only contains comma, we assume it's decimal like 39,59
        cleaned = cleaned.replace(',', '.');
    }
    
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

async function scrapeAndParse() {
    console.log("============================================================");
    console.log("IDX NLI SCRAPER (DOM Extraction + Click 2025)");
    console.log("============================================================");

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale: "en-US",
        ignoreHTTPSErrors: true
    });

    const page = await context.newPage();

    console.log("\n[1] Membuka website IDX...");
    try {
        await page.goto("https://www.idx.co.id/en/market-data/statistical-reports/new-listing-information/", { waitUntil: 'networkidle', timeout: 45000 });
        await page.waitForTimeout(5000); 
    } catch (e) {
        console.log("    Timeout navigasi...", e.message);
    }
    
    // Try to click the 2026 dropdown and select 2025
    try {
        console.log("    Mencoba mencari filter tahun dan memilih 2025...");
        
        let found = false;
        // 1. Try standard select if any
        const standardSelects = await page.$$('select');
        for (const select of standardSelects) {
            const text = await select.textContent();
            if (text.includes('2025')) {
                await select.selectOption({ label: '2025' });
                found = true;
                break;
            }
        }
        
        // 2. Try clicking text '2026' then '2025'
        if (!found) {
            const currentYearEls = await page.$$('text="2026"');
            for (const el of currentYearEls) {
                const isVisible = await el.isVisible();
                if (isVisible) {
                    await el.click({ force: true });
                    await page.waitForTimeout(1000);
                    
                    const targetYearEls = await page.$$('text="2025"');
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
        }
        
        if (found) {
            console.log("    [+] Berhasil memilih tahun 2025. Menunggu tabel ter-render ulang...");
            await page.waitForTimeout(5000);
        } else {
            console.log("    [-] Gagal menemukan elemen 2026/2025 yang bisa di-klik.");
        }
    } catch (e) {
        console.log("    [-] Gagal mencoba berinteraksi dengan filter tahun: " + e.message);
    }

    let pdfUrls = [];
    try {
        const links = await page.$$eval('a', anchors => {
            return anchors
                .filter(a => a.href && (a.href.toLowerCase().includes('.pdf') || a.textContent.toLowerCase().includes('listing information')))
                .map(a => ({
                    url: a.href,
                    title: a.textContent.trim() || 'Unknown IPO PDF'
                }));
        });
        
        pdfUrls.push(...links);
    } catch (e) {
        console.log("    Gagal mengekstrak dari DOM:", e.message);
    }
    
    pdfUrls = [...new Map(pdfUrls.map(item => [item.url, item])).values()];
    pdfUrls = pdfUrls.filter(item => item.url.toLowerCase().includes('.pdf') || item.url.includes('/Portals/'));

    if (pdfUrls.length === 0) {
        console.log("\n❌ Tidak ada link PDF yang berhasil ditemukan dari halaman web.");
        await browser.close();
        return;
    }

    console.log(`\n[2] Ditemukan ${pdfUrls.length} file PDF NLI.`);
    
    // Test up to 3 items
    const targetPdfs = pdfUrls.slice(0, 3);
    
    for (let i = 0; i < targetPdfs.length; i++) {
        const item = targetPdfs[i];
        console.log(`\n------------------------------------------`);
        console.log(`[File ${i+1}] ${item.title}`);
        console.log(`URL: ${item.url}`);
        
        try {
            const base64Data = await page.evaluate(async (url) => {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
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
            console.log(`    Downloaded: ${dataBuffer.length} bytes`);
            
            const pdfData = await pdf(dataBuffer);
            const text = pdfData.text;
            
            const record = {};
            for (const [field, regex] of Object.entries(FIELD_PATTERNS)) {
                const match = text.match(regex);
                if (match && match[1]) {
                    record[field] = match[1].trim();
                } else {
                    record[field] = null;
                }
            }
            
            record.os_ratio = cleanNum(record.os_ratio);
            record.ipo_price = cleanNum(record.ipo_price);
            record.public_pct = cleanNum(record.public_pct);
            record.pct_debt_payment = cleanNum(record.pct_debt_payment);
            record.pct_working_cap = cleanNum(record.pct_working_cap);
            record.pct_acquisition = cleanNum(record.pct_acquisition);
            
            console.log(`\n    Extracted Data:`);
            console.log(JSON.stringify(record, null, 2));
            
            if (record.ticker) {
                console.log(`    ✅ BERHASIL: Data ${record.ticker} diekstrak.`);
                if (record.os_ratio) {
                    console.log(`    ✅ OVERSUB RATIO: ${record.os_ratio}`);
                }
            } else {
                console.log(`    ❌ GAGAL: Data tidak dapat diekstrak.`);
            }
            
        } catch (error) {
            console.error(`    ❌ Gagal mengunduh/memproses PDF: ${error.message}`);
        }
    }
    
    await browser.close();
}

scrapeAndParse();
