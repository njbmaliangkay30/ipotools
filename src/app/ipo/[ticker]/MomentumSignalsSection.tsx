'use client';

export default function MomentumSignalsSection({ 
  ipo, 
  signals, 
  underwriters,
  financial
}: { 
  ipo: any, 
  signals: any, 
  underwriters: any[],
  financial?: any
}) {
  
  // Extract latest financial data from HIGHLIGHTS or HISTORICAL list
  let labaBersih: number | null = null;
  let totalEkuitas: number | null = null;
  
  if (financial) {
    if (financial.periode_laporan?.startsWith('HISTORICAL:')) {
      try {
        const historicalList = JSON.parse(financial.periode_laporan.replace('HISTORICAL:', ''));
        if (Array.isArray(historicalList) && historicalList.length > 0) {
          const sorted = [...historicalList].sort((a, b) => String(b.periode).localeCompare(String(a.periode)));
          const latest = sorted[0];
          labaBersih = latest.laba_bersih;
          totalEkuitas = latest.total_ekuitas;
        }
      } catch (e) {
        console.error("Error parsing historical financials:", e);
      }
    } else {
      labaBersih = financial.laba_bersih;
      totalEkuitas = financial.total_ekuitas;
    }
  }

  // Calculate PE and PBV dynamically
  const finalPrice = ipo.ipo_price || ipo.bb_price_high || ipo.bb_price_low || 0;
  const offeredShares = ipo.offered_shares || 0;
  const publicFloat = ipo.public_float_pct || 0;
  let totalShares = ipo.total_shares || 0;
  if (!totalShares && offeredShares && publicFloat) {
    totalShares = Math.round(offeredShares / (publicFloat / 100));
  }
  const marketCap = finalPrice * totalShares;
  const emitenPER = (marketCap && labaBersih && labaBersih > 0) ? (marketCap / labaBersih) : null;
  const emitenPBV = (marketCap && totalEkuitas && totalEkuitas > 0) ? (marketCap / totalEkuitas) : null;

  const hasBenchmark = signals?.sector_per || signals?.sector_pbv || signals?.shareholders_count || signals?.os_ratio;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm transition-all duration-300 hover:border-slate-350">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900 tracking-wide">Momentum Signals</h2>
        <p className="text-xs text-slate-500">Indikator buzz retail, kekuatan underwriter, dan minat pasar</p>
      </div>
      
      {/* Signal Bars */}
      <div className="space-y-4 pt-1 pb-4 border-b border-slate-100">
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500">Google Trends Score</span>
            <span className="text-slate-800 font-semibold">{signals?.google_trends_score || 0}/100</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 border border-slate-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${signals?.google_trends_score || 0}%` }}></div>
          </div>
        </div>
        
        <div className="flex justify-between items-center text-xs py-2 border-b border-slate-100">
          <span className="text-slate-500 uppercase font-semibold tracking-wider text-[10px]">Jumlah Berita (30 Hari)</span>
          <span className="text-slate-800 font-bold bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded text-[11px]">{signals?.news_count_30d || 0} Artikel</span>
        </div>
        
        <div className="flex justify-between items-center text-xs py-2">
          <span className="text-slate-500 uppercase font-semibold tracking-wider text-[10px]">Momentum Sektor (60 Hari)</span>
          <span className={`font-bold px-2 py-0.5 rounded border text-[11px] ${
            (signals?.sector_momentum_60d || 0) >= 0 
              ? 'text-emerald-600 bg-emerald-50 border-emerald-100' 
              : 'text-rose-600 bg-rose-50 border-rose-100'
          }`}>
            {(signals?.sector_momentum_60d || 0) >= 0 ? '+' : ''}{signals?.sector_momentum_60d || 0}%
          </span>
        </div>
      </div>

      {/* e-IPO Benchmark Section */}
      {hasBenchmark && (
        <div className="mt-6 pt-2">
          <div className="mb-4">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              📊 e-IPO Historical Benchmark (NLI)
            </h3>
            <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
              Kondisi valuasi rata-rata bursa dan partisipasi investor saat emiten ini melantai.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Valuations */}
            <div className="bg-slate-50/50 border border-slate-200/80 rounded-xl p-4 space-y-3.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/60 pb-1.5">
                Valuasi Sektor
              </div>
              
              {/* PE Ratio Comparison */}
              {(signals.sector_per || emitenPER) && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">P/E Ratio</span>
                    <span className="font-bold text-slate-800">
                      {emitenPER ? `${emitenPER.toFixed(2)}x` : '—'} 
                      <span className="text-[9px] font-normal text-slate-450 ml-1">vs Sektor</span>
                    </span>
                  </div>
                  <div className="flex gap-2 text-[9px] text-slate-500">
                    {signals.sector_per && (
                      <span className="bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded">
                        Sektor: {Number(signals.sector_per).toFixed(2)}x
                      </span>
                    )}
                    {signals.subsector_per && (
                      <span className="bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded">
                        Sub-Sektor: {Number(signals.subsector_per).toFixed(2)}x
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* PBV Ratio Comparison */}
              {(signals.sector_pbv || emitenPBV) && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">PBV Ratio</span>
                    <span className="font-bold text-slate-800">
                      {emitenPBV ? `${emitenPBV.toFixed(2)}x` : '—'} 
                      <span className="text-[9px] font-normal text-slate-450 ml-1">vs Sektor</span>
                    </span>
                  </div>
                  <div className="flex gap-2 text-[9px] text-slate-500">
                    {signals.sector_pbv && (
                      <span className="bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded">
                        Sektor: {Number(signals.sector_pbv).toFixed(2)}x
                      </span>
                    )}
                    {signals.subsector_pbv && (
                      <span className="bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded">
                        Sub-Sektor: {Number(signals.subsector_pbv).toFixed(2)}x
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Animo Investor */}
            <div className="bg-slate-50/50 border border-slate-200/80 rounded-xl p-4 space-y-3.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/60 pb-1.5">
                Animo & Partisipasi
              </div>

              {/* Oversubscription */}
              {signals.os_ratio && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500">Oversubscribed</span>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                    {signals.os_ratio} Kali
                  </span>
                </div>
              )}

              {/* Shareholders Count */}
              {signals.shareholders_count && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-slate-500">Jumlah Partisipan</span>
                  <span className="text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                    {Number(signals.shareholders_count).toLocaleString('id-ID')} Pihak
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
