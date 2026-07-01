const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

// ============================================================
// HELPER FUNCTIONS (From User's Clean Architecture)
// ============================================================

function cleanPdfText(text) {
  return text
    .replace(/[\r\n]+/g, ' ')           // Normalisasi line break
    .replace(/\t+/g, ' ')               // Tab ke spasi
    .replace(/\s+/g, ' ')               // Multiple spaces ke single
    .replace(/\x00/g, '')               // Null bytes
    .replace(/[^\x20-\x7E\xC0-\xFF]/g, '') // Non-printable chars (keep accented)
    .trim();
}

function parseIndonesianNumber(str) {
  if (!str) return NaN;
  let cleaned = str.replace(/^Rp\.?\s*/i, '')
                   .replace(/[,.\-]\s*$/g, '')
                   .replace(/\s/g, '')
                   .trim();
  
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  
  let normalized;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = cleaned.replace(/,/g, '');
  }
  return parseFloat(normalized);
}

function normalizeDescription(desc) {
  if (!desc) return '';
  const fillerPatterns = [
    /^(?:akan\s+)?digunakan\s+(?:oleh\s+perseroan\s+)?(?:untuk|sebagai|oleh\s+Perseroan\s+untuk)\s+/i,
    /^untuk\s+/i,
    /^sebagai\s+/i,
    /^adalah\s+/i,
    /^yaitu\s+/i,
    /^merupakan\s+/i,
    /^pada\s+/i,
    /^dengan\s+/i
  ];
  let normalized = desc;
  for (const pat of fillerPatterns) {
    normalized = normalized.replace(pat, '');
  }
  normalized = normalized.replace(/^[:\-\s\.,;]+/, '');
  
  if (normalized.length > 0) {
    normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
  return normalized.trim();
}

function stringSimilarity(a, b) {
  if (!a || !b) return 0;
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  if (aLower === bLower) return 1;
  if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.8;
  const wordsA = new Set(aLower.split(/\s+/));
  const wordsB = new Set(bLower.split(/\s+/));
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

function deduplicateItems(items, threshold = 0.6) {
  const unique = [];
  for (const item of items) {
    const isDuplicate = unique.some(existing => 
      stringSimilarity(existing.description, item.description) >= threshold
    );
    if (!isDuplicate) unique.push(item);
  }
  return unique;
}

// ============================================================
// 1. EKSTRAKSI HARGA INSIDER (V10 Accuracy Pattern)
// ============================================================

function extractInsiderCost(text) {
  const clean = cleanPdfText(text);
  const searchArea = clean.substring(0, Math.min(clean.length, 50000));
  
  const patterns = [
    /Sebelum Penawaran Umum Perdana Saham.*?Nilai Nominal Rp\s?([\d\.]+)/i,
    /Nilai Nominal Rp\s?([\d\.]+)[,\-]? per Saham/i,
    /nilai nominal Rp\s?([\d\.]+)[,\-]? setiap saham/i,
    /nominal Rp\s?([\d\.]+)[,\-]? \([^)]*\) per saham/i,
    /dengan nilai nominal Rp\s?([\d\.]+)/i
  ];

  for (const pat of patterns) {
    const m = searchArea.match(pat);
    if (m) {
      const val = parseInt(m[1].replace(/\./g, ''), 10);
      if (val >= 1 && val <= 5000) return val;
    }
  }

  const fallbackRegex = /nominal Rp\s?([\d\.]+)/gi;
  let match;
  while ((match = fallbackRegex.exec(searchArea)) !== null) {
    const val = parseInt(match[1].replace(/\./g, ''), 10);
    if (val >= 1 && val <= 5000) return val;
  }
  return null;
}

// ============================================================
// 2. EKSTRAKSI RENCANA PENGGUNAAN DANA (V10 Accuracy Pattern)
// ============================================================

function extractUseOfProceeds(text, totalProceedsRp = 0) {
  const clean = cleanPdfText(text);
  
  const startPatterns = [
    /RENCANA PENGGUNAAN DANA/gi,
    /PENGGUNAAN DANA YANG DIPEROLEH DARI HASIL PENAWARAN UMUM/gi,
    /PENGGUNAAN DANA HASIL PENAWARAN/gi,
    /RENCANA PENGGUNAAN HASIL/gi
  ];

  let startIndex = -1;
  for (const pat of startPatterns) {
    let match;
    while ((match = pat.exec(clean)) !== null) {
      const context = clean.substring(match.index, match.index + 120);
      const isTableOfContents = 
        /\.{4,}/.test(context) || 
        /\.\s*\.\s*\./.test(context) ||
        /\b(?:III|IV|V|VI|VII)\b\s*(?:\.|\s)*\b(?:PERNYATAAN|IKHTISAR|ANALISIS|FAKTOR)\b/i.test(context);
        
      if (!isTableOfContents && match.index > 5000) {
        startIndex = match.index;
        break;
      }
    }
    if (startIndex !== -1) break;
  }

  if (startIndex === -1) {
    let idx1 = clean.indexOf("RENCANA PENGGUNAAN DANA");
    if (idx1 !== -1) {
      let idx2 = clean.indexOf("RENCANA PENGGUNAAN DANA", idx1 + 23);
      if (idx2 !== -1) startIndex = idx2;
      else startIndex = idx1;
    }
  }

  if (startIndex === -1) return [];

  let rawSection = clean.substring(startIndex);
  const stopKeywords = [
    /PERNYATAAN UTANG/i,
    /IKHTISAR DATA KEUANGAN PENTING/i,
    /Modal Ditempatkan dan Disetor Penuh/i,
    /Susunan Pemegang Saham/i,
    /STRUKTUR ORGANISASI PERSEROAN/i,
    /KEGIATAN DAN RENCANA USAHA/i,
    /IV\b\s+\.?\s*IKHTISAR/i,
    /III\b\s+\.?\s*PERNYATAAN/i
  ];

  let minStopIndex = 5000;
  for (const stopPat of stopKeywords) {
    const stopIdx = rawSection.search(stopPat);
    if (stopIdx > 200 && stopIdx < minStopIndex) {
      minStopIndex = stopIdx;
    }
  }

  const sectionText = rawSection.substring(0, minStopIndex);
  const items = [];

  // Pola 1: Rincian persentase eksplisit (Non-greedy capture block)
  const pctRegex = /(?:sekitar|sebesar|sebanyak)?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%\s*(?:,\s*)?(?:atau\s+sekitar\s+Rp\s?[\d\.,\s]+(?:juta|miliar|triliun)?\s*(?:-\s*|\s*|\([^)]*\))?)?\s*(?:akan)?\s*(?:digunakan|dialokasikan)?\s*(?:untuk|oleh Perseroan untuk|sebagai|pembayaran)?\s+([^]{10,400})/gi;
  let match;
  while ((match = pctRegex.exec(sectionText)) !== null) {
    const pct = parseFloat(match[1].replace(',', '.'));
    let rawDesc = match[2];

    // Ekstraksi deskripsi bersih dari blok teks raw
    let desc = rawDesc.trim();

    // 1. Potong di penanda item baru (seperti "2) ", "b. ", "ii. ")
    const itemMarkerIdx = desc.search(/(?:\s+|;)\d+\s*[).]/);
    if (itemMarkerIdx !== -1) {
      desc = desc.substring(0, itemMarkerIdx).trim();
    }
    const alphaMarkerIdx = desc.search(/(?:\s+|;)[a-z]\s*[).]/);
    if (alphaMarkerIdx !== -1) {
      desc = desc.substring(0, alphaMarkerIdx).trim();
    }

    // 2. Potong di akhir kalimat (titik diikuti huruf besar, tetapi abaikan titik di nominal ribuan seperti "Rp10.000")
    const sentenceEndMatch = desc.match(/\.\s+(?=[A-Z]|Sisanya|Apabila|Sesuai|Selain|Dalam hal|Sisa)/);
    if (sentenceEndMatch) {
      desc = desc.substring(0, sentenceEndMatch.index).trim();
    }

    // Potong di titik koma ";"
    const semiIdx = desc.indexOf(';');
    if (semiIdx !== -1) {
      desc = desc.substring(0, semiIdx).trim();
    }

    desc = normalizeDescription(desc);

    const isEmisiCost = 
      /biaya|profesi|jasa|hukum|audit|akuntan|notaris|penilai|konsultan|penanggung|pendaftaran|profesional|administra|adminisra|penjamin/i.test(desc) ||
      /biaya-biaya emisi/i.test(sectionText.substring(Math.max(0, match.index - 80), match.index));

    const isMilestoneOrTerm = 
      /termin|angsuran|tanda jadi|kwitansi|dp\b|milestone|tahap pembayaran/i.test(desc);

    if ((isEmisiCost && pct < 15) || isMilestoneOrTerm) {
      continue;
    }

    if (pct > 0 && pct <= 100 && desc.length > 5) {
      items.push({
        percentage: pct,
        description: desc,
        source: 'percentage'
      });
    }
  }

  // Pola 2: Alokasi rupiah absolut
  const totalPct = items.reduce((s, i) => s + i.percentage, 0);
  if (items.length === 0 || totalPct < 15) {
    const discardedItems = [...items];
    items.length = 0;

    const rpMatches = [...sectionText.matchAll(/Rp\s?([\d\.]+)/gi)];
    const detectedAllocations = [];
    let totalAllocatedRp = 0;

    rpMatches.forEach((m) => {
      const rpVal = parseInt(m[1].replace(/\./g, ''), 10);
      const contextAfter = sectionText.substring(m.index + m[0].length, m.index + m[0].length + 180).trim();
      
      if (rpVal > 100000000) {
        const isEmisiCost = /biaya|profesi|jasa|hukum|audit|akuntan|notaris|penilai|konsultan|penanggung|pendaftaran|profesional|administra|adminisra|penjamin/i.test(contextAfter);
        if (isEmisiCost && rpVal < (totalProceedsRp * 0.15)) {
          return;
        }

        let desc = contextAfter;
        const descMatch = contextAfter.match(/(?:untuk|sebagai|pembayaran|fasilitas|membiayai)\s+([^.;\n\r]{10,150})/i);
        if (descMatch) {
          desc = descMatch[1].trim();
        } else {
          const cutIdx = desc.search(/[\.;]/);
          if (cutIdx !== -1) desc = desc.substring(0, cutIdx).trim();
        }

        desc = normalizeDescription(desc);

        if (desc.length > 5) {
          detectedAllocations.push({
            amount: rpVal,
            description: desc,
            source: 'rupiah'
          });
          totalAllocatedRp += rpVal;
        }
      }
    });

    if (detectedAllocations.length > 0) {
      const denominator = totalProceedsRp > 0 ? totalProceedsRp : totalAllocatedRp;
      detectedAllocations.forEach(alloc => {
        const pct = Math.round((alloc.amount / denominator) * 1000) / 10;
        items.push({
          percentage: pct,
          description: alloc.description,
          source: 'rupiah'
        });
      });
    } else if (discardedItems.length > 0) {
      items.push(...discardedItems);
    }
  }

  // Pola 3: Fallback 100%
  if (items.length === 0) {
    const singleAllocationPatterns = [
      /seluruhnya\s+akan\s+digunakan\s+(?:oleh\s+Perseroan\s+)?untuk\s+([^%.\n]{10,250})/i,
      /seluruhnya\s+untuk\s+([^%.\n]{10,250})/i,
      /100%\s+(?:akan\s+)?digunakan\s+untuk\s+([^%.\n]{10,250})/i
    ];

    for (const pat of singleAllocationPatterns) {
      const singleMatch = sectionText.match(pat);
      if (singleMatch) {
        let desc = singleMatch[1].trim();
        const cutIdx = desc.search(/[\.;]/);
        if (cutIdx !== -1) {
          desc = desc.substring(0, cutIdx).trim();
        }
        desc = normalizeDescription(desc);
        
        if (desc.length > 5) {
          items.push({
            percentage: 100,
            description: desc,
            source: 'fallback'
          });
          break;
        }
      }
    }
  }

  let uniqueItems = deduplicateItems(items, 0.55);

  // Filter pengamanan tabel vendor duplikat (seperti ASPR yang menghasilkan banyak baris 100%)
  const sumTotal = uniqueItems.reduce((s, i) => s + i.percentage, 0);
  if (sumTotal > 150) {
    const count100 = uniqueItems.filter(i => i.percentage === 100).length;
    if (count100 > 1) {
      uniqueItems = uniqueItems.filter(i => i.percentage !== 100);
    }
  }

  uniqueItems.sort((a, b) => b.percentage - a.percentage);
  
  const finalTotal = uniqueItems.reduce((s, i) => s + i.percentage, 0);
  if (finalTotal > 100 && finalTotal <= 115) {
    const scale = 100 / finalTotal;
    uniqueItems.forEach(item => {
      item.percentage = Math.round(item.percentage * scale * 10) / 10;
    });
  }
  
  return uniqueItems.map(({ percentage, description }) => ({ percentage, description }));
}

