const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const pdfPath = path.join(__dirname, '..', 'scratch', 'pdf', 'LABS.pdf');
const buf = fs.readFileSync(pdfPath);

pdf(buf).then(parsed => {
  const clean = parsed.text.replace(/\s+/g, ' ');
  const term = "PENGGUNAAN DANA YANG DIPEROLEH DARI HASIL PENAWARAN UMUM";
  
  let idx = -1;
  let searchStart = 0;
  let occurrence = 1;
  
  while ((idx = clean.indexOf(term, searchStart)) !== -1) {
    console.log(`\n=== KEMUNCULAN KE-${occurrence} pada index ${idx} ===`);
    console.log(clean.substring(idx, idx + 1000));
    searchStart = idx + term.length;
    occurrence++;
  }
});
