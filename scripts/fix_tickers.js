require('dotenv').config({ path: '.env.local' });
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const pdf = require('pdf-parse');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function fixTickers() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ userAgent: "Mozilla/5.0" });
  const page = await context.newPage();

  const tickers = [{ t: 'JELI', id: 349 }, { t: 'PRDL', id: 350 }, { t: 'RANS', id: 354 }];
  
  for (const t of tickers) {
    console.log(`Processing ${t.t}...`);
    await page.goto(`https://e-ipo.co.id/en/ipo/${t.id}/detail`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000); // bypass CF manually or just wait
    
    // get pdf URL
    const pdfUrl = `https://e-ipo.co.id/en/pipeline/get-propectus-file?id=${t.id}&type=`;
    
    try {
        const base64Data = await page.evaluate(async (url) => {
            const response = await fetch(url);
            if (!response.ok) return null;
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        }, pdfUrl);
        
        if (!base64Data) continue;

        const base64Content = base64Data.split(',')[1];
        const dataBuffer = Buffer.from(base64Content, 'base64');
        const pdfData = await pdf(dataBuffer);
        const text = pdfData.text;

        const permIndex = text.indexOf("Struktur Permodalan");
        let searchContext = permIndex !== -1 ? text.substring(permIndex, permIndex + 8000) : text.substring(0, 10000);
        
        // STRICT REGEX
        const strictRegex = /(?:Nilai\s*Nominal)?\s*Rp\s?(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(?:,-\s*)?(?:\([^)]+\)\s*)?(?:per|setiap)\s?saham/i;
        
        let match = searchContext.match(strictRegex);
        if (!match) match = text.match(strictRegex);
        
        if (match && match[1]) {
            const insiderCost = parseInt(match[1].replace(/\./g, ''), 10);
            console.log(`${t.t} -> Nominal: Rp ${insiderCost}`);
            
            // get ipo id
            const { data: ipo } = await supabase.from('ipos').select('id').eq('ticker', t.t).single();
            if (ipo) {
                await supabase.from('ipo_insider_risk').update({ harga_perolehan_insider: insiderCost }).eq('ipo_id', ipo.id);
                console.log(`Updated ${t.t} in DB!`);
            }
        } else {
            console.log(`${t.t} -> NO MATCH FOUND!`);
        }
    } catch(e) {
        console.error("Error for", t.t, e.message);
    }
  }
  await browser.close();
}
fixTickers();
