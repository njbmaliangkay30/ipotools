const text = `1. Sekitar 6,98%, atau sekitar Rp. 29.950.000.000,- (dua puluh sembilan miliar sembilan ratus lima puluh juta Rupiah) akan digunakan oleh Perseroan untuk melakukan pembayaran lebih awal (pelunasan dipercepat) atas seluruh pokok utang kepada PT Bank Negara Indonesia (Persero) Tbk (BNI), dengan rincian sebagai berikut: RincianKeterangan Para Pihak:Perseroan dan BNI ... 2. Sekitar 18,64%, atau sekitar Rp80.000.000.000,- akan digunakan oleh Perseroan untuk belanja modal (capital expenditure) atas rencana ekspansi usaha ... 3. Sekitar 37,61% atau sekitar Rp161.450.000.000,- (seratus ... Rupiah) akan digunakan oleh Perseroan untuk belanja operasional (operational expenditure) ...`;

// Regex lama:
const regexLama = /(?:sekitar|sebesar|sebanyak)?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%\s*(?:,\s*)?(?:atau\s+sekitar\s+Rp\s?[\d\.,]+(?:-\s*|\s*|\([^)]*\))?)?\s*(?:akan)?\s*(?:digunakan|dialokasikan)?\s*(?:untuk|oleh Perseroan untuk|sebagai)?\s+([^%.]{10,250})/gi;

// Regex baru dengan lookahead penghenti nomor bab berikutnya (seperti " 2." atau " 2)")
const regexBaru = /(?:sekitar|sebesar|sebanyak)?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%\s*(?:,\s*)?(?:atau\s+sekitar\s+Rp\s?[\d\.,]+(?:-\s*|\s*|\([^)]*\))?)?\s*(?:akan)?\s*(?:digunakan|dialokasikan)?\s*(?:untuk|oleh Perseroan untuk|sebagai)?\s+((?:(?!\s+\d+\s*[).])[^%.]){10,250})/gi;

console.log('=== REGEX LAMA ===');
let m;
while ((m = regexLama.exec(text)) !== null) {
  console.log(`- ${m[1]}%: "${m[2].substring(0, 80)}..."`);
}

console.log('\n=== REGEX BARU ===');
let m2;
while ((m2 = regexBaru.exec(text)) !== null) {
  console.log(`- ${m2[1]}%: "${m2[2].substring(0, 80)}..."`);
}
