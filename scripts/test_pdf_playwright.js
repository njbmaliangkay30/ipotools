const { chromium } = require('playwright');
const pdf = require('pdf-parse');

async function testSingle() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      locale: "en-US",
      javaScriptEnabled: true,
  });

  await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      window.chrome = { runtime: {} };
  });

  const page = await context.newPage();
  
  // Go to details page of EMMI to set all cookies/headers properly!
  const detailUrl = "https://e-ipo.co.id/en/ipo/351/emmi-pt-esa-medika-mandiri-tb";
  console.log("Navigating to:", detailUrl);
  await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  const pdfUrl = "https://e-ipo.co.id/en/pipeline/get-propectus-file?id=351&type=prospectus_aktif";
  console.log("Downloading prospectus via page.evaluate...");
  
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
  }, pdfUrl);

  const base64Content = base64Data.split(',')[1];
  const buffer = Buffer.from(base64Content, 'base64');
  
  console.log("Parsing PDF...");
  const pdfData = await pdf(buffer);
  const text = pdfData.text;

  const cleanText = text.replace(/\s+/g, ' ');
  console.log("Total length:", cleanText.length);

  const modalDasarIndex = cleanText.search(/Modal\s*Dasar/i);
  const nilaiNominalIndex = cleanText.search(/Nilai\s*Nominal/i);
  const permIndex = cleanText.search(/Struktur\s*Permodalan/i);
  
  console.log("modalDasarIndex:", modalDasarIndex);
  console.log("nilaiNominalIndex:", nilaiNominalIndex);
  console.log("permIndex:", permIndex);

  // Let's print out what is around modalDasarIndex or nilaiNominalIndex if found
  if (modalDasarIndex !== -1) {
      console.log("\n--- Near Modal Dasar ---");
      console.log(cleanText.substring(modalDasarIndex - 100, modalDasarIndex + 500));
  }
  if (nilaiNominalIndex !== -1) {
      console.log("\n--- Near Nilai Nominal ---");
      console.log(cleanText.substring(nilaiNominalIndex - 100, nilaiNominalIndex + 500));
  }
  if (permIndex !== -1) {
      console.log("\n--- Near Struktur Permodalan ---");
      console.log(cleanText.substring(permIndex - 100, permIndex + 500));
  }

  let paragraph = '';
  if (nilaiNominalIndex !== -1) {
      const start = Math.max(0, nilaiNominalIndex - 100);
      paragraph = cleanText.substring(start, nilaiNominalIndex + 500);
  } else if (modalDasarIndex !== -1) {
      const start = Math.max(0, modalDasarIndex - 300);
      paragraph = cleanText.substring(start, modalDasarIndex + 600);
  }

  if (paragraph) {
      const rpValues = [...paragraph.matchAll(/Rp\s?([\d\.]+(?:,\d+)?)/g)]
          .map(m => parseFloat(m[1].replace(/\./g, '').replace(',', '.')))
          .filter(v => v > 0);

      console.log("\nrpValues found:", rpValues);

      if (rpValues.length > 0) {
          const smallest = Math.min(...rpValues);
          console.log("smallest:", smallest);

          const contextPattern = new RegExp(`Rp\\s?[\\d\\.]+${smallest % 1 !== 0 ? ',\\d+' : ''}[^.]*?(per\\s*saham|nilai\\s*nominal)`, 'i');
          const contextMatch = paragraph.match(contextPattern);
          console.log("contextPattern:", contextPattern);
          console.log("contextMatch found:", !!contextMatch);

          const explicitMatch = paragraph.match(/dengan\s+nilai\s+nominal\s+Rp\s?([\d\.]+)/i);
          console.log("explicitMatch:", explicitMatch);
      }
  }
  
  await browser.close();
}

testSingle();
