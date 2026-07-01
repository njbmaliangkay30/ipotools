'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

function parseDanaItems(rawText: string, totalProceedsRp?: number) {
  if (!rawText) return [];
  console.log("[DEBUG] parseDanaItems INPUT rawText:", rawText);

  // ── Format baru: JSON array [{percentage/pct, description/kategori}] ─────────────────
  try {
    const json = JSON.parse(rawText);
    if (Array.isArray(json) && json.length > 0) {
      return json.map((item: any) => {
        // Prioritaskan deskripsi_ringkas/description daripada kategori sebagai deskripsi teks utama
        const desc = item.deskripsi_ringkas || item.description || item.kategori || '';
        const pctVal = item.percentage !== undefined ? item.percentage : (item.pct !== undefined ? item.pct : 0);
        
        // Prioritaskan kategori yang sudah terdefinisi dari database (hasil AI), lalu normalisasi
        let category = item.kategori || 'Lain-lain';
        if (category === 'Belanja Modal') {
          category = 'Belanja Modal (CAPEX)';
        } else if (category === 'Modal Kerja') {
          category = 'Modal Kerja (OPEX)';
        } else if (
          category !== 'Modal Kerja (OPEX)' &&
          category !== 'Belanja Modal (CAPEX)' &&
          category !== 'Pelunasan Utang' &&
          category !== 'Akuisisi & Investasi'
        ) {
          // Fallback pencocokan teks jika kategori DB kosong atau tidak standar
          const checkText = `${item.kategori || ''} ${desc}`.toLowerCase();
          category = 'Lain-lain';
          if (checkText.includes('modal kerja') || checkText.includes('bahan baku') || checkText.includes('operasional') || checkText.includes('opex')) {
            category = 'Modal Kerja (OPEX)';
          } else if (checkText.includes('pelunasan') || checkText.includes('pinjaman') || checkText.includes('utang') || checkText.includes('kredit') || checkText.includes('pokok utang')) {
            category = 'Pelunasan Utang';
          } else if (checkText.includes('pembangunan') || checkText.includes('capex') || checkText.includes('gedung') || checkText.includes('aset') || checkText.includes('mesin') || checkText.includes('tanah') || checkText.includes('belanja modal')) {
            category = 'Belanja Modal (CAPEX)';
          } else if (checkText.includes('akuisisi') || checkText.includes('investasi') || checkText.includes('penyertaan') || checkText.includes('anak perusahaan') || checkText.includes('perusahaan anak')) {
            category = 'Akuisisi & Investasi';
          }
        }
        
        return {
          ...item,
          pct: pctVal,
          category,
          desc: desc,
          isSisa: false,
        };
      });
    }
  } catch {
    // bukan JSON — lanjut ke format lama
  }

  // ── Format lama: pipe-separated string ──────────────────────────────────
  const rawParts = rawText.split(' | ').map(p => p.trim()).filter(Boolean);
  
  let totalPct = 0;
  let sisaItemIdx = -1;
  
  const parsed = rawParts.map((part, idx) => {
    const firstRpIdx = part.search(/Rp\.?\s?\d/i);
    const leadingSegment = firstRpIdx > 0 && firstRpIdx < 120 ? part.substring(0, firstRpIdx) : part.substring(0, 120);
    const allocationPctMatch = leadingSegment.match(/(?:sekitar|sebesar|sebanyak)[^%]*?(\d+(?:[\.,]\d+)?)\s*%/i)
      || leadingSegment.match(/(\d+(?:[\.,]\d+)?)\s*%\s+(?:akan|untuk|digunakan)/i);
    let pct = allocationPctMatch ? parseFloat(allocationPctMatch[1].replace(',', '.')) : null;
    
    let category = "Lain-lain";
    const lower = part.toLowerCase();
    
    if (lower.includes("belanja modal") || lower.includes("capex") || lower.includes("pembelian") || lower.includes("pembangunan") || lower.includes("renovasi") || lower.includes("aset") || lower.includes("mesin") || lower.includes("tanah") || lower.includes("konstruksi")) {
      category = "Belanja Modal (CAPEX)";
    } else if (lower.includes("modal kerja") || lower.includes("opex") || lower.includes("operasional") || lower.includes("gaji") || lower.includes("marketing") || lower.includes("pemasaran") || lower.includes("persediaan") || lower.includes("bahan baku") || lower.includes("operational expenditure")) {
      category = "Modal Kerja (OPEX)";
    } else if (lower.includes("utang") || lower.includes("pinjaman") || lower.includes("pelunasan") || lower.includes("kredit") || lower.includes("liabilitas")) {
      category = "Pelunasan Utang";
    } else if (lower.includes("akuisisi") || lower.includes("penyertaan") || lower.includes("investasi") || lower.includes("anak perusahaan") || lower.includes("entitas anak") || lower.includes("penyetoran modal") || lower.includes("entitas usaha")) {
      category = "Akuisisi & Investasi";
    }
    
    const isSisa = lower.includes("sisa") || lower.includes("sisanya");
    if (isSisa) {
      sisaItemIdx = idx;
    }
    
    if (pct !== null) {
      totalPct += pct;
    }
    
    let desc = part;
    desc = desc.replace(/^\s*\d+\s*[)\.]\s*/, '').replace(/^\s*[a-zA-Z]\s*[)\.]\s*/, '').trim();
    
    let prevDesc = "";
    while (desc !== prevDesc) {
      prevDesc = desc;
      desc = desc.replace(/^\s*(?:sekitar|untuk|digunakan untuk|akan digunakan oleh perseroan untuk|sebagai|adalah|akan digunakan|oleh perseroan|oleh perseroan untuk|dan)\s+/i, '').trim();
      desc = desc.replace(/^[\s,;\.-]+/, '').trim();
    }
    
    desc = desc.replace(/^\s*[-*•\u2022]\s*/, '').replace(/\s+/g, ' ').trim();
    desc = desc.replace(/\([^)]*persen[^)]*\)/i, '').replace(/\s+/g, ' ').trim();
    desc = desc.replace(/^\s*[a-zA-Z\d]+\s*[)\.]\s*/, '').trim();

    const searchArea = desc.substring(20);
    const sentenceEndInArea = searchArea.search(/[\.;]\s+(?=[A-Z]|Keterangan|dengan\s+rincian|dalam\s+hal|Apabila|Selain|Selanjutnya|Sesuai)/);
    if (sentenceEndInArea !== -1 && (sentenceEndInArea + 20) < 400) {
      desc = desc.substring(0, sentenceEndInArea + 20).trim();
    } else if (desc.length > 350) {
      const cutAt = desc.lastIndexOf(' ', 350);
      desc = desc.substring(0, cutAt > 0 ? cutAt : 350).trim() + '…';
    }

    desc = desc.replace(/[;,\.\s]+$/, '').trim();
    desc = desc.charAt(0).toUpperCase() + desc.slice(1);
    
    return {
      pct,
      category,
      desc,
      isSisa
    };
  });

  const rpValues = rawParts.map(part => {
    const match = part.match(/Rp\.?\s?(\d{1,3}(?:\.\d{3})*)/i);
    return match ? parseInt(match[1].replace(/\./g, ''), 10) : 0;
  });

  const hasRpItems = rawParts.some((_, idx) => parsed[idx].pct === null && rpValues[idx] > 0);
  if (hasRpItems) {
    const denominator = totalProceedsRp && totalProceedsRp > 0 
      ? totalProceedsRp 
      : rpValues.reduce((a, b) => a + b, 0);

    if (denominator > 0) {
      parsed.forEach((item, idx) => {
        if (item.pct === null && rpValues[idx] > 0 && idx !== sisaItemIdx) {
          item.pct = Math.round((rpValues[idx] / denominator) * 100);
        }
      });
    }
  }

  totalPct = parsed.reduce((sum, item, idx) => {
    if (idx === sisaItemIdx) return sum;
    return sum + (item.pct ?? 0);
  }, 0);

  if (sisaItemIdx !== -1 && totalPct < 100) {
    parsed[sisaItemIdx].pct = Math.round(100 - totalPct);
  }

  // Saring item yang berhasil mendapatkan persentase
  const cleanParsed = parsed.filter(item => item.pct !== null);
  const finalTotalPct = cleanParsed.reduce((sum, item) => sum + (item.pct || 0), 0);

  if (finalTotalPct > 0 && finalTotalPct < 100) {
    // Jika total alokasi kurang dari 100% dan ada item lain yang tidak ter-parse, 
    // tambahkan item penyeimbang dinamis agar total grafik genap 100%
    cleanParsed.push({
      pct: 100 - finalTotalPct,
      category: "Lain-lain / Sisa Alokasi",
      desc: "Alokasi penggunaan dana hasil penawaran umum perdana lainnya sesuai dengan prospektus.",
      isSisa: true
    });
  } else if (finalTotalPct === 0 && parsed.length > 0) {
    // Jika tidak ada persentase terdeteksi sama sekali, bagi rata atau set 100% jika tunggal
    const share = Math.round(100 / parsed.length);
    parsed.forEach(item => {
      item.pct = share;
    });
    console.log("[DEBUG] parseDanaItems OUTPUT cleanParsed (divided evenly):", parsed);
    return parsed;
  }

  console.log("[DEBUG] parseDanaItems OUTPUT cleanParsed:", cleanParsed);
  return cleanParsed;
}

