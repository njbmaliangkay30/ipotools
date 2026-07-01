import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import InsiderRiskSection from './InsiderRiskSection';
import MomentumSignalsSection from './MomentumSignalsSection';
import DecisionBriefSection from './DecisionBriefSection';
import UnderwriterBadges from './UnderwriterBadges';

export const dynamic = 'force-dynamic';

export default async function IPODetailPage({ params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();

  const { data: ipo, error } = await supabase
    .from('ipos')
    .select(`
      *,
      ipo_signals (*),
      ipo_insider_risk (*),
      decisions (*),
      ipo_shareholders (*),
      ipo_financial_highlights (*),
      ipo_underwriters (
        role,
        underwriters (*)
      )
    `)
    .eq('ticker', ticker)
    .single();

  if (error || !ipo) {
    notFound();
  }

  const statusColor: Record<string, string> = {
    'book building': 'bg-purple-50 text-purple-700 border-purple-200/50',
    'waiting for offering': 'bg-amber-50 text-amber-700 border-amber-200/50',
    'offering': 'bg-blue-50 text-blue-700 border-blue-200/50',
    'pre-effective': 'bg-slate-100 text-slate-600 border-slate-200/60',
    'listed': 'bg-emerald-50 text-emerald-700 border-emerald-200/50',
  };
  const activeColor = statusColor[ipo.status?.toLowerCase().replace(/_/g, ' ') || 'pre-effective'] || 'bg-slate-100 text-slate-600 border-slate-200/60';

  // Dana Maksimal = offered_shares × bb_price_high (batas atas dari prospektus ringkas)
  const danaMaksimalPrice = ipo.bb_price_high ?? ipo.ipo_price ?? ipo.bb_price_low ?? 0;
  const totalProceedsRp = (ipo.offered_shares ?? 0) * danaMaksimalPrice;

  const formatDate = (date: string | null) =>
    date ? new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const formatDateRange = (startStr: string | null, endStr: string | null) => {
    if (!startStr || !endStr) return '—';
    const start = new Date(startStr);
    const end = new Date(endStr);
    
    const startDay = start.getDate();
    const endDay = end.getDate();
    const startMonth = start.toLocaleDateString('id-ID', { month: 'short' });
    const endMonth = end.toLocaleDateString('id-ID', { month: 'short' });
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    
    if (startYear !== endYear) {
      return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
    }
    if (startMonth !== endMonth) {
      return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${endYear}`;
    }
    return `${startDay} – ${endDay} ${endMonth} ${endYear}`;
  };

  const signals = Array.isArray(ipo.ipo_signals) ? ipo.ipo_signals[0] : ipo.ipo_signals;
  const financial = Array.isArray(ipo.ipo_financial_highlights) ? ipo.ipo_financial_highlights[0] : ipo.ipo_financial_highlights;
  const insiderRisk = Array.isArray(ipo.ipo_insider_risk) ? ipo.ipo_insider_risk[0] : ipo.ipo_insider_risk;

  function getPenjatahanDetails(golonganStr: string | null) {
    if (!golonganStr) return null;
    const lower = golonganStr.toLowerCase();
    let name = "";
    let alokasiAwal = "";
    let penyesuaian: { range: string, pct: string }[] = [];
    
    if (lower.includes("golongan i ") || lower.includes("golongan i(") || lower.startsWith("i ")) {
      name = "Golongan I (Emisi ≤ Rp100 Miliar)";
      alokasiAwal = "Min 20% (atau Rp10 Miliar)";
      penyesuaian = [
        { range: "2.5x ≤ X < 10x", pct: "22.5%" },
        { range: "10x ≤ X < 25x", pct: "25.0%" },
        { range: "X ≥ 25x", pct: "30.0%" }
      ];
    } else if (lower.includes("golongan ii") || lower.includes("ii ")) {
      name = "Golongan II (Rp100 M - Rp250 M)";
      alokasiAwal = "Min 15% (atau Rp20 Miliar)";
      penyesuaian = [
        { range: "2.5x ≤ X < 10x", pct: "17.5%" },
        { range: "10x ≤ X < 25x", pct: "20.0%" },
        { range: "X ≥ 25x", pct: "25.0%" }
      ];
    } else if (lower.includes("golongan iii") || lower.includes("iii ")) {
      name = "Golongan III (Rp250 M - Rp500 M)";
      alokasiAwal = "Min 10% (atau Rp37.5 Miliar)";
      penyesuaian = [
        { range: "2.5x ≤ X < 10x", pct: "12.5%" },
        { range: "10x ≤ X < 25x", pct: "15.0%" },
        { range: "X ≥ 25x", pct: "20.0%" }
      ];
    } else if (lower.includes("golongan iv") || lower.includes("iv ")) {
      name = "Golongan IV (Rp500 M - Rp1 T)";
      alokasiAwal = "Min 7.5% (atau Rp50 Miliar)";
      penyesuaian = [
        { range: "2.5x ≤ X < 10x", pct: "10.0%" },
        { range: "10x ≤ X < 25x", pct: "12.5%" },
        { range: "X ≥ 25x", pct: "17.5%" }
      ];
    } else if (lower.includes("golongan v") || lower.includes("v ")) {
      name = "Golongan V (Emisi > Rp1 Triliun)";
      alokasiAwal = "Min 2.5% (atau Rp75 Miliar)";
      penyesuaian = [
        { range: "2.5x ≤ X < 10x", pct: "5.0%" },
        { range: "10x ≤ X < 25x", pct: "7.5%" },
        { range: "X ≥ 25x", pct: "12.5%" }
      ];
    } else {
      name = golonganStr;
      alokasiAwal = "—";
    }
    return { name, alokasiAwal, penyesuaian };
  }

  const getDomain = (url: string | null) => {
    if (!url) return '';
    try {
      const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
      return new URL(cleanUrl).hostname;
    } catch (e) {
      return '';
    }
  };

  const logoUrl = ipo.logo_url
    || (ipo.website && getDomain(ipo.website)
      ? `https://www.google.com/s2/favicons?domain=${getDomain(ipo.website)}&sz=64`
      : `https://ui-avatars.com/api/?name=${ipo.ticker}&background=3b82f6&color=fff&size=64&bold=true`);

  return (
    <div className="space-y-8 text-slate-800">
      
      {/* Header Bento Box */}
      <header className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          {/* Baris Atas: Logo + Ticker & Nama PT */}
          <div className="flex items-center gap-4">
            <img
              src={logoUrl}
              alt={`${ipo.ticker} Logo`}
              className="w-12 h-12 rounded-xl object-contain bg-slate-50 p-1"
            />
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{ipo.ticker}</h1>
                <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded border border-slate-200/40">
                  {ipo.listing_board || 'BOARD TBA'}
                </span>
              </div>
              <p className="text-slate-500 font-medium text-sm mt-0.5">{ipo.company_name}</p>
            </div>
          </div>
          
          {/* Baris Bawah: Status & Sektor */}
          <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-wider pl-1">
            <span className={`px-2.5 py-0.5 border rounded-full ${activeColor}`}>{ipo.status}</span>
            <span className="px-2.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200/80">
              {ipo.sector || 'SECTOR TBA'}
            </span>
          </div>
        </div>
        
        {/* Underwriter Badges (Interactive Modal) */}
        <div className="flex flex-col gap-2 items-start sm:items-end self-start sm:self-center">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Underwriters (Klik Detail)</span>
          <UnderwriterBadges underwriters={ipo.ipo_underwriters} />
        </div>
      </header>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Kolom Kiri: Ringkasan Detail (1 Kolom) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Informasi Emisi Efek (2x2 Grid) */}
          <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              Informasi Emisi Efek
            </h2>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                <div className="text-[9px] text-slate-450 uppercase font-semibold mb-1">Harga Final</div>
                <div className="text-base font-black text-slate-800 tracking-tight">
                  {ipo.ipo_price ? `Rp ${ipo.ipo_price.toLocaleString('id-ID')}` : 'TBA'}
                </div>
                {!ipo.ipo_price && ipo.bb_price_low && ipo.bb_price_high && (
                  <span className="text-[9px] text-slate-400 block mt-0.5">
                    Kisaran BB: Rp {ipo.bb_price_low}–{ipo.bb_price_high}
                  </span>
                )}
              </div>
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                <div className="text-[9px] text-slate-450 uppercase font-semibold mb-1">Target Dana</div>
                <div className="text-base font-black text-blue-600 tracking-tight">
                  {totalProceedsRp > 0 ? `Rp ${(totalProceedsRp / 1e9).toFixed(1)}M` : '—'}
                </div>
              </div>
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                <div className="text-[9px] text-slate-450 uppercase font-semibold mb-1">Saham Ditawarkan</div>
                <div className="text-xs font-bold text-slate-800">
                  {ipo.offered_shares ? `${(ipo.offered_shares / 1e6).toFixed(1)}M lbr` : '—'}
                </div>
              </div>
              <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                <div className="text-[9px] text-slate-450 uppercase font-semibold mb-1">Porsi Publik float</div>
                <div className="text-xs font-bold text-slate-800">
                  {ipo.public_float_pct ? `${ipo.public_float_pct}%` : '—'}
                </div>
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Timeline Penawaran</h2>
            <ul className="space-y-2.5 text-xs text-slate-650">
              {ipo.bb_open && (
                <li className="flex justify-between">
                  <span className="text-slate-450">Book Building</span>
                  <span className="font-semibold text-slate-800">{formatDateRange(ipo.bb_open, ipo.bb_close)}</span>
                </li>
              )}
              {ipo.offering_open && (
                <li className="flex justify-between">
                  <span className="text-slate-450">Offering</span>
                  <span className="font-semibold text-slate-800">{formatDateRange(ipo.offering_open, ipo.offering_close)}</span>
                </li>
              )}
              {ipo.distribution_date && (
                <li className="flex justify-between">
                  <span className="text-slate-450">Distribusi</span>
                  <span className="font-semibold text-slate-800">{formatDate(ipo.distribution_date)}</span>
                </li>
              )}
              {ipo.listing_date && (
                <li className="flex justify-between pt-2 border-t border-slate-100 mt-2">
                  <span className="text-slate-900 font-bold">Pencatatan (Listing)</span>
                  <span className="font-extrabold text-emerald-600">{formatDate(ipo.listing_date)}</span>
                </li>
              )}
              {!ipo.bb_open && !ipo.listing_date && <li className="text-gray-400 italic">Jadwal belum diumumkan</li>}
            </ul>
          </section>

          {/* Financial Highlights */}
          {financial && (
            <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              {financial.periode_laporan?.startsWith('HISTORICAL:') ? (() => {
                try {
                  const historicalList = JSON.parse(financial.periode_laporan.replace('HISTORICAL:', ''));
                  // Sort by year descending (latest first)
                  const sortedList = [...historicalList].sort((a: any, b: any) => parseInt(b.tahun) - parseInt(a.tahun));
                  
                  return (
                    <div>
                      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3.5 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Kinerja Keuangan Historis
                      </h2>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left text-slate-650">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                              <th className="py-2 pr-2 font-semibold">Pos Keuangan</th>
                              {sortedList.map((item: any, i: number) => (
                                <th key={i} className="py-2 px-1 text-right font-bold text-slate-700">{item.tahun}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {/* Pendapatan */}
                            <tr className="border-b border-slate-50/50 hover:bg-slate-50/20">
                              <td className="py-2.5 pr-2 font-medium text-slate-500">Pendapatan</td>
                              {sortedList.map((item: any, i: number) => (
                                <td key={i} className="py-2.5 px-1 text-right font-bold text-slate-800">
                                  {item.pendapatan ? `Rp ${(item.pendapatan / 1e9).toFixed(1)}M` : '—'}
                                </td>
                              ))}
                            </tr>
                            {/* Laba Bersih */}
                            <tr className="border-b border-slate-50/50 hover:bg-slate-50/20">
                              <td className="py-2.5 pr-2 font-medium text-slate-500">Laba Bersih</td>
                              {sortedList.map((item: any, i: number) => (
                                <td key={i} className={`py-2.5 px-1 text-right font-black ${
                                  item.laba_bersih >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                }`}>
                                  {item.laba_bersih ? `Rp ${(item.laba_bersih / 1e9).toFixed(1)}M` : '—'}
                                </td>
                              ))}
                            </tr>
                            {/* Aset */}
                            <tr className="border-b border-slate-50/50 hover:bg-slate-50/20">
                              <td className="py-2.5 pr-2 font-medium text-slate-500">Total Aset</td>
                              {sortedList.map((item: any, i: number) => (
                                <td key={i} className="py-2.5 px-1 text-right font-semibold text-slate-700">
                                  {item.total_aset ? `Rp ${(item.total_aset / 1e9).toFixed(1)}M` : '—'}
                                </td>
                              ))}
                            </tr>
                            {/* Liabilitas */}
                            <tr className="border-b border-slate-50/50 hover:bg-slate-50/20">
                              <td className="py-2.5 pr-2 font-medium text-slate-500">Liabilitas</td>
                              {sortedList.map((item: any, i: number) => (
                                <td key={i} className="py-2.5 px-1 text-right font-semibold text-amber-700">
                                  {item.total_liabilitas ? `Rp ${(item.total_liabilitas / 1e9).toFixed(1)}M` : '—'}
                                </td>
                              ))}
                            </tr>
                            {/* Ekuitas */}
                            <tr className="border-b border-slate-50/50 hover:bg-slate-50/20">
                              <td className="py-2.5 pr-2 font-medium text-slate-500">Ekuitas</td>
                              {sortedList.map((item: any, i: number) => (
                                <td key={i} className="py-2.5 px-1 text-right font-semibold text-slate-700">
                                  {item.total_ekuitas ? `Rp ${(item.total_ekuitas / 1e9).toFixed(1)}M` : '—'}
                                </td>
                              ))}
                            </tr>
                            {/* DER */}
                            <tr className="border-b border-slate-50/50 hover:bg-slate-50/20">
                              <td className="py-2.5 pr-2 font-medium text-slate-500">DER (Rasio Utang)</td>
                              {sortedList.map((item: any, i: number) => {
                                const der = item.total_liabilitas && item.total_ekuitas 
                                  ? (item.total_liabilitas / item.total_ekuitas) 
                                  : null;
                                return (
                                  <td key={i} className={`py-2.5 px-1 text-right font-bold ${
                                    der && der > 2 ? 'text-rose-600' : 'text-slate-800'
                                  }`}>
                                    {der ? `${der.toFixed(2)}x` : '—'}
                                  </td>
                                );
                              })}
                            </tr>
                            {/* ROE */}
                            <tr className="hover:bg-slate-50/20">
                              <td className="py-2.5 pr-2 font-medium text-slate-500">ROE (Laba/Ekuitas)</td>
                              {sortedList.map((item: any, i: number) => {
                                const roe = item.laba_bersih && item.total_ekuitas 
                                  ? (item.laba_bersih / item.total_ekuitas) * 100 
                                  : null;
                                return (
                                  <td key={i} className="py-2.5 px-1 text-right font-bold text-emerald-600">
                                    {roe ? `${roe.toFixed(1)}%` : '—'}
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                } catch (e) {
                  return null;
                }
              })() : (financial.pendapatan || financial.laba_bersih) ? (
                <div>
                  <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Financial Highlights ({financial.periode_laporan || 'Audited'})
                  </h2>
                  <div className="space-y-2.5 text-xs text-slate-650">
                    {financial.pendapatan && (
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-slate-450">Pendapatan</span>
                        <span className="font-bold text-slate-800">Rp {(financial.pendapatan / 1e9).toFixed(2)} M</span>
                      </div>
                    )}
                    {financial.laba_bersih && (
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-slate-450">Laba Bersih</span>
                        <span className={`font-extrabold ${financial.laba_bersih >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          Rp {(financial.laba_bersih / 1e9).toFixed(2)} M
                        </span>
                      </div>
                    )}
                    {financial.total_aset && (
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-slate-450">Total Aset</span>
                        <span className="font-semibold text-slate-800">Rp {(financial.total_aset / 1e9).toFixed(2)} M</span>
                      </div>
                    )}
                    {financial.total_liabilitas && (
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-slate-450">Total Liabilitas</span>
                        <span className="font-semibold text-slate-800 text-amber-700">Rp {(financial.total_liabilitas / 1e9).toFixed(2)} M</span>
                      </div>
                    )}
                    {financial.total_ekuitas && (
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-slate-450">Total Ekuitas</span>
                        <span className="font-semibold text-slate-800">Rp {(financial.total_ekuitas / 1e9).toFixed(2)} M</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-450 italic">Kinerja keuangan belum tersedia.</p>
              )}
            </section>
          )}

          {/* Penjatahan & Probabilitas ARA (Estimasi & Sinyal) */}
          <section className="space-y-4">
            {/* Est. Oversubscription Box */}
            <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-5 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl select-none">🎟️</div>
              <div className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                Est. Oversubscription
                <span className="text-[9px] uppercase font-extrabold bg-blue-50/50 border border-blue-200/50 px-1.5 py-0.5 rounded tracking-wide">
                  {signals?.os_confidence || 'LOW'} CONF
                </span>
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                {signals?.os_estimate ? `${signals.os_estimate}x` : '—'}
              </div>
              
              {signals?.os_estimate && (
                <div className="mt-4 pt-3 border-t border-blue-100/50">
                  <div className="text-[9px] uppercase font-bold text-slate-450 tracking-wider mb-1">Perkiraan Penjatahan</div>
                  <div className="text-xs font-bold text-slate-800">
                    {Math.floor(10 / signals.os_estimate)} Lot <span className="text-[10px] text-slate-500 font-normal">/ Akun (Asumsi daftar 10 lot)</span>
                  </div>
                </div>
              )}
            </div>

            {/* ARA Streak Box */}
            <div className="bg-purple-50/40 border border-purple-100 rounded-xl p-5 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 text-5xl select-none">🔥</div>
              <div className="text-xs text-purple-600 font-bold uppercase tracking-wider mb-2">ARA Probability</div>
              <div className="text-3xl font-black text-slate-900 tracking-tight mb-3">
                {signals?.ara_probability ? `${Math.round(signals.ara_probability * 100)}%` : '—'}
              </div>
              
              <div className="space-y-1.5 text-[10px] text-slate-600 border-t border-purple-100/50 pt-3">
                <div className="flex justify-between">
                  <span className="text-slate-450">UW Avg Streak:</span>
                  <span className="font-bold text-slate-800">{ipo.ipo_underwriters?.[0]?.underwriters?.avg_ara_streak || 0} Hari</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-450">Community Buzz:</span>
                  <span className="font-bold text-slate-800">{signals?.community_buzz || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-450">Sektor Momentum:</span>
                  <span className="font-bold text-slate-800">{(signals?.sector_momentum_60d || 0)}%</span>
                </div>
              </div>
            </div>

            {/* Centralized Allocation (Penjatahan Terpusat) Box */}
            {insiderRisk?.penjatahan_golongan && (() => {
              const p = getPenjatahanDetails(insiderRisk.penjatahan_golongan);
              if (!p) return null;
              return (
                <div className="bg-slate-50/40 border border-slate-200/85 rounded-xl p-5 shadow-sm">
                  <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    Penjatahan Terpusat (E-IPO)
                  </div>
                  <div className="space-y-3 text-xs">
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-400">Penggolongan</span>
                      <span className="font-extrabold text-slate-800 text-right">{p.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-400">Alokasi Murni</span>
                      <span className="font-bold text-blue-600">{p.alokasiAwal}</span>
                    </div>
                    
                    {p.penyesuaian.length > 0 && (
                      <div className="pt-1.5">
                        <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider block mb-2 text-left">
                          Penyesuaian Alokasi vs Tingkat Oversubs
                        </span>
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                          {p.penyesuaian.map((item, idx) => (
                            <div key={idx} className="bg-white border border-slate-150 p-2 rounded-lg shadow-sm/40">
                              <div className="text-slate-450 mb-0.5 font-medium">{item.range}</div>
                              <div className="font-black text-slate-800 text-xs">{item.pct}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {insiderRisk.catatan_alokasi_oversubs && (
                      <p className="text-[10px] text-slate-450 leading-relaxed italic border-t border-slate-100 pt-3 mt-1">
                        * {insiderRisk.catatan_alokasi_oversubs}
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}
          </section>

          <DecisionBriefSection 
              ipo={ipo} 
              signals={Array.isArray(ipo.ipo_signals) ? ipo.ipo_signals[0] : ipo.ipo_signals} 
              decisions={Array.isArray(ipo.decisions) ? ipo.decisions : [ipo.decisions].filter(Boolean)} 
              insiderRisk={Array.isArray(ipo.ipo_insider_risk) ? ipo.ipo_insider_risk[0] : ipo.ipo_insider_risk} 
          />

        </div>

        {/* Kolom Kanan: Analisis Mendalam (2 Kolom) */}
        <div className="lg:col-span-2 space-y-6">
          
          <InsiderRiskSection 
              ipo={ipo} 
              insiderRisk={Array.isArray(ipo.ipo_insider_risk) ? ipo.ipo_insider_risk[0] : ipo.ipo_insider_risk} 
              shareholders={ipo.ipo_shareholders || []}
          />

          <MomentumSignalsSection 
              ipo={ipo} 
              signals={Array.isArray(ipo.ipo_signals) ? ipo.ipo_signals[0] : ipo.ipo_signals} 
              underwriters={ipo.ipo_underwriters} 
          />

        </div>

      </div>

    </div>
  );
}
