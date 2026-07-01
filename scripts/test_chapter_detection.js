const { createClient } = require('@supabase/supabase-js');
const playwright = require('playwright');
const pdf = require('pdf-parse');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function testAll() {
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Get active IPOs
  const { data: ipos } = await supabase.from('ipos').select('ticker, website').neq('status', 'listed').limit(5);
  
  console.log("Testing chapter detection on active IPOs:");
  
  for (const ipo of ipos) {
    console.log(`\n=== Ticker: ${ipo.ticker} ===`);
    const detailUrl = ipo.website;
    if (!detailUrl) {
      console.log("  No website.");
      continue;
    }
    
    try {
      await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);
      
      let pdfUrl = null;
      const fullProspectusAnchor = page.locator('a[href*="get-propectus-file"]').filter({ has: page.locator('i.text-danger') });
      if (await fullProspectusAnchor.count() > 0) {
          const href = await fullProspectusAnchor.first().getAttribute("href");
          if (href) pdfUrl = new URL(href, "https://e-ipo.co.id").href;
      }
      
      if (!pdfUrl) {
        console.log("  No PDF URL found.");
        continue;
      }
      
      console.log(`  Downloading PDF from: ${pdfUrl}`);
      const base64Data = await page.evaluate(async (url) => {
          const response = await fetch(url);
          const blob = await response.blob();
          return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
          });
      }, pdfUrl);

      const base64Content = base64Data.split(',')[1];
      const buffer = Buffer.from(base64Content, 'base64');
      const pdfData = await pdf(buffer);
      const text = pdfData.text;
      
      const regex = /RENCANA PENGGUNAAN DANA/gi;
      let match;
      let matchedIndex = -1;
      let matchCount = 0;
      
      while ((match = regex.exec(text)) !== null) {
          matchCount++;
          const idx = match.index;
          if (idx < 15000) continue; // Skip TOC page
          
          const contextStr = text.substring(idx, idx + 200);
          if (/\.{4,}/.test(contextStr)) continue; // Skip TOC dots
          
          // Skip placeholder text pointing to Bab II
          const isPlaceholder = /dapat\s+dilihat\s+pada\s+Bab/i.test(contextStr) || 
                                /tercantum\s+dalam\s+Bab/i.test(contextStr) || 
                                /dilihat\s+pada\s+Bab/i.test(contextStr) ||
                                /tercantum\s+pada\s+Bab/i.test(contextStr);
          
          console.log(`  Match ${matchCount} at index ${idx}:`);
          console.log(`    isPlaceholder: ${isPlaceholder}`);
          console.log(`    Snippet: "${contextStr.replace(/\s+/g, ' ').substring(0, 150)}"`);
          
          if (!isPlaceholder && matchedIndex === -1) {
              matchedIndex = idx;
          }
      }
      
      if (matchedIndex !== -1) {
          console.log(`  >>> RESOLVED REAL CHAPTER INDEX: ${matchedIndex}`);
      } else {
          console.log(`  >>> FAILED TO LOCATE REAL CHAPTER`);
      }
    } catch(e) {
      console.log("  Error:", e.message);
    }
  }
  
  await browser.close();
}

testAll();
