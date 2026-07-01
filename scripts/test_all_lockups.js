const { chromium } = require('playwright');
const pdf = require('pdf-parse');

const ipos = [
  { ticker: 'RANS', id: 354 },
  { ticker: 'BACH', id: 353 },
  { ticker: 'JECX', id: 352 },
  { ticker: 'EMMI', id: 351 },
  { ticker: 'PRDL', id: 350 },
  { ticker: 'JELI', id: 349 },
  { ticker: 'WBSA', id: 348 },
  { ticker: 'SUPA', id: 347 },
  { ticker: 'RLCO', id: 346 },
  { ticker: 'PJHB', id: 345 }
];

async function testAll() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  for (const ipo of ipos) {
      console.log(`\n=================== Testing ${ipo.ticker} ===================`);
      const page = await context.newPage();
      try {
          const detailUrl = `https://e-ipo.co.id/en/ipo/${ipo.id}/some-slug`;
          await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
          await page.waitForTimeout(1000);

          const pdfUrl = `https://e-ipo.co.id/en/pipeline/get-propectus-file?id=${ipo.id}&type=prospectus_aktif`;
          const base64Data = await page.evaluate(async (url) => {
              const response = await fetch(url);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
          const cleanText = text.replace(/\s+/g, ' ');

          // Candidate selection logic
          let adaLockup = false;
          let lockupMonths = null;
          const lockupSegmentRegex = /(?:pembatasan\s+atas\s+saham|dilarang\s+untuk\s+mengalihkan|lock[- ]?up|POJK\s*No\.?\s*25\/POJK\.04\/2017)[\s\S]{0,800}?(\d+)\s*(?:\([^)]*\)\s*)?bulan/gi;
          
          const candidates = [];
          let matchLock;
          while ((matchLock = lockupSegmentRegex.exec(cleanText)) !== null) {
              const months = parseInt(matchLock[1], 10);
              if (months <= 12) {
                  candidates.push(months);
              }
          }

          if (candidates.length === 0) {
              const fallbackRegex = /(?:pembatasan|dilarang\s+mengalihkan|lock[- ]?up)[\s\S]{0,300}?selama\s+(\d+)\s*(?:\([^)]*\)\s*)?bulan/gi;
              while ((matchLock = fallbackRegex.exec(cleanText)) !== null) {
                  const months = parseInt(matchLock[1], 10);
                  if (months <= 12) {
                      candidates.push(months);
                  }
              }
          }

          if (candidates.length > 0) {
              adaLockup = true;
              if (candidates.includes(12)) {
                  lockupMonths = 12;
              } else if (candidates.includes(8)) {
                  lockupMonths = 8;
              } else {
                  lockupMonths = candidates[0];
              }
          }

          console.log(`Result for ${ipo.ticker}: adaLockup=${adaLockup}, lockupMonths=${lockupMonths}, candidates=[${candidates.join(', ')}]`);
      } catch (err) {
          console.error(`Error ${ipo.ticker}:`, err.message);
      } finally {
          await page.close();
      }
  }

  await browser.close();
}

testAll();
