import { supabase } from '@/lib/supabase';
import CalculatorClient from './CalculatorClient';

export const dynamic = 'force-dynamic';

export default async function CalculatorPage() {
  // Ambil data ticker dan harga untuk inisialisasi input kalkulator secara dinamis
  const { data: ipos } = await supabase
    .from('ipos')
    .select('ticker, company_name, ipo_price, bb_price_high, bb_price_low, listing_board')
    .neq('status', 'listed')
    .order('ticker', { ascending: true });

  const formattedIpos = (ipos || []).map(ipo => ({
    ticker: ipo.ticker,
    name: ipo.company_name,
    price: ipo.ipo_price || ipo.bb_price_high || ipo.bb_price_low || 0,
    board: ipo.listing_board || 'REGULAR'
  }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Kalkulator ARA & ARB</h1>
        <p className="text-sm text-slate-500">Hitung batas Auto Rejection Atas (ARA) dan Auto Rejection Bawah (ARB) BEI secara dinamis dan multi-hari untuk perencanaan trading.</p>
      </div>

      <CalculatorClient initialIpos={formattedIpos} />
    </div>
  );
}