function getFormattedContent(desc: string, category: string) {
  const text = desc.trim();
  const lower = text.toLowerCase();
  
  let title = "";
  let details = text;
  
  if (lower.includes("perusahaan anak") || lower.includes("pt nps")) {
    title = "Penyertaan Modal Entitas Anak";
  } else if (lower.includes("pembelian mesin") || lower.includes("belanja modal dalam rangka pembelian")) {
    title = "Pembelian Mesin & Peralatan";
  } else if (lower.includes("pokok utang") || lower.includes("pelunasan utang") || lower.includes("bank mandiri")) {
    title = "Pelunasan Utang Bank Mandiri";
  } else if (lower.startsWith("modal kerja") || lower.includes("operasional harian")) {
    title = "Pembiayaan Modal Kerja";
  } else {
    // Fallback: ambil 4-5 kata pertama sebagai judul
    const words = text.split(" ");
    if (words.length <= 5) {
      title = text;
      details = "";
    } else {
      title = words.slice(0, 5).join(" ");
      // Hilangkan tanda baca menggantung di ujung judul
      title = title.replace(/[,;\.-]+$/, "").trim() + "...";
    }
  }
  
  // Format title to Capital Case
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return { title, details };
}

export default function InsiderRiskSection({ ipo, insiderRisk, shareholders = [] }: { ipo: any, insiderRisk: any, shareholders?: any[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  let riskLevel = 'moderate';
  let priceGapText = '-';
  let priceGapRatio = insiderRisk?.price_gap_ratio || null;
  let priceGapLow = insiderRisk?.price_gap_low || null;
  let priceGapHigh = insiderRisk?.price_gap_high || null;

  if (ipo && insiderRisk?.harga_perolehan_insider && !priceGapRatio && !priceGapLow) {
      const finalPrice = ipo.ipo_price;
      const low = ipo.bb_price_low;
      const high = ipo.bb_price_high;
      const ic = insiderRisk.harga_perolehan_insider;
      
      if (finalPrice) {
          priceGapRatio = finalPrice / ic;
      } else if (low && high) {
          priceGapLow = low / ic;
          priceGapHigh = high / ic;
      } else if (low) {
          priceGapRatio = low / ic;
      }
  }

  const maxRatio = priceGapRatio || priceGapHigh || 0;
  if (maxRatio > 0) {
      if (maxRatio < 2) riskLevel = 'low';
      else if (maxRatio < 5) riskLevel = 'moderate';
      else if (maxRatio < 10) riskLevel = 'high';
      else riskLevel = 'extreme';
  }

  if (priceGapRatio) {
      priceGapText = `${priceGapRatio.toFixed(1)}x`;
  } else if (priceGapLow && priceGapHigh) {
      priceGapText = `${priceGapLow.toFixed(1)}x - ${priceGapHigh.toFixed(1)}x`;
  }

  const riskColor = {
    'low': { 
      text: 'text-emerald-700 bg-emerald-50 border-emerald-200/50', 
      glow: 'shadow-md shadow-emerald-500/[0.02] hover:shadow-lg hover:shadow-emerald-500/[0.05] border-slate-200/80 hover:border-emerald-300/80' 
    },
    'moderate': { 
      text: 'text-amber-700 bg-amber-50 border-amber-200/50', 
      glow: 'shadow-md shadow-amber-500/[0.02] hover:shadow-lg hover:shadow-amber-500/[0.05] border-slate-200/80 hover:border-amber-300/80' 
    },
    'high': { 
      text: 'text-rose-700 bg-rose-50 border-rose-200/50', 
      glow: 'shadow-md shadow-rose-500/[0.02] hover:shadow-lg hover:shadow-rose-500/[0.05] border-slate-200/80 hover:border-rose-350/80' 
    },
    'extreme': { 
      text: 'text-red-700 bg-red-50 border-red-200/50', 
      glow: 'shadow-md shadow-red-500/[0.02] hover:shadow-lg hover:shadow-red-500/[0.05] border-slate-200/80 hover:border-red-350/80' 
    },
  }[riskLevel] || {
    text: 'text-slate-750 bg-slate-50 border-slate-200/50',
    glow: 'shadow-md border-slate-200/80 hover:border-slate-300/80'
  };

  return (
    <section className={`bg-white border rounded-2xl p-6 transition-all duration-300 ${riskColor.glow}`}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-wide">Insider Risk Assessment</h2>
          <p className="text-xs text-slate-500">Analisis margin keuntungan pemegang saham awal vs ritel</p>
        </div>
        {insiderRisk && (
          <div className={`flex items-center gap-2 font-bold uppercase text-[10px] px-3 py-1 rounded-full border tracking-wider ${riskColor.text}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
            {riskLevel} Risk
          </div>
        )}
      </div>

      {!insiderRisk ? (
        <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-250">
          <p className="text-slate-500 mb-2 text-sm">Data prospektus belum diekstrak oleh sistem.</p>
          <p className="text-slate-450 text-xs italic">
            {ipo?.status === 'listed' 
                ? 'Menunggu NLI scraper berjalan...' 
                : 'Menunggu Prospektus scraper berjalan...'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Price Gap Ratio</div>
              <div className="text-2xl font-black text-slate-800 tracking-tight">{priceGapText}</div>
              <div className="text-[10px] text-slate-500 mt-1">Multiplier keuntungan insider</div>
            </div>
            
            <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Harga Insider</div>
              <div className="text-2xl font-black text-slate-800 tracking-tight">
                {insiderRisk.harga_perolehan_insider ? `Rp ${insiderRisk.harga_perolehan_insider}` : '—'}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Harga perolehan rata-rata</div>
            </div>

            <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Status Lock-up</div>
              <div className="text-lg font-bold text-slate-800">
                {insiderRisk.ada_lockup ? `${insiderRisk.lockup_months} Bulan` : 'Tidak Ada'}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Mencegah aksi jual investor awal</div>
            </div>

            <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Proporsi Divestasi</div>
              <div className="text-lg font-bold text-slate-800">
                {insiderRisk.pct_divestasi !== null ? `${insiderRisk.pct_divestasi}%` : '0%'}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Saham divestasi pemegang lama</div>
            </div>
          </div>

          {/* Shareholders & Lock-up Section */}
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-bold text-slate-800 tracking-wide mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
              Struktur Kepemilikan Saham & Lock-up (Post-IPO)
            </h3>

            {insiderRisk.lock_up_exemptions && (
              <div className="bg-indigo-50/40 border border-indigo-100/70 rounded-xl p-3.5 text-[11px] text-indigo-950 mb-4 leading-relaxed flex gap-2.5">
                <span className="text-sm select-none">🔒</span>
                <div>
                  <span className="font-bold text-indigo-900 block mb-0.5">Ketentuan Kunci Saham (Lock-up)</span>
                  {insiderRisk.lock_up_exemptions}
                </div>
              </div>
            )}

            {shareholders.length > 0 ? (
              <div className="space-y-4">
                {/* Horizontal Stacked Bar */}
                <div className="w-full h-3 rounded-full overflow-hidden flex border border-slate-100">
                  {shareholders.map((sh, idx) => {
                    const bgColors = [
                      'bg-indigo-500',
                      'bg-blue-400',
                      'bg-sky-300',
                      'bg-slate-300',
                      'bg-emerald-400'
                    ];
                    const bg = sh.is_masyarakat ? 'bg-blue-400' : (sh.is_esa ? 'bg-emerald-400' : bgColors[idx % bgColors.length]);
                    return (
                      <div 
                        key={idx}
                        className={`${bg} h-full transition-all`}
                        style={{ width: `${sh.pct_kepemilikan}%` }}
                        title={`${sh.nama_pemegang_saham}: ${sh.pct_kepemilikan}%`}
                      />
                    );
                  })}
                </div>

                {/* List / Table */}
                <div className="space-y-2">
                  {shareholders.map((sh, idx) => {
                    const dotColors = [
                      'bg-indigo-500',
                      'bg-blue-400',
                      'bg-sky-300',
                      'bg-slate-300',
                      'bg-emerald-400'
                    ];
                    const dotColor = sh.is_masyarakat ? 'bg-blue-400' : (sh.is_esa ? 'bg-emerald-400' : dotColors[idx % dotColors.length]);
                    
                    return (
                      <div key={idx} className="flex items-center justify-between bg-slate-50/50 border border-slate-100 px-3.5 py-2.5 rounded-xl text-xs hover:border-slate-200 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                          <span className="font-semibold text-slate-800">{sh.nama_pemegang_saham}</span>
                          {sh.is_masyarakat && (
                            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded uppercase tracking-wide">
                              Publik
                            </span>
                          )}
                          {sh.is_esa && (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.2 rounded uppercase tracking-wide">
                              ESA
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="font-black text-slate-800 tracking-tight font-mono">{sh.pct_kepemilikan}%</span>
                            {sh.jumlah_saham && (
                              <span className="text-[10px] text-slate-450 block font-normal">
                                {sh.jumlah_saham.toLocaleString('id-ID')} lbr
                              </span>
                            )}
                          </div>
                          
                          {/* Lockup status badge */}
                          {sh.status_lockup === 'terkena' ? (
                            <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200/65 px-2 py-0.5 rounded-md uppercase tracking-wider">
                              Locked
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-slate-450 bg-white border border-slate-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                              Free
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-450 italic">Detail kepemilikan pasca-IPO belum tersedia.</p>
            )}
          </div>

          {/* Use of Proceeds Section */}
          <div className="border-t border-slate-100 pt-6">
            <h3 className="text-sm font-bold text-slate-800 tracking-wide mb-5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              Rencana Alokasi Penggunaan Dana
            </h3>
            
            {insiderRisk.penggunaan_dana_raw && (() => {
              let totalProceedsRp: number | undefined;
              if (ipo?.offered_shares) {
                const price = ipo.ipo_price ?? ipo.bb_price_high ?? ipo.bb_price_low;
                if (price) totalProceedsRp = ipo.offered_shares * price;
              }
              const parsedItems = parseDanaItems(insiderRisk.penggunaan_dana_raw, totalProceedsRp);

              // Konfigurasi warna kategori
              const colors: Record<string, { stroke: string; bg: string; text: string; border: string; cardBg: string; cardBorder: string }> = {
                'Modal Kerja (OPEX)': { 
                  stroke: '#3b82f6', 
                  bg: 'bg-blue-50', 
                  text: 'text-blue-700', 
                  border: 'border-blue-150',
                  cardBg: 'bg-blue-50/10 hover:bg-blue-50/20',
                  cardBorder: 'border-blue-100/60 hover:border-blue-200'
                },
                'Belanja Modal (CAPEX)': { 
                  stroke: '#10b981', 
                  bg: 'bg-emerald-50', 
                  text: 'text-emerald-700', 
                  border: 'border-emerald-150',
                  cardBg: 'bg-emerald-50/10 hover:bg-emerald-50/20',
                  cardBorder: 'border-emerald-100/60 hover:border-emerald-200'
                },
                'Pelunasan Utang': { 
                  stroke: '#f59e0b', 
                  bg: 'bg-amber-50', 
                  text: 'text-amber-700', 
                  border: 'border-amber-150',
                  cardBg: 'bg-amber-50/10 hover:bg-amber-50/20',
                  cardBorder: 'border-amber-100/60 hover:border-amber-200'
                },
                'Akuisisi & Investasi': { 
                  stroke: '#8b5cf6', 
                  bg: 'bg-purple-50', 
                  text: 'text-purple-700', 
                  border: 'border-purple-150',
                  cardBg: 'bg-purple-50/10 hover:bg-purple-50/20',
                  cardBorder: 'border-purple-100/60 hover:border-purple-200'
                },
                'Lain-lain': { 
                  stroke: '#64748b', 
                  bg: 'bg-slate-50', 
                  text: 'text-slate-700', 
                  border: 'border-slate-200',
                  cardBg: 'bg-slate-50/20 hover:bg-slate-50/30',
                  cardBorder: 'border-slate-200/60 hover:border-slate-300'
                },
                'Lain-lain / Sisa Alokasi': { 
                  stroke: '#64748b', 
                  bg: 'bg-slate-50', 
                  text: 'text-slate-700', 
                  border: 'border-slate-200',
                  cardBg: 'bg-slate-50/20 hover:bg-slate-50/30',
                  cardBorder: 'border-slate-200/60 hover:border-slate-300'
                }
              };

              // Parameter SVG Donut
              const r = 40;
              const circ = 2 * Math.PI * r; // ~251.32
              let currentOffset = 0;

              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* Left Side: Bento Cards for Allocations (Span 2) */}
                  <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {parsedItems.map((item: any, idx: number) => {
                      const c = colors[item.category] || colors['Lain-lain'];
                      const localFormatted = getFormattedContent(item.desc || '', item.category);
                      const title = item.judul_singkat || localFormatted.title;
                      const details = item.deskripsi_ringkas || localFormatted.details;
                      const formattedTitle = title ? title.charAt(0).toUpperCase() + title.slice(1) : '';
                      const formattedDetails = details ? details.charAt(0).toUpperCase() + details.slice(1) : '';
                      
                      const isHighlighted = activeIdx === idx;

                      return (
                        <div 
                          key={idx} 
                          className={`border rounded-2xl p-5 flex flex-col justify-between transition-all duration-300 shadow-sm/50 ${c.cardBg} ${c.cardBorder} ${
                            isHighlighted 
                              ? 'ring-2 ring-indigo-500/30 border-indigo-400 scale-[1.02] shadow-md bg-indigo-50/5' 
                              : ''
                          }`}
                          onMouseEnter={() => setActiveIdx(idx)}
                          onMouseLeave={() => setActiveIdx(null)}
                        >
                          <div>
                            <div className="flex justify-between items-start gap-4 mb-3">
                              <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${c.bg} ${c.text} ${c.border}`}>
                                {item.category}
                              </span>
                              <span className="text-2xl font-black text-slate-800 tracking-tight font-mono">
                                {Math.round(item.pct ?? 0)}%
                              </span>
                            </div>
                            <h4 className="text-xs font-black text-slate-800 tracking-wide mb-1 leading-snug">
                              {formattedTitle}
                            </h4>
                          </div>
                          {formattedDetails && (
                            <p className="text-[11px] text-slate-500 leading-relaxed font-normal mt-2">
                              {formattedDetails}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Side: Circular Bar Donut (Span 1) */}
                  <div className="bg-slate-50/30 border border-slate-200/60 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[250px] relative">
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        {/* Background circle */}
                        <circle
                          cx="50"
                          cy="50"
                          r={r}
                          className="stroke-slate-100 fill-none"
                          strokeWidth="8"
                        />
                        {/* Segment circles */}
                        {(() => {
                          let currentOffset = 0;
                          return parsedItems.map((item: any, idx: number) => {
                            const c = colors[item.category] || colors['Lain-lain'];
                            const pct = item.pct ?? 0;
                            const strokeDash = (pct / 100) * circ;
                            const strokeOffset = currentOffset;
                            currentOffset -= strokeDash;

                            if (pct <= 0) return null;

                            const isHighlighted = activeIdx === idx;

                            return (
                              <circle
                                key={idx}
                                cx="50"
                                cy="50"
                                r={r}
                                className="fill-none transition-all duration-300 ease-out cursor-pointer"
                                stroke={c.stroke}
                                strokeWidth={isHighlighted ? 12 : 8}
                                strokeDasharray={`${strokeDash} ${circ - strokeDash}`}
                                strokeDashoffset={strokeOffset}
                                strokeLinecap={pct === 100 ? 'butt' : 'round'}
                                onMouseEnter={() => setActiveIdx(idx)}
                                onMouseLeave={() => setActiveIdx(null)}
                              />
                            );
                          });
                        })()}
                      </svg>

                      {/* Inside Center Text */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
                        <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider font-semibold">Total Dana</span>
                        <span className="text-base font-black text-slate-800 mt-0.5">
                          {totalProceedsRp ? `Rp ${(totalProceedsRp / 1e9).toFixed(1)}B` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
}
