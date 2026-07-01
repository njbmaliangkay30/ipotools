const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

const FIELD_PATTERNS = {
    // Company
    ticker: /A1\s*Stock Code\s*(\S+)/i,
    company_name: /A2\s*Company Name\s*(.+?)(?:\n|A3)/i,

    // IPO
    ipo_price: /B1\s*IPO Price\s*([\d,]+)\s*IDR/i,
    offered_shares: /B3\s*Offered Shares\s*([\d,]+)\s*Shares/i,
    subscribed_shares: /B10\s*Subscribed Shares\s*([\d,]+)\s*Shares/i,
    os_ratio: /B12\s*Oversubscription Ratio\s*([\d.]+)\s*X/i,
    listing_date: /B23\s*Stock Listing Date\s*(\S+)/i,

    // Classification
    listing_board: /D1\s*Listing Board\s*(\S+)/i,
    sector: /D6\s*Sector\s*(.+?)(?:\n|D7)/i,

    // Warrant
    has_warrant: /E6\s*Offered Warrants\s*(\d+)\s*Warrants/i,

    // Use of funds (persen)
    pct_working_cap: /FO1\s*IPO_Working Capital\s*([\d.]+)%/i,
    pct_capex: /FO2\s*IPO_Capital Expenditure\s*([\d.]+)%/i,
    pct_subsidiaries: /FO3\s*IPO_Participation in Subsidiaries\s*([\d.]+)%/i,
    pct_debt_payment: /FO4\s*IPO_Debt Payment\s*([\d.]+)%/i,
    pct_expansion: /FO5\s*IPO_Expansion\s*([\d.]+)%/i,
    pct_acquisition: /FO6\s*IPO_Acquisition\s*([\d.]+)%/i,

    // Underwriters
    uw1_pct: /GU1\s*Underwriter1\s*([\d.]+)%\s*\|/i,
    uw1_name: /GU1\s*Underwriter1\s*[\d.]+%\s*\|(.+?)(?:\n|GU2)/i,
    
    // Free float
    public_pct: /SHIP\s*Public Shares\s*([\d.]+)%/i,
};

function cleanNum(val) {
    if (!val) return null;
    const cleaned = val.replace(/,/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

async function testNLI() {
    console.log("==========================================");
    console.log("NLI PDF PARSER TEST (Node.js) - WITH FIXED REGEX");
    console.log("==========================================");

    const pdfPath = path.join(__dirname, 'nli-241219_mdiy_m.pdf');
    
    try {
        console.log(`[1] Membaca PDF NLI lokal: ${pdfPath}`);
        const dataBuffer = fs.readFileSync(pdfPath);
        
        console.log(`[2] PDF berhasil dibaca (${dataBuffer.length} bytes). Memulai parsing...`);
        
        const data = await pdf(dataBuffer);
        const text = data.text;
        
        console.log(`[3] Teks berhasil diekstrak (${text.length} karakter). Mencari data...`);
        console.log("------------------------------------------");
        
        const record = {};
        for (const [field, regex] of Object.entries(FIELD_PATTERNS)) {
            const match = text.match(regex);
            if (match && match[1]) {
                record[field] = match[1].trim();
            } else {
                record[field] = null;
            }
        }
        
        // Clean numeric fields
        record.os_ratio = cleanNum(record.os_ratio);
        record.ipo_price = cleanNum(record.ipo_price);
        record.public_pct = cleanNum(record.public_pct);
        record.pct_debt_payment = cleanNum(record.pct_debt_payment);
        
        console.log(JSON.stringify(record, null, 2));
        
        if (record.os_ratio) {
            console.log("✅ BERHASIL: Oversubscription Ratio terdeteksi!");
        } else {
            console.log("❌ GAGAL: Oversubscription Ratio tidak ditemukan. Format PDF mungkin berbeda atau bukan PDF NLI valid.");
        }
        
    } catch (error) {
        console.error("Terjadi kesalahan:", error.stack);
    }
}

testNLI();
