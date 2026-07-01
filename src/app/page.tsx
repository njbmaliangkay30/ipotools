import { supabase } from '@/lib/supabase';
import ScrapeButton from '@/components/ScrapeButton';
import DashboardClient from '@/components/DashboardClient';

export const revalidate = 0;

export default async function Home() {
  const { data: ipos, error } = await supabase
    .from('ipos')
    .select(`
      *,
      ipo_signals (*),
      ipo_underwriters (
        role,
        underwriters (*)
      )
    `)
    .neq('status', 'closed')
    .neq('status', 'canceled')
    .order('listing_date', { ascending: false, nullsFirst: true });

  const sortedIpos = (ipos || []).sort((a, b) => {
    const statusA = a.status?.toLowerCase().replace(/_/g, ' ') || 'pre-effective';
    const statusB = b.status?.toLowerCase().replace(/_/g, ' ') || 'pre-effective';
    
    const statusPriority: Record<string, number> = {
      'offering': 1,
      'book building': 2,
      'waiting for offering': 3,
      'pre-effective': 4,
      'listed': 5
    };
    
    const prioA = statusPriority[statusA] || 99;
    const prioB = statusPriority[statusB] || 99;
    
    if (prioA !== prioB) {
      return prioA - prioB;
    }
    
    if (a.listing_date && b.listing_date) {
      return new Date(b.listing_date).getTime() - new Date(a.listing_date).getTime();
    }
    if (a.listing_date) return -1;
    if (b.listing_date) return 1;
    
    return a.ticker.localeCompare(b.ticker);
  });

  return (
    <div className="space-y-8 text-slate-800">
      <header className="border-b border-slate-200 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">IPO Decision Dashboard</h1>
          <p className="text-slate-500 mt-2 text-sm">Monitor IPO pipeline and insider signals for momentum trading.</p>
        </div>
        <ScrapeButton />
      </header>

      {error ? (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg shadow-sm">
          Error fetching data: {error.message}. Have you run the SQL migration?
        </div>
      ) : (
        <DashboardClient initialIpos={sortedIpos} />
      )}
    </div>
  );
}
