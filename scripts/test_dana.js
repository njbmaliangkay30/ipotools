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
  
  const detailUrl = "https://e-ipo.co.id/en/ipo/354/rans-pt-rans-entertainmen-ind";
  console.log("Navigating to:", detailUrl);
  await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2000);

  const pdfUrl = "https://e-ipo.co.id/en/pipeline/get-propectus-file?id=354&type=prospectus_aktif";
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

  // New Detection Logic
  let danaHeaderIdx = -1;
  const regex = /RENCANA PENGGUNAAN DANA/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
      const idx = match.index;
      if (idx < 15000) continue; // Bypass Table of Contents
      
      const context = text.substring(idx, idx + 200);
      if (/\.{4,}/.test(context)) continue; // Bypass TOC dots
      
      danaHeaderIdx = idx;
      break;
  }

  console.log("Detected danaHeaderIdx:", danaHeaderIdx);

  if (danaHeaderIdx !== -1) {
      const rawDanaChunk = text.substring(danaHeaderIdx, danaHeaderIdx + 4000);
      
      // Let's split by double newline first, and see
      const paragraphs = rawDanaChunk.split(/\n{2,}/);
      console.log("\nParagraph count (\\n{2,}):", paragraphs.length);
      
      const items = [];
      for (const p of paragraphs) {
          const trimmed = p.trim();
          if (!trimmed) continue;
          
          if (/%/.test(trimmed) || /Rp\s?[\d\.]+/i.test(trimmed)) {
              items.push(trimmed.replace(/\s+/g, ' '));
          }
      }
      
      console.log("Found items count:", items.length);
      items.forEach((item, idx) => {
          console.log(`\n=== Item ${idx} Full ===`);
          console.log(item);
      });

      // If no items, test splitting by single newline and taking lines with numbers >= 1000
      if (items.length === 0) {
          console.log("\nTrying fallback to single newline lines...");
          const allLines = rawDanaChunk.split(/\n/);
          const numberLines = allLines.filter(line => /\d{4,}/.test(line));
          console.log("Fallback items count:", numberLines.length);
          numberLines.slice(0, 5).forEach((item, idx) => {
              console.log(`Fallback Item ${idx}: ${item.trim()}`);
          });
      }
  }
  
  await browser.close();
}

testSingle();
