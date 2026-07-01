const text = "PENGGUNAAN DANA YANG DIPEROLEH DARI HASIL PENAWARAN UMUM Seluruh dana yang diperoleh dari hasil penjualan saham yang ditawarkan melalui Penawaran Umum Perdana Saham ini, setelah dikurangi biaya-biaya emisi akan digunakan untuk: 1. Sebanyak 40% (empat puluh persen) akan digunakan untuk pengembangan usaha Perseroan dalam bentuk belanja modal yang rencananya akan dipergunakan untuk: a. Sekitar 75% (tujuh puluh lima persen) akan digunakan Perseroan untuk pembelian mesin SAP Sheet beserta utilitasnya, dalam rangka penambahan lini produksi baru di Perseroan. Sampai dengan saat ini, Perseroan masih berdiskusi dengan beberapa pihak terkait dengan pembelian mesin ini. Adapun pihak tersebut bukan merupakan pihak afiliasi dari Perseroan. Keterangan Estimasi Biaya yang Dibutuhkan : Sebanyak-banyaknya sebesar Rp79.411.761.000,- (tujuh puluh sembilan miliar empat ratus sebelas juta tujuh ratus enam puluh satu ribu Rupiah). Rencana Pembelian : Selambat-lambatnya pada kuartal 4 (empat) tahun 2024 b. S";

const pctRegex = /(?:sekitar|sebesar|sebanyak)?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%\s*(?:akan)?\s*(?:digunakan|dialokasikan)?\s*(?:untuk|oleh Perseroan untuk|sebagai)?\s+([^%\d.]{10,200})/gi;

let match;
console.log('=== RUN TEST ON ACTUAL TEXT ===');
while ((match = pctRegex.exec(text)) !== null) {
  const pct = parseFloat(match[1].replace(',', '.'));
  const desc = match[2].trim();
  const index = match.index;

  const isEmisiCost = 
    /biaya|profesi|jasa|hukum|audit|akuntan|notaris|penilai|konsultan|penanggung|pendaftaran|profesional|administra|adminisra|penjamin/i.test(desc) ||
    /biaya-biaya emisi/i.test(text.substring(Math.max(0, index - 80), index));

  console.log(`\nFound: ${pct}% | Desc: "${desc.substring(0, 100)}"`);
  console.log(`isEmisiCost:`, isEmisiCost);
}