// ============================================================
// 3. EKSTRAKSI LOCK-UP (V10 Accuracy Pattern + User's Types)
// ============================================================

function extractLockup(text) {
  const clean = cleanPdfText(text);
  const candidates = [];
  
  const lockupPatterns = [
    /dilarang\s+(?:untuk\s+)?(?:mengalihkan|menjual|memindahtangankan|melepas|melakukan\s+penjualan)[^.]*(\d+)\s*(?:bulan|bulan\s+calendar|bulan\s+kalender)/gi,
    /tidak\s+boleh\s+(?:mengalihkan|menjual|memindahtangankan|melepas)[^.]*(\d+)\s*(?:bulan|bulan\s+calendar|bulan\s+kalender)/gi,
    /diikat\s+(?:untuk\s+tidak\s+)?(?:mengalihkan|menjual)[^.]*(\d+)\s*(?:bulan|bulan\s+calendar|bulan\s+kalender)/gi,
    /(?:mengalihkan|menjual|memindahtangankan)\s+(?:saham|kepemilikan)[^.]*(?:selama|jangka\s+waktu)\s+(\d+)\s*(?:bulan)/gi,
    /lock[\s-]*up[^.]*(\d+)\s*(?:bulan|month)/gi,
    /periode\s+lock[\s-]*up[^.]*(\d+)\s*(?:bulan|month)/gi,
    /commitment\s+(?:share|saham)[^.]*(\d+)\s*(?:bulan|month)/gi,
    /pendiri[^.]*(?:dilarang|tidak\s+boleh)[^.]*(\d+)\s*(?:bulan)/gi,
    /pemegang\s+saham\s+lama[^.]*(?:dilarang|tidak\s+boleh)[^.]*(\d+)\s*(?:bulan)/gi,
    /selama\s+(\d+)\s*(?:bulan)\s+(?:sejak|setelah|terhitung\s+dari)\s+(?:tanggal\s+penjatahan|pendaftaran|listing)/gi,
    /(\d+)\s*(?:bulan)\s+(?:sejak|setelah)\s+(?:penjatahan|listing|efektif)/gi
  ];

  for (const pat of lockupPatterns) {
    let match;
    while ((match = pat.exec(clean)) !== null) {
      const val = parseInt(match[1], 10);
      if (val > 0 && val <= 36) {
        const contextStart = Math.max(0, match.index - 150);
        const contextEnd = Math.min(clean.length, match.index + match[0].length + 50);
        const context = clean.substring(contextStart, contextEnd).toLowerCase();
        
        let lockupType = 'general';
        if (/pendiri|founder|promoter/i.test(context)) {
          lockupType = 'founder';
        } else if (/komisaris|direksi|pengurus|manajemen/i.test(context)) {
          lockupType = 'management';
        } else if (/pemegang\s+saham\s+lama|existing\s+shareholder/i.test(context)) {
          lockupType = 'existing_shareholder';
        }
        
        candidates.push({
          months: val,
          type: lockupType,
          index: match.index,
          context: context
        });
      }
    }
  }

  if (candidates.length > 0) {
    const founderLockup = candidates.find(c => c.type === 'founder');
    const existingShareholderLockup = candidates.find(c => c.type === 'existing_shareholder');
    const managementLockup = candidates.find(c => c.type === 'management');
    
    if (founderLockup) {
      return { adaLockup: true, lockupMonths: founderLockup.months, lockupType: 'founder' };
    }
    if (existingShareholderLockup) {
      return { adaLockup: true, lockupMonths: existingShareholderLockup.months, lockupType: 'existing_shareholder' };
    }
    if (managementLockup) {
      return { adaLockup: true, lockupMonths: managementLockup.months, lockupType: 'management' };
    }
    
    const twelveMonth = candidates.find(c => c.months === 12);
    if (twelveMonth) return { adaLockup: true, lockupMonths: 12, lockupType: 'standard' };
    
    const eightMonth = candidates.find(c => c.months === 8);
    if (eightMonth) return { adaLockup: true, lockupMonths: 8, lockupType: 'standard' };
    
    const sorted = [...candidates].sort((a, b) => a.index - b.index);
    return { 
      adaLockup: true, 
      lockupMonths: sorted[0].months,
      lockupType: 'detected'
    };
  }

  const noLockupPatterns = [
    /tidak\s+ada\s+(?:ketentuan|peraturan|peraturana)?\s*(?:mengenai)?\s*lock[\s-]*up/i,
    /tanpa\s+(?:ketentuan|peraturan)?\s*lock[\s-]*up/i,
    /tidak\s+dikenakan\s+lock[\s-]*up/i,
    /bebas\s+dari\s+lock[\s-]*up/i
  ];
  for (const pat of noLockupPatterns) {
    if (pat.test(clean)) {
      return { adaLockup: false, lockupMonths: null, lockupType: 'explicitly_none' };
    }
  }

  return { adaLockup: false, lockupMonths: null, lockupType: null };
}

