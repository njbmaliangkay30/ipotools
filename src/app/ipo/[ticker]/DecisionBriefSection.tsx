'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DecisionBriefSection({ ipo, signals, decisions, insiderRisk }: { ipo: any, signals: any, decisions: any[], insiderRisk: any }) {
  const [activeForm, setActiveForm] = useState<'Masuk' | 'Skip' | 'Watchlist' | null>(null);
  
  const [akunCount, setAkunCount] = useState(1);
  const [lotPerAkun, setLotPerAkun] = useState(10);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  // Generate Pros & Cons
  const pros = [];
  const cons = [];

  const uwWinRate = ipo.ipo_underwriters?.[0]?.underwriters?.win_rate || 0;
  if (uwWinRate > 65) pros.push(`Underwriter win rate solid (${uwWinRate}%)`);
  if (insiderRisk?.ada_lockup) pros.push(`Terdapat periode Lock-up saham`);
  if (insiderRisk?.penggunaan_dana_kategori === 'growth capex') pros.push(`Penggunaan dana berfokus pada Growth Capex`);
  if (signals?.community_buzz >= 4) pros.push(`Community buzz sangat positif`);
  if (signals?.sector_momentum_60d > 0) pros.push(`Sektor memiliki momentum positif`);

  const priceGapRatio = insiderRisk?.price_gap_ratio || insiderRisk?.price_gap_high || ((ipo.ipo_price || ipo.bb_price_high) / (insiderRisk?.harga_perolehan_insider || 1));
  if (priceGapRatio > 5 && insiderRisk?.harga_perolehan_insider) cons.push(`Price gap ratio cukup tinggi (${priceGapRatio.toFixed(1)}x)`);
  if (!insiderRisk?.ada_lockup) cons.push(`Tidak ada periode Lock-up (Rawan guyur)`);
  if (signals?.os_confidence === 'low') cons.push(`Kepercayaan oversubscription rendah`);
  if (signals?.community_buzz <= 2) cons.push(`Minat komunitas ritel relatif rendah`);

  const osEstimate = signals?.os_estimate || null;
  const totalLot = akunCount * lotPerAkun;
  const lotDidapat = osEstimate ? Math.max(1, Math.round(totalLot / osEstimate)) : null;
  const estimatedCost = lotDidapat !== null ? lotDidapat * 100 * (ipo.ipo_price || ipo.bb_price_high || 0) : null;

  const toggleForm = (formName: 'Masuk' | 'Skip' | 'Watchlist') => {
    setActiveForm(activeForm === formName ? null : formName);
    setReason('');
  };

  const submitDecision = async (decisionType: string) => {
    setLoading(true);
    await supabase.from('decisions').insert({
      ipo_id: ipo.id,
      decision: decisionType,
      akun_count: decisionType === 'Masuk' ? akunCount : null,
      lot_per_akun: decisionType === 'Masuk' ? lotPerAkun : null,
      reason: reason
    });
    setLoading(false);
    setActiveForm(null);
    window.location.reload();
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm transition-all duration-300 hover:border-slate-300">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-slate-900 tracking-wide">Decision Brief</h2>
        <p className="text-xs text-slate-500">Ringkasan sinyal dan pencatatan jurnal keputusan transaksi Anda</p>
      </div>
      
      <div className="flex flex-col gap-4 mb-8">
        {/* Pros Box */}
        <div className="bg-emerald-50/20 border border-emerald-100/60 p-5 rounded-xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 border border-emerald-200 text-[10px]">✓</span> 
            Sinyal Positif
          </h3>
          <ul className="space-y-3">
            {pros.map((p, i) => (
              <li key={i} className="text-xs text-slate-700 flex items-start gap-2.5 leading-relaxed">
                <span className="text-emerald-500 mt-1 select-none">•</span> {p}
              </li>
            ))}
            {pros.length === 0 && <li className="text-xs text-slate-400 italic">Belum ada sinyal positif yang cukup kuat.</li>}
          </ul>
        </div>
        
        {/* Cons Box */}
        <div className="bg-rose-50/20 border border-rose-100/60 p-5 rounded-xl">
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-100 border border-rose-200 text-[10px]">⚠️</span> 
            Faktor Risiko
          </h3>
          <ul className="space-y-3">
            {cons.map((c, i) => (
              <li key={i} className="text-xs text-slate-700 flex items-start gap-2.5 leading-relaxed">
                <span className="text-rose-500 mt-1 select-none">•</span> {c}
              </li>
            ))}
            {cons.length === 0 && <li className="text-xs text-slate-400 italic">Belum ada risiko mayor terdeteksi.</li>}
          </ul>
        </div>
      </div>

      <div className="flex gap-3 pt-6 border-t border-slate-100">
        <button 
          onClick={() => toggleForm('Masuk')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all duration-300 tracking-wider uppercase border ${
            activeForm === 'Masuk' 
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-600 shadow-md shadow-emerald-500/10' 
              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100/50 border-emerald-100'
          }`}
        >
          Masuk
        </button>
        <button 
          onClick={() => toggleForm('Watchlist')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all duration-300 tracking-wider uppercase border ${
            activeForm === 'Watchlist' 
              ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white border-amber-600 shadow-md shadow-amber-500/10' 
              : 'bg-amber-55 text-amber-600 hover:bg-amber-100/50 border-amber-100'
          }`}
        >
          Watchlist
        </button>
        <button 
          onClick={() => toggleForm('Skip')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all duration-300 tracking-wider uppercase border ${
            activeForm === 'Skip' 
              ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-600 shadow-md shadow-rose-500/10' 
              : 'bg-rose-50 text-rose-600 hover:bg-rose-100/50 border-rose-100'
          }`}
        >
          Skip
        </button>
      </div>

      {activeForm && (
        <div className="mt-5 p-5 bg-slate-50 border border-slate-200 rounded-xl animate-in fade-in duration-205">
          {activeForm === 'Masuk' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-550 mb-1.5">Jumlah Akun</label>
                  <input type="number" min="1" value={akunCount} onChange={e => setAkunCount(parseInt(e.target.value) || 1)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-550 mb-1.5">Lot per Akun</label>
                  <input type="number" min="1" value={lotPerAkun} onChange={e => setLotPerAkun(parseInt(e.target.value) || 1)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm" />
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-xs space-y-2">
                <div className="flex justify-between text-slate-650">
                  <span>Total Didaftarkan:</span>
                  <span className="font-semibold text-slate-905">{totalLot} Lot</span>
                </div>
                <div className="flex justify-between text-slate-650">
                  <span>Est. Lot Didapat:</span>
                  <span className="font-semibold text-blue-600">{lotDidapat !== null ? `${lotDidapat} Lot` : '—'}</span>
                </div>
                <div className="flex justify-between text-slate-700 pt-2.5 border-t border-slate-200 mt-2 text-sm font-bold">
                  <span>Est. Kebutuhan Dana:</span>
                  <span className="text-slate-905">{estimatedCost !== null ? `Rp ${estimatedCost.toLocaleString('id-ID')}` : '—'}</span>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-550 mb-1.5">Catatan / Alasan {activeForm}</label>
            <textarea 
              value={reason} 
              onChange={e => setReason(e.target.value)} 
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 text-sm h-24 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
              placeholder={`Mengapa memutuskan untuk ${activeForm}? Tulis analisis singkat Anda...`}
            ></textarea>
          </div>

          <div className="flex justify-end mt-4">
            <button 
              onClick={() => submitDecision(activeForm)}
              disabled={loading}
              className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-white shadow-md transition-all duration-300 ${
                activeForm === 'Masuk' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/10' : 
                activeForm === 'Skip' ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-500/10' : 
                'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/10'
              }`}
            >
              {loading ? 'Menyimpan...' : 'Simpan Jurnal'}
            </button>
          </div>
        </div>
      )}

      {decisions && decisions.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Riwayat Keputusan
          </h3>
          <div className="space-y-3">
            {decisions.map((d: any) => (
              <div key={d.id} className="bg-slate-50/50 border border-slate-200 p-4 rounded-xl">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-[9px] font-bold uppercase px-2.5 py-0.5 rounded border ${
                    d.decision === 'Masuk' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                    d.decision === 'Skip' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                    'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    {d.decision}
                  </span>
                  <span className="text-[10px] text-slate-450 font-mono">{new Date(d.created_at).toLocaleDateString('id-ID')}</span>
                </div>
                {d.decision === 'Masuk' && (
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    Alokasi: <span className="text-slate-900">{d.akun_count} Akun</span> × <span className="text-slate-900">{d.lot_per_akun} Lot</span>
                  </div>
                )}
                {d.reason && <p className="text-xs text-slate-600 leading-relaxed font-normal">{d.reason}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
