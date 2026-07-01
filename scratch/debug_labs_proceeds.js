const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const pdfPath = path.join(__dirname, '..', 'scratch', 'pdf', 'LABS.pdf');
const buf = fs.readFileSync(pdfPath);

pdf(buf).then(parsed => {
  const clean = parsed.text.replace(/\s+/g, ' ');
  console.log('=== DATA DOKUMEN LABS ===');
  console.log('Panjang Teks Dokumen:', clean.length);
  
  // Cari padanan kata yang mirip
  const terms = [
    "penggunaan dana",
    "hasil penawaran umum",
    "rencana penggunaan",
    "use of proceeds",
    "penggunaan hasil"
  ];

  terms.forEach(term => {
    let idx = -1;
    let searchStart = 0;
    console.log(`\nPencarian: "${term}"`);
    while ((idx = clean.toLowerCase().indexOf(term.toLowerCase(), searchStart)) !== -1) {
      console.log(`  Indeks: ${idx} | Konteks: "${clean.substring(idx - 30, idx + 100)}"`);
      searchStart = idx + term.length;
    }
  });
});