// ============================================================
// 4. EKSTRAKSI PROPORSI DIVESTASI (V10 Accuracy Pattern + User's Logic)
// ============================================================

function extractDivestasi(text, totalSharesOffered = 0) {
  const clean = cleanPdfText(text);
  const searchAreas = [
    clean.substring(0, Math.min(clean.length, 25000)),
    clean.substring(0, Math.min(clean.length, 50000))
  ];

  const newShareOnlyPatterns = [
    /seluruhnya\s+(?:adalah|merupakan|berupa)\s+Saham\s+Baru/i,
    /Seluruh\s+saham\s+yang\s+ditawarkan\s+(?:adalah|merupakan)\s+saham\s+baru/i,
    /penawaran\s+ini\s+(?:murni|sepenuhnya)\s+berupa\s+saham\s+baru/i,
    /tidak\s+ada\s+saham\s+divestasi/i,
    /tanpa\s+saham\s+divestasi/i,
    /100\s*%\s+(?:adalah|merupakan)\s+saham\s+baru/i,
    /semua\s+saham\s+(?:yang\s+)?ditawarkan\s+(?:adalah|merupakan)\s+saham\s+baru/i
  ];

  for (const area of searchAreas) {
    for (const pat of newShareOnlyPatterns) {
      if (pat.test(area)) return 0;
    }
  }

  const directPctPatterns = [
    /(\d{1,3}(?:[.,]\d{1,2})?)\s*%\s*(?:dari\s+total\s+)?penawaran\s+(?:merupakan|adalah|berupa)\s+saham\s+(?:divestasi|lama|pemegang\s+saham\s+lama)/i,
    /saham\s+divestasi\s+(?:sebesar|sebanyak)\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*%/i,
    /proporsi\s+saham\s+divestasi\s+(?:sebesar|adalah)\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*%/i,
    /sebanyak\s+(\d{1,3}(?:[.,]\d{1,2})?)\s*%\s+(?:merupakan|adalah)\s+saham\s+divestasi/i
  ];

  for (const area of searchAreas) {
    for (const pat of directPctPatterns) {
      const match = area.match(pat);
      if (match) {
        const pct = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(pct) && pct >= 0 && pct <= 100) {
          return Math.round(pct * 10) / 10;
        }
      }
    }
  }

  const divestSharePatterns = [
    /terdiri\s+dari\s+(?:sebanyak\s+)?([\d\.,]+)\s*(?:lembar\s+)?Saham\s+Divestasi/i,
    /sebanyak\s+([\d\.,]+)\s*(?:lembar\s+)?saham\s+(?:divestasi|milik\s+pemegang\s+saham\s+lama)/i,
    /([\d\.,]+)\s*(?:lembar\s+)?saham\s+milik\s+pemegang\s+saham\s+lama\s+(?:yang\s+)?ditawarkan/i,
    /saham\s+divestasi\s+(?:sebanyak|sejumlah)\s+([\d\.,]+)\s*(?:lembar)?/i,
    /mencakup\s+([\d\.,]+)\s*(?:lembar\s+)?saham\s+divestasi/i,
    /termasuk\s+([\d\.,]+)\s*(?:lembar\s+)?saham\s+(?:dari\s+)?pemegang\s+saham\s+lama/i
  ];

  for (const area of searchAreas) {
    for (const pat of divestSharePatterns) {
      const match = area.match(pat);
      if (match) {
        const divestShares = parseIndonesianNumber(match[1]);
        if (!isNaN(divestShares) && divestShares > 0) {
          if (totalSharesOffered > 0) {
            return Math.round((divestShares / totalSharesOffered) * 1000) / 10;
          }
          return null;
        }
      }
    }
  }

  const splitPatterns = [
    /([\d\.,]+)\s*(?:lembar\s+)?saham\s+baru\s+dan\s+([\d\.,]+)\s*(?:lembar\s+)?saham\s+(?:divestasi|lama)/i,
    /([\d\.,]+)\s*(?:lembar\s+)?saham\s+baru[\s,]+\s*([\d\.,]+)\s*(?:lembar\s+)?saham\s+(?:divestasi|lama)/i,
    /terdiri\s+dari\s+([\d\.,]+)\s*(?:lembar\s+)?(?:Saham\s+Baru|saham\s+baru)[^0-9]*([\d\.,]+)\s*(?:lembar\s+)?(?:Saham\s+Divestasi|saham\s+divestasi|saham\s+lama)/i
  ];

  for (const area of searchAreas) {
    for (const pat of splitPatterns) {
      const match = area.match(pat);
      if (match) {
        const newShares = parseIndonesianNumber(match[1]);
        const divestShares = parseIndonesianNumber(match[2]);
        if (!isNaN(newShares) && !isNaN(divestShares) && newShares > 0 && divestShares > 0) {
          const total = newShares + divestShares;
          return Math.round((divestShares / total) * 1000) / 10;
        }
      }
    }
  }

  const divestMention = clean.search(/saham\s+divestasi/i);
  if (divestMention !== -1 && divestMention < 50000) {
    const context = clean.substring(Math.max(0, divestMention - 200), divestMention + 200);
    if (/sebagian\s+(?:kecil|sedikit)|minoritas|tidak\s+signifikan/i.test(context)) {
      return -1;
    }
    return null;
  }

  return null;
}

