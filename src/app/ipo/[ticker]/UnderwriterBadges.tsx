'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function UnderwriterBadges({ 
  underwriters 
}: { 
  underwriters: any[] 
}) {
  const [selectedUw, setSelectedUw] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!selectedUw) {
      setHistory([]);
      return;
    }

    async function fetchHistory() {
      setLoadingHistory(true);
      try {
        const { data, error } = await supabase
          .from('ipo_underwriters')
          .select(`
            role,
            ipos (
              ticker,
              company_name,
              ipo_price,
              listing_date,
              status
            )
          `)
          .eq('broker_code', selectedUw.broker_code);

        if (!error && data) {
          const list = data
            .map((item: any) => ({
              role: item.role,
              ...(item.ipos || {})
            }))
            .filter((item: any) => item.ticker);
          setHistory(list);
        }
      } catch (err) {
        console.error('Error fetching underwriter history:', err);
      } finally {
        setLoadingHistory(false);
      }
    }

    fetchHistory();
  }, [selectedUw]);

  if (!underwriters || underwriters.length === 0) {
    return <span className="text-slate-400 text-xs italic">TBA</span>;
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5 items-center">
        {underwriters.map((uwRel: any, idx: number) => {
          const uw = uwRel.underwriters;
          if (!uw) return null;
          return (
            <button
              key={idx}
              onClick={() => setSelectedUw(uw)}
              className="flex items-center gap-1.5 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-300 px-2 py-1 rounded-lg transition-all text-[11px] group cursor-pointer text-left"
              title={`Klik untuk melihat winrate & historis ${uw.name}`}
            >
              <span className="font-semibold text-slate-700 group-hover:text-indigo-900 transition-colors">
                {uw.name}
              </span>
              {uw.broker_code && (
                <span className="font-mono text-[9px] font-black text-blue-650 bg-blue-50 border border-blue-100 group-hover:bg-indigo-100/50 px-1 rounded">
                  {uw.broker_code}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Underwriter Detail Modal */}
      {selectedUw && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-start">
              <div>
                <span className="font-mono text-[10px] font-black text-blue-650 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md">
                  BROKER: {selectedUw.broker_code}
                </span>
                <h3 className="text-base font-extrabold text-slate-800 mt-1.5">{selectedUw.name}</h3>
              </div>
              <button 
                onClick={() => setSelectedUw(null)}
                className="text-slate-400 hover:text-slate-650 text-xl font-bold p-1 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              
              {/* Aggregated Stats Grid */}
              <div>
                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">Track Record Statistik</h4>
                {selectedUw.data_points >= 5 ? (
                  <div className="grid grid-cols-2 gap-3 text-center text-xs">
                    <div className="bg-emerald-50/20 border border-emerald-100/80 p-3 rounded-xl">
                      <div className="text-[9px] text-emerald-700/70 mb-0.5 uppercase tracking-wider font-semibold">Win Rate (ARA D+1)</div>
                      <div className="text-xl font-black text-emerald-600">{selectedUw.win_rate}%</div>
                    </div>
                    <div className="bg-indigo-50/20 border border-indigo-100/80 p-3 rounded-xl">
                      <div className="text-[9px] text-indigo-700/70 mb-0.5 uppercase tracking-wider font-semibold">ARA D+1 Rate</div>
                      <div className="text-xl font-black text-indigo-600">{selectedUw.ara_d1}%</div>
                    </div>
                    <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl">
                      <div className="text-[9px] text-slate-500 mb-0.5 uppercase tracking-wider font-medium">Avg ARA Streak</div>
                      <div className="text-lg font-extrabold text-slate-800">{selectedUw.avg_ara_streak} Hari</div>
                    </div>
                    <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-xl">
                      <div className="text-[9px] text-slate-500 mb-0.5 uppercase tracking-wider font-medium">Total Emisi Dikelola</div>
                      <div className="text-lg font-extrabold text-slate-800">{selectedUw.data_points} IPO</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                    Data belum mencukupi untuk analisis tingkat kemenangan ({selectedUw.data_points || 0} IPO terdaftar).
                  </div>
                )}
              </div>

              {/* Historical IPO List */}
              <div>
                <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                  Daftar IPO Historis di Database
                </h4>
                {loadingHistory ? (
                  <div className="text-center py-4 text-xs text-slate-450">Memuat riwayat...</div>
                ) : history.length > 0 ? (
                  <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {history.map((item, idx) => (
                      <div key={idx} className="p-3 hover:bg-slate-50/30 flex justify-between items-center text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-800">{item.ticker}</span>
                            <span className="text-[9px] text-slate-450 uppercase">{item.role || 'Underwriter'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block max-w-[200px] truncate">{item.company_name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-semibold text-slate-700 block">
                            {item.ipo_price ? `Rp ${item.ipo_price.toLocaleString('id-ID')}` : '—'}
                          </span>
                          <span className="text-[9px] text-slate-450 block">
                            {item.listing_date ? new Date(item.listing_date).toLocaleDateString('id-ID', { year: 'numeric', month: 'short' }) : '—'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-450 italic py-2">Belum ada riwayat tercatat.</div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedUw(null)}
                className="text-xs font-bold text-slate-650 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl transition-all shadow-sm"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
