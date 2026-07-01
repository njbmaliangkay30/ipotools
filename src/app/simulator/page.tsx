import { supabase } from '@/lib/supabase';
import SimulatorClient from '@/components/SimulatorClient';

export const dynamic = 'force-dynamic';

export default async function SimulatorPage() {
  // Ambil data emiten yang berstatus pre-listed (selain 'listed')
  const { data: ipos } = await supabase
    .from('ipos')
    .select(`
      id,
      ticker,
      company_name,
      ipo_price,
      bb_price_low,
      bb_price_high,
      offering_open,
      offering_close,
      listing_date,
      status,
      ipo_signals (
        os_estimate
      )
    `)
    .order('ticker', { ascending: true });

  const formattedIpos = (ipos || []).map(ipo => {
    const signal = Array.isArray(ipo.ipo_signals) ? ipo.ipo_signals[0] : ipo.ipo_signals;
    return {
      id: ipo.id,
      ticker: ipo.ticker,
      name: ipo.company_name,
      price: ipo.ipo_price || ipo.bb_price_high || ipo.bb_price_low || 100, // fallback jika kosong
      status: ipo.status || 'upcoming',
      offeringOpen: ipo.offering_open,
      offeringClose: ipo.offering_close,
      listingDate: ipo.listing_date,
      osEstimate: signal?.os_estimate || null
    };
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Multi-UID Wallet Simulator</h1>
        <p className="text-sm text-slate-500">Simulasikan penempatan dana dan perputaran modal (cash recycling) untuk 4 akun (UID) pada emiten pre-listing e-IPO.</p>
      </div>

      <SimulatorClient initialIpos={formattedIpos} />
    </div>
  );
}
