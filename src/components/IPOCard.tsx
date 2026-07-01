import React, { useState } from 'react';
import { getIpoStatus, getIpoStatusLabel } from '@/lib/ipoStatus';

const STATUS_CONFIGS: Record<string, { badge: string; glow: string; border: string }> = {
  'book building':        { badge: 'bg-purple-50 text-purple-700 border-purple-200/60',    glow: 'hover:shadow-purple-500/[0.05]', border: 'hover:border-purple-300/80' },
  'waiting for offering': { badge: 'bg-amber-50 text-amber-700 border-amber-200/60',       glow: 'hover:shadow-amber-500/[0.05]',  border: 'hover:border-amber-300/80'  },
  'offering':             { badge: 'bg-blue-50 text-blue-700 border-blue-200/60',           glow: 'hover:shadow-blue-500/[0.05]',   border: 'hover:border-blue-300/80'   },
  'pre-effective':        { badge: 'bg-slate-100 text-slate-500 border-slate-200/60',       glow: 'hover:shadow-slate-400/[0.04]',  border: 'hover:border-slate-300/80'  },
  'listed':               { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',  glow: 'hover:shadow-emerald-500/[0.05]',border: 'hover:border-emerald-300/80' },
};

function getDomain(url: string): string {
  try {
    const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
    return new URL(cleanUrl).hostname;
  } catch {
    return '';
  }
}

export default function IPOCard({ ipo, onClick }: { ipo: any; onClick: () => void }) {
  const statusKey = getIpoStatus(ipo);
  const config = STATUS_CONFIGS[statusKey] || STATUS_CONFIGS['pre-effective'];
  const statusLabel = getIpoStatusLabel(statusKey);

  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(ipo.ticker)}&background=3b82f6&color=fff&size=64&bold=true&font-size=0.4`;
  const domain = ipo.website ? getDomain(ipo.website) : '';
  const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null;

  const [logoSrc, setLogoSrc] = useState<string>(ipo.logo_url || faviconUrl || avatarUrl);
  const [usedFallback, setUsedFallback] = useState(!!ipo.logo_url);

  const handleLogoLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (!usedFallback && faviconUrl && img.naturalWidth <= 16) {
      setUsedFallback(true);
      setLogoSrc(avatarUrl);
    }
  };

  const handleLogoError = () => {
    if (logoSrc === ipo.logo_url && faviconUrl) {
      setLogoSrc(faviconUrl);
    } else if (!usedFallback) {
      setUsedFallback(true);
      setLogoSrc(avatarUrl);
    }
  };

  const getActivePeriod = () => {
    if (statusKey === 'book building' && ipo.bb_open && ipo.bb_close) {
      return `BB: ${new Date(ipo.bb_open).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${new Date(ipo.bb_close).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`;
    }
    if (statusKey === 'offering' && ipo.offering_open && ipo.offering_close) {
      return `${new Date(ipo.offering_open).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${new Date(ipo.offering_close).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`;
    }
    return '';
  };

  const getPrice = () => {
    if (ipo.ipo_price) return `Rp ${ipo.ipo_price}`;
    if (ipo.bb_price_low) {
      if (ipo.bb_price_low === ipo.bb_price_high) return `Rp ${ipo.bb_price_low}`;
      return `Rp ${ipo.bb_price_low} – ${ipo.bb_price_high}`;
    }
    return '—';
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200/80 rounded-xl p-5 hover:-translate-y-[2px] transition-all duration-300 cursor-pointer flex flex-col gap-3 shadow-sm hover:shadow-lg ${config.glow} ${config.border} group`}
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shadow-sm">
          <img
            src={logoSrc}
            alt={`${ipo.ticker} logo`}
            className="w-8 h-8 object-contain"
            onLoad={handleLogoLoad}
            onError={handleLogoError}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-slate-800 group-hover:text-blue-600 transition-colors tracking-wide leading-none">
            {ipo.ticker}
          </h3>
          <p className="text-[11px] text-slate-500 truncate mt-0.5 leading-snug" title={ipo.company_name}>
            {ipo.company_name}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${config.badge}`}>
          {statusLabel}
        </span>
        {ipo.listing_date && (
          <span className="flex items-center gap-1 text-[9px] text-slate-500 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded-full whitespace-nowrap">
            🏁 {new Date(ipo.listing_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          </span>
        )}
        {getActivePeriod() && (
          <span className="text-[9px] text-amber-700 font-semibold bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full whitespace-nowrap">
            {getActivePeriod()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50/50 border border-slate-100 p-3 rounded-lg">
        <div>
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Harga</div>
          <div className="text-slate-800 font-bold">{getPrice()}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Sektor</div>
          <div className="text-slate-700 font-medium truncate" title={ipo.sector}>{ipo.sector || '—'}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-slate-100">
        {ipo.ipo_underwriters && ipo.ipo_underwriters.length > 0 ? (
          ipo.ipo_underwriters.map((uwRel: any, idx: number) => (
            <span
              key={idx}
              className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded border ${
                uwRel.role?.toLowerCase() === 'lead'
                  ? 'bg-blue-50 text-blue-600 border-blue-100 shadow-sm'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
              title={`${uwRel.underwriters?.name || ''} (${uwRel.role || ''})`}
            >
              {uwRel.underwriters?.broker_code}
            </span>
          ))
        ) : (
          ipo.underwriters && (
            <span className="font-mono text-[9px] bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 rounded truncate max-w-full">
              {ipo.underwriters.split(',').map((s: string) => s.split('-')[0].trim()).join(', ')}
            </span>
          )
        )}
      </div>
    </div>
  );
}
