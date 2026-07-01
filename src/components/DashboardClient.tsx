'use client';

import { useState } from 'react';
import IPOCard from './IPOCard';
import { useRouter } from 'next/navigation';

const FILTERS = ['Semua', 'Book Building', 'Waiting For Offering', 'Offering', 'Pre-Effective', 'Listed'];

export default function DashboardClient({ initialIpos }: { initialIpos: any[] }) {
  const [activeFilter, setActiveFilter] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [animationKey, setAnimationKey] = useState(0);
  const router = useRouter();

  const handleFilter = (filter: string) => {
    setActiveFilter(filter);
    setAnimationKey(k => k + 1);
  };

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    setAnimationKey(k => k + 1);
  };

  const filteredIpos = initialIpos.filter(ipo => {
    // Tentukan status dinamis berdasarkan tanggal untuk kecocokan filter
    let resolvedStatus = ipo.status?.toLowerCase().replace(/_/g, ' ') || 'pre-effective';
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (ipo.offering_open && ipo.offering_close) {
      if (todayStr >= ipo.offering_open && todayStr <= ipo.offering_close) {
        resolvedStatus = 'offering';
      } else if (todayStr > ipo.offering_close && resolvedStatus !== 'listed') {
        resolvedStatus = 'pre-effective';
      }
    } else if (ipo.bb_open && ipo.bb_close) {
      if (todayStr >= ipo.bb_open && todayStr <= ipo.bb_close) {
        resolvedStatus = 'book building';
      } else if (todayStr > ipo.bb_close && resolvedStatus === 'book building') {
        resolvedStatus = 'waiting for offering';
      }
    }

    if (activeFilter !== 'Semua') {
      const activeFilterClean = activeFilter.toLowerCase().replace(/_/g, ' ');
      if (resolvedStatus !== activeFilterClean) return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const ticker = ipo.ticker?.toLowerCase() || '';
      const name = ipo.company_name?.toLowerCase() || '';
      const sector = ipo.sector?.toLowerCase() || '';
      return ticker.includes(q) || name.includes(q) || sector.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">

      {/* Control Panel */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">

        {/* Filter Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide flex-1">
          {FILTERS.map(filter => (
            <button
              key={filter}
              onClick={() => handleFilter(filter)}
              className={`
                btn-press px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider
                whitespace-nowrap border select-none
                ${activeFilter === filter
                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 scale-[1.03]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300'
                }
              `}
              style={{ transition: 'transform 0.1s ease, box-shadow 0.18s ease, background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease' }}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80 group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <svg className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors duration-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Cari kode atau nama emiten..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="block w-full pl-10 pr-8 py-2.5 border border-slate-200/90 rounded-xl bg-white text-slate-800
              placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
              text-xs font-semibold shadow-sm transition-all duration-200 hover:border-slate-300"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearch('')}
              className="btn-press absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 text-sm font-bold transition-colors duration-150"
            >
              &times;
            </button>
          )}
        </div>

      </div>

      {/* Card Grid — key berubah setiap filter/search change → re-mount → stagger animasi */}
      <div
        key={animationKey}
        className="grid gap-3 stagger-children"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}
      >
        {filteredIpos.map(ipo => (
          <div key={ipo.id} className="animate-card-in">
            <IPOCard ipo={ipo} onClick={() => router.push(`/ipo/${ipo.ticker}`)} />
          </div>
        ))}
        {filteredIpos.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-white border border-slate-200 rounded-xl shadow-sm animate-fade-in">
            Tidak ada data IPO yang cocok dengan filter atau pencarian ini.
          </div>
        )}
      </div>

    </div>
  );
}
