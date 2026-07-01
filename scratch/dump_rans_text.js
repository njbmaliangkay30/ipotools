const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const pdfPath = path.join(__dirname, '..', 'scratch', 'pdf', 'RANS.pdf');
const buf = fs.readFileSync(pdfPath);

pdf(buf).then(parsed => {
  const clean = parsed.text.replace(/\s+/g, ' ');
  const term = "RENCANA PENGGUNAAN DANA YANG DIPEROLEH DARI HASIL PENAWARAN UMUM PERDANA SAHAM";
  const idx = clean.indexOf(term, 10000); // skip TOC
  
  console.log('=== SAMBUNGAN KONTEN RANS ===');
  console.log(clean.substring(idx + 5500, idx + 10000));
});