// ============================================================
// MAIN SCRAPING FUNCTION
// ============================================================

async function processProspectus(pdfPath, options = {}) {
  const { totalSharesOffered = 0, totalProceedsRp = 0 } = options;
  
  // Tekan warning bawaan PDF.js untuk kebersihan terminal
  const originalWarn = console.warn;
  console.warn = function() {};
  
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdf(dataBuffer);
    const text = pdfData.text;
    
    // Kembalikan console.warn setelah selesai
    console.warn = originalWarn;
    
    const result = {
      fileName: path.basename(pdfPath),
      pageCount: pdfData.numpages,
      insiderCost: extractInsiderCost(text),
      useOfProceeds: extractUseOfProceeds(text, totalProceedsRp),
      lockup: extractLockup(text),
      divestasiRatio: extractDivestasi(text, totalSharesOffered),
      processedAt: new Date().toISOString()
    };
    
    return result;
  } catch (error) {
    console.warn = originalWarn;
    return {
      fileName: path.basename(pdfPath),
      error: error.message,
      processedAt: new Date().toISOString()
    };
  }
}

async function processProspectusBatch(directoryPath, options = {}) {
  const results = [];
  const files = fs.readdirSync(directoryPath).filter(f => f.toLowerCase().endsWith('.pdf'));
  
  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const result = await processProspectus(filePath, options);
    results.push(result);
  }
  
  return results;
}

function extractMaxProceeds(text) {
  const clean = cleanPdfText(text);
  const patterns = [
    /sebanyak-banyaknya\s+sebesar\s+Rp\s?([\d\.,]+)/i,
    /penawaran\s+umum\s+perdana\s+saham\s+adalah\s+sebanyak-banyaknya\s+sebesar\s+Rp\s?([\d\.,]+)/i,
    /jumlah\s+penawaran\s+umum\s+.*?sebesar\s+Rp\s?([\d\.,]+)/i
  ];
  for (const pat of patterns) {
    const m = clean.match(pat);
    if (m) {
      const val = parseInt(m[1].replace(/[.,]/g, ''), 10);
      if (val >= 1000000000) return val;
    }
  }
  return null;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  extractInsiderCost,
  extractUseOfProceeds,
  extractLockup,
  extractDivestasi,
  extractMaxProceeds,
  processProspectus,
  processProspectusBatch,
  cleanPdfText,
  parseIndonesianNumber,
  normalizeDescription,
  stringSimilarity,
  deduplicateItems
};
