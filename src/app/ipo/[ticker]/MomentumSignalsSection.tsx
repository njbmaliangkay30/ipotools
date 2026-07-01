'use client';

export default function MomentumSignalsSection({ ipo, signals, underwriters }: { ipo: any, signals: any, underwriters: any[] }) {
  
  const totalLotDidaftarkan = 10;
  const osEstimate = signals?.os_estimate; 
  const lotPerAkun = osEstimate ? Math.floor(totalLotDidaftarkan / osEstimate) : '?';

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm transition-all duration-300 hover:border-slate-350">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900 tracking-wide">Momentum Signals</h2>
        <p className="text-xs text-slate-500">Indikator buzz retail, kekuatan underwriter, dan minat pasar</p>
      </div>
      
      {/* Signal Bars */}
      <div className="space-y-4 pt-1">
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500">Google Trends Score</span>
            <span className="text-slate-800 font-semibold">{signals?.google_trends_score || 0}/100</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 border border-slate-200">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${signals?.google_trends_score || 0}%` }}></div>
          </div>
        </div>
        
        <div className="flex justify-between items-center text-xs py-3 border-b border-slate-100">
          <span className="text-slate-500 uppercase font-semibold tracking-wider">Jumlah Berita (30 Hari)</span>
          <span className="text-slate-800 font-bold bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded">{signals?.news_count_30d || 0} Artikel</span>
        </div>
        
        <div className="flex justify-between items-center text-xs py-3">
          <span className="text-slate-500 uppercase font-semibold tracking-wider">Momentum Sektor (60 Hari)</span>
          <span className={`font-bold px-2 py-0.5 rounded border ${
            (signals?.sector_momentum_60d || 0) >= 0 
              ? 'text-emerald-600 bg-emerald-50 border-emerald-100' 
              : 'text-rose-600 bg-rose-50 border-rose-100'
          }`}>
            {(signals?.sector_momentum_60d || 0) >= 0 ? '+' : ''}{signals?.sector_momentum_60d || 0}%
          </span>
        </div>
      </div>

    </section>
  );
}
