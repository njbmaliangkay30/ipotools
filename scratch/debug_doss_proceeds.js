const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const pdfPath = path.join(__dirname, '..', 'scratch', 'pdf', 'DOSS.pdf');
const buf = fs.readFileSync(pdfPath);

pdf(buf).then(parsed => {
  const clean = parsed.text.replace(/\s+/g, ' ');
  const term = "RENCANA PENGGUNAAN DANA";
  
  // Cari kemunculan indeks rencana penggunaan dana
  let idx = -1;
  let searchStart = 0;
  
  console.log('=== PENCARIAN SEKSI PENGGUNAAN DANA ===');
  while ((idx = clean.indexOf(term, searchStart)) !== -1) {
    console.log(`\nIndeks ditemukan pada: ${idx}`);
    // Print 800 karakter sesudahnya untuk verifikasi apakah ini bab utama
    console.log(clean.substring(idx, idx + 800));
    searchStart = idx + term.length;
  }
});
