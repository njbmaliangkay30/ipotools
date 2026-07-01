require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log('=== MEMULAI PEMETAAN ID E-IPO CEPAT ===');
  
  // Ambil semua ticker di DB
  const { data: dbIpos } = await supabase.from('ipos').select('ticker');
  const dbTickers = new Set(dbIpos.map(i => i.ticker.toUpperCase()));
  console.log(`Total ticker di database: ${dbTickers.size}`);

  const mappingsPath = path.join(__dirname, '..', 'scratch', 'eipo_mappings.json');
  let mappings = {};
  if (fs.existsSync(mappingsPath)) {
    mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    // Pindai 6 halaman pertama indeks (6 * 12 = 72 emiten teratas)
    for (let pageNum = 1; pageNum <= 6; pageNum++) {
      const url = `https://e-ipo.co.id/en/ipo/index?page=${pageNum}&per-page=12`;
      console.log(`Reading index page ${pageNum}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);

      // Cari semua link detail IPO
      const cards = await page.locator('a[href*="/ipo/"]').all();
      for (const card of cards) {
        const href = await card.getAttribute('href');
        if (href) {
          // Pola link: /en/ipo/255/doss-pt-global-...
          const match = href.match(/\/ipo\/(\d+)\/([a-zA-Z0-9]+)-/);
          if (match) {
            const id = parseInt(match[1], 10);
            const ticker = match[2].toUpperCase();
            
            if (dbTickers.has(ticker)) {
              mappings[ticker] = id;
              console.log(`  [+] Ticker: ${ticker} -> ID: ${id}`);
            }
          }
        }
      }
    }

    fs.writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2));
    console.log(`\n[✓] Pemetaan Cepat Selesai! Total terpetakan: ${Object.keys(mappings).length}/${dbTickers.size}`);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
