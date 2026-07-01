const { chromium } = require('playwright');
const pdf = require('pdf-parse');

async function testSingle() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Go to main page first to get session
  await page.goto("https://e-ipo.co.id/en/ipo/index", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const pdfUrl = "https://e-ipo.co.id/en/pipeline/get-propectus-file?id=354&type=prospectus_aktif";
  console.log("Downloading via page.evaluate...");
  
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
  console.log("modalDasarIndex:", modalDasarIndex);
  console.log("nilaiNominalIndex:", nilaiNominalIndex);

  let paragraph = '';
  if (modalDasarIndex !== -1) {
      paragraph = cleanText.substring(modalDasarIndex, modalDasarIndex + 600);
  } else if (nilaiNominalIndex !== -1) {
      paragraph = cleanText.substring(nilaiNominalIndex, nilaiNominalIndex + 400);
  }

  console.log("\n--- Paragraph Extracted ---");
  console.log(paragraph);

  if (paragraph) {
      const rpValues = [...paragraph.matchAll(/Rp\s?([\d\.]+(?:,\d+)?)/g)]
          .map(m => parseFloat(m[1].replace(/\./g, '').replace(',', '.')))
          .filter(v => v > 0);

      console.log("\nrpValues:", rpValues);

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
