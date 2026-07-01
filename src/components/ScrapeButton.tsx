'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ScrapeButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const router = useRouter();

  const handleScrape = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/scrape-nli?year=2024,2025,2026`);
      const data = await res.json();
      setResult(data);
      router.refresh(); 
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={handleScrape}
        disabled={loading}
        title="Sinkronisasi Data Manual (2024-2026)"
        className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-sm hover:shadow active:scale-95"
      >
        <svg 
          className={`w-4 h-4 text-slate-500 transition-transform ${loading ? 'animate-spin' : 'group-hover:rotate-180 duration-500'}`}
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24" 
          strokeWidth={2.5} 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        <span>{loading ? 'Syncing...' : 'Sync Data'}</span>
      </button>

      {result && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-xl text-xs max-w-sm z-50 shadow-lg border animate-in fade-in slide-in-from-bottom-5 duration-300 ${
          result.success 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-250/50' 
            : 'bg-rose-50 text-rose-800 border-rose-250/50'
        }`}>
          <div className="flex justify-between items-center gap-4 mb-1.5 font-bold uppercase tracking-wider text-[10px]">
            <p className={result.success ? 'text-emerald-700' : 'text-rose-700'}>
              {result.success ? 'Sinkronisasi Berhasil!' : 'Sinkronisasi Gagal'}
            </p>
            <button onClick={() => setResult(null)} className="text-sm font-semibold leading-none hover:opacity-70">&times;</button>
          </div>
          <p className="opacity-90 leading-relaxed">
            {result.count ? `${result.count} data IPO berhasil diperbarui.` : result.error}
          </p>
        </div>
      )}
    </div>
  );
}
