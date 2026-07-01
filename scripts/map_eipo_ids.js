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
  console.log('=== MEMULAI PEMETAAN ID E-IPO HISTORIS ===');
  
  // Ambil semua ticker yang ada di database kita
  const { data: dbIpos } = await supabase.from('ipos').select('ticker');
  const dbTickers = new Set(dbIpos.map(i => i.ticker.toUpperCase()));
  console.log(`Total ticker di database: ${dbTickers.size}`);

  const mappingsPath = path.join(__dirname, '..', 'scratch', 'eipo_mappings.json');
  let mappings = {};
  if (fs.existsSync(mappingsPath)) {
    mappings = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
    console.log(`Loaded ${Object.keys(mappings).length} existing mappings.`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
  });
  const page = await context.newPage();

  // Pindai rentang ID e-IPO yang masuk akal
  // Emiten baru berstatus listed berkisar antara id 150 hingga 360
  const startId = 150;
  const endId = 360;

  try {
    for (let id = startId; id <= endId; id++) {
      // Lewati jika ID sudah dipetakan sebelumnya
      if (Object.values(mappings).includes(id)) {
        continue;
      }

      const url = `https://e-ipo.co.id/en/ipo/${id}`;
      console.log(`Checking ID ${id}: ${url}`);

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
        await page.waitForTimeout(600);

        // Baca teks halaman untuk mencari ticker
        let bodyText = "";
        try {
          bodyText = await page.locator('body').innerText();
        } catch {
          continue;
        }

        const lines = bodyText.split('\n').map(l => l.trim()).filter(Boolean);
        
        // Cari ticker yang cocok dengan database kita
        let foundTicker = null;
        for (const line of lines) {
          if (dbTickers.has(line.toUpperCase()) && line.length <= 5) {
            foundTicker = line.toUpperCase();
            break;
          }
        }

        // Fallback: Cari di URL jika dialihkan
        const finalUrl = page.url();
        const urlMatch = finalUrl.match(/\/ipo\/\d+\/([a-zA-Z0-9]+)-/);
        if (urlMatch && dbTickers.has(urlMatch[1].toUpperCase())) {
          foundTicker = urlMatch[1].toUpperCase();
        }

        if (foundTicker) {
          mappings[foundTicker] = id;
          console.log(`  [+] MATCH: Ticker ${foundTicker} -> ID ${id}`);
          fs.writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2));
        }

      } catch (e) {
        console.log(`  [-] Skip ID ${id}: ${e.message}`);
      }
    }

    console.log(`\n[✓] Pemetaan selesai! Total terpetakan: ${Object.keys(mappings).length}`);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
