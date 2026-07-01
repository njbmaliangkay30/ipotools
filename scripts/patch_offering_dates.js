require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const EMITEN_TARGET = [
  { ticker: 'JELI', id: 349 },
  { ticker: 'PRDL', id: 350 },
  { ticker: 'JECX', id: 352 }
];

async function run() {
  console.log('=== MEMULAI UPDATE TANGGAL PENAWARAN AKTIF ===');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    for (const emi of EMITEN_TARGET) {
      console.log(`Checking ${emi.ticker} (e-IPO ID: ${emi.id})...`);
      const url = `https://e-ipo.co.id/en/ipo/${emi.id}`;
      
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);

      // Cari elemen tanggal penawaran umum (Offering Period)
      // Di e-IPO biasanya tertulis: "Offering Period : 26 Jun 2026 - 30 Jun 2026"
      const bodyText = await page.locator('body').innerText();
      
      const offeringMatch = bodyText.match(/Offering Period\s*:\s*(\d{1,2}\s+[a-zA-Z]+\s+\d{4})\s*-\s*(\d{1,2}\s+[a-zA-Z]+\s+\d{4})/i);
      
      if (offeringMatch) {
        const startStr = offeringMatch[1].trim();
        const endStr = offeringMatch[2].trim();
        
        console.log(`  [+] Found dates for ${emi.ticker}: ${startStr} - ${endStr}`);
        
        // Konversi format tanggal "26 Jun 2026" -> "2026-06-26"
        const parseEipoDate = (str) => {
          const months = {
            jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
            jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
          };
          const parts = str.split(/\s+/);
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = months[parts[1].toLowerCase().substring(0, 3)];
            const year = parts[2];
            return `${year}-${month}-${day}`;
          }
          return null;
        };

        const openDate = parseEipoDate(startStr);
        const closeDate = parseEipoDate(endStr);

        if (openDate && closeDate) {
          // Update database
          const todayStr = new Date().toISOString().split('T')[0];
          
          // Tentukan status dinamis
          let newStatus = 'waiting for offering';
          if (todayStr >= openDate && todayStr <= closeDate) {
            newStatus = 'offering';
          } else if (todayStr > closeDate) {
            newStatus = 'pre-effective'; // atau listed jika sudah listing
          }

          const { error } = await supabase
            .from('ipos')
            .update({
              offering_open: openDate,
              offering_close: closeDate,
              status: newStatus,
              updated_at: new Date().toISOString()
            })
            .eq('ticker', emi.ticker);

          if (error) {
            console.log(`  [✗] Gagal mengupdate DB untuk ${emi.ticker}: ${error.message}`);
          } else {
            console.log(`  [✓] DB updated: status=${newStatus}, offering=${openDate} s/d ${closeDate}`);
          }
        }
      } else {
        console.log(`  [-] Tanggal penawaran umum untuk ${emi.ticker} belum ditemukan di halaman.`);
      }
    }
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
