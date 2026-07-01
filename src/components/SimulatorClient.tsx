'use client';

import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Trash2, TrendingUp, Info, Sparkles, ChevronDown } from 'lucide-react';

interface IpoSim {
  id: string;
  ticker: string;
  name: string;
  price: number;
  status: string;
}

interface SimOrder {
  id: string;
  ticker: string;
  lots: number;
  allotmentPct: number; // 0 to 100
  araDays: number; // 0 to 5
}

interface AccountSim {
  id: string;
  name: string;
  orders: SimOrder[];
}

// IDX ARA pricing brackets & tick rules helper
const getAraPrice = (basePrice: number, days: number): number => {
  let price = basePrice;
  for (let i = 0; i < days; i++) {
    let limitPct = 0.20;
    if (price <= 200) limitPct = 0.35;
    else if (price <= 500) limitPct = 0.25;
    
    const rawIncrease = price * limitPct;
    
    // Ticks BEI (IDX Tick Sizes)
    let tick = 1;
    if (price >= 5000) tick = 25;
    else if (price >= 2000) tick = 10;
    else if (price >= 500) tick = 5;
    else if (price >= 200) tick = 2;
    
    const rawPrice = price + rawIncrease;
    price = Math.floor(rawPrice / tick) * tick;
  }
  return price;
};

export default function SimulatorClient({ initialIpos }: { initialIpos: IpoSim[] }) {
  // 4 Accounts state
  const [accounts, setAccounts] = useState<AccountSim[]>([
    { id: 'acc-1', name: 'Akun RDN Mandiri (UID 1)', orders: [] },
    { id: 'acc-2', name: 'Akun RDN BCA (UID 2)', orders: [] },
    { id: 'acc-3', name: 'Akun RDN BNI (UID 3)', orders: [] },
    { id: 'acc-4', name: 'Akun RDN BRI (UID 4)', orders: [] }
  ]);

  // Load first available IPOs as default mock orders on load
  useEffect(() => {
    if (initialIpos.length > 0) {
      setAccounts(prev => prev.map((acc, idx) => {
        // Pre-fill Akun with a default order of the first IPO for demo purposes
        const defaultIpo = initialIpos[idx % initialIpos.length];
        return {
          ...acc,
          orders: [
            {
              id: `order-init-${idx}`,
              ticker: defaultIpo.ticker,
              lots: 100, // 100 lot default
              allotmentPct: 5, // 5% default allocation
              araDays: 2 // 2 days ARA default
            }
          ]
        };
      }));
    }
  }, [initialIpos]);

  const addOrder = (accountId: string) => {
    if (initialIpos.length === 0) return;
    const defaultIpo = initialIpos[0];
    setAccounts(prev => prev.map(acc => {
      if (acc.id !== accountId) return acc;
      return {
        ...acc,
        orders: [
          ...acc.orders,
          {
            id: `order-${Date.now()}-${Math.random()}`,
            ticker: defaultIpo.ticker,
            lots: 50,
            allotmentPct: 5,
            araDays: 1
          }
        ]
      };
    }));
  };

  const removeOrder = (accountId: string, orderId: string) => {
    setAccounts(prev => prev.map(acc => {
      if (acc.id !== accountId) return acc;
      return {
        ...acc,
        orders: acc.orders.filter(o => o.id !== orderId)
      };
    }));
  };

  const updateOrder = (accountId: string, orderId: string, updates: Partial<SimOrder>) => {
    setAccounts(prev => prev.map(acc => {
      if (acc.id !== accountId) return acc;
      return {
        ...acc,
        orders: acc.orders.map(o => {
          if (o.id !== orderId) return o;
          return { ...o, ...updates };
        })
      };
    }));
  };

  const updateAccountName = (accountId: string, newName: string) => {
    setAccounts(prev => prev.map(acc => {
      if (acc.id !== accountId) return acc;
      return { ...acc, name: newName };
    }));
  };

  // Calculations for dashboard
  let totalRequiredAllAccounts = 0;
  let totalSpentAllAccounts = 0;
  let totalRefundAllAccounts = 0;
  let totalFinalValueAllAccounts = 0;
  let totalProfitAllAccounts = 0;

  const calculatedAccounts = accounts.map(acc => {
    let accRequired = 0;
    let accSpent = 0;
    let accRefund = 0;
    let accFinalValue = 0;
    let accProfit = 0;

    const calculatedOrders = acc.orders.map(order => {
      const ipo = initialIpos.find(i => i.ticker === order.ticker) || { price: 100, ticker: order.ticker };
      
      const requiredCapital = order.lots * 100 * ipo.price; // Locked capital
      const sharesAllotted = Math.max(1, Math.round(order.lots * (order.allotmentPct / 100))) * 100;
      const spentCapital = (sharesAllotted / 100) * 100 * ipo.price;
      const refund = Math.max(0, requiredCapital - spentCapital);
      
      const sellPrice = getAraPrice(ipo.price, order.araDays);
      const finalSharesValue = sharesAllotted * sellPrice;
      const finalCapitalCollected = refund + finalSharesValue;
      const profit = finalSharesValue - spentCapital;

      accRequired += requiredCapital;
      accSpent += spentCapital;
      accRefund += refund;
      accFinalValue += finalCapitalCollected;
      accProfit += profit;

      return {
        ...order,
        ipoPrice: ipo.price,
        requiredCapital,
        sharesAllotted,
        spentCapital,
        refund,
        sellPrice,
        finalSharesValue,
        finalCapitalCollected,
        profit
      };
    });

    totalRequiredAllAccounts += accRequired;
    totalSpentAllAccounts += accSpent;
    totalRefundAllAccounts += accRefund;
    totalFinalValueAllAccounts += accFinalValue;
    totalProfitAllAccounts += accProfit;

    return {
      ...acc,
      orders: calculatedOrders,
      required: accRequired,
      spent: accSpent,
      refund: accRefund,
      finalValue: accFinalValue,
      profit: accProfit
    };
  });

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* Premium Dashboard Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Metric: Total Saldo Disiapkan */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white flex flex-col justify-between shadow-md relative overflow-hidden">
          <div className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Saldo RDN Disiapkan</span>
            <span className="text-2xl font-black tracking-tight mt-1 block">
              Rp {totalRequiredAllAccounts.toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
            <Info className="h-3 w-3" /> Dana wajib dikunci saat book building/offering
          </p>
        </div>

        {/* Metric: Estimasi Refund */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimasi Dana Refund</span>
            <span className="text-2xl font-black text-slate-800 tracking-tight mt-1 block">
              Rp {totalRefundAllAccounts.toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-3">
            Sisa modal mengalir kembali setelah penjatahan selesai
          </p>
        </div>

        {/* Metric: Nilai Akhir Saham & Dana */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimasi Dana Akhir Terkumpul</span>
            <span className="text-2xl font-black text-indigo-600 tracking-tight mt-1 block font-mono">
              Rp {totalFinalValueAllAccounts.toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-3 font-semibold text-emerald-600">
            Peningkatan Aset: +{totalRequiredAllAccounts > 0 ? ((totalFinalValueAllAccounts - totalRequiredAllAccounts) / totalRequiredAllAccounts * 100).toFixed(1) : 0}%
          </p>
        </div>

        {/* Metric: Profit Bersih */}
        <div className="bg-emerald-50 border border-emerald-250 rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
          <div>
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Estimasi Profit Bersih</span>
            <span className="text-2xl font-black text-emerald-600 tracking-tight mt-1 block">
              + Rp {totalProfitAllAccounts.toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-[10px] text-emerald-700 mt-3 flex items-center gap-1 font-semibold">
            <TrendingUp className="h-3.5 w-3.5" /> Hasil simulasi dari total {accounts.reduce((acc, a) => acc + a.orders.length, 0)} emiten
          </p>
        </div>
      </div>

      {/* Grid Bento 4 Akun */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {calculatedAccounts.map((acc) => (
          <div 
            key={acc.id} 
            className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 p-5 flex flex-col justify-between"
          >
            {/* Account Card Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-3">
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                  <Wallet className="h-4.5 w-4.5" />
                </div>
                <input
                  type="text"
                  value={acc.name}
                  onChange={(e) => updateAccountName(acc.id, e.target.value)}
                  className="font-bold text-slate-900 text-sm bg-transparent hover:bg-slate-50 border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:outline-none px-1.5 py-0.5 rounded transition-all w-full max-w-[240px]"
                />
              </div>
              <div className="flex gap-2.5 text-[10px] text-right font-semibold self-start sm:self-center font-mono">
                <div className="bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
                  <span className="text-slate-400 block uppercase font-bold text-[8px]">Modal RDN</span>
                  <span className="text-slate-800 font-extrabold text-xs">Rp {acc.required.toLocaleString('id-ID')}</span>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">
                  <span className="text-indigo-400 block uppercase font-bold text-[8px]">Dana Akhir</span>
                  <span className="text-indigo-600 font-extrabold text-xs">Rp {acc.finalValue.toLocaleString('id-ID')}</span>
                </div>
              </div>
            </div>

            {/* List of Simulated Tickers in this Account */}
            <div className="space-y-4 flex-1">
              {acc.orders.length > 0 ? acc.orders.map((order) => (
                <div 
                  key={order.id} 
                  className="bg-slate-50/70 border border-slate-150 rounded-xl p-4.5 space-y-3.5 transition-all hover:border-slate-300"
                >
                  {/* Row 1: Ticker Select & Lot Input */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <select
                          value={order.ticker}
                          onChange={(e) => updateOrder(acc.id, order.id, { ticker: e.target.value })}
                          className="bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs font-bold text-slate-850 appearance-none focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
                        >
                          {initialIpos.map(ipo => (
                            <option key={ipo.id} value={ipo.ticker}>
                              {ipo.ticker} (Rp {ipo.price})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="h-3 w-3 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Jumlah Lot</span>
                        <input
                          type="number"
                          value={order.lots}
                          min={1}
                          onChange={(e) => updateOrder(acc.id, order.id, { lots: Math.max(1, parseInt(e.target.value) || 0) })}
                          className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-center text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-sm"
                        />
                      </div>
                      <button
                        onClick={() => removeOrder(acc.id, order.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50"
                        title="Hapus Emiten"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Sliders for Allotment & ARA */}
                  <div className="grid grid-cols-2 gap-4 text-xs pt-1 border-t border-slate-100/60">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Estimasi Penjatahan</span>
                        <span className="text-blue-600">{order.allotmentPct}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="100"
                        step="0.5"
                        value={order.allotmentPct}
                        onChange={(e) => updateOrder(acc.id, order.id, { allotmentPct: parseFloat(e.target.value) })}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-slate-500">Simulasi ARA</span>
                        <span className="text-indigo-600">{order.araDays} Hari ARA</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="1"
                        value={order.araDays}
                        onChange={(e) => updateOrder(acc.id, order.id, { araDays: parseInt(e.target.value) })}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                    </div>
                  </div>

                  {/* Row 3: Output Metrics for this specific Item */}
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px] pt-1 font-mono">
                    <div className="bg-white p-2 rounded-lg border border-slate-150/50">
                      <div className="text-[8px] text-slate-400 uppercase font-bold">Dana Locked</div>
                      <div className="font-extrabold text-slate-800 mt-0.5">Rp {(order.requiredCapital).toLocaleString('id-ID')}</div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-150/50">
                      <div className="text-[8px] text-slate-400 uppercase font-bold">Dapat / Refund</div>
                      <div className="font-extrabold text-emerald-600 mt-0.5">
                        ~{order.sharesAllotted / 100} Lot
                        <span className="text-[8px] text-slate-400 font-normal block">Refund: Rp {order.refund.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-150/50">
                      <div className="text-[8px] text-slate-400 uppercase font-bold">Harga ARA</div>
                      <div className="font-extrabold text-indigo-600 mt-0.5">Rp {order.sellPrice} <span className="text-[8px] text-slate-400 font-normal">({order.araDays}D)</span></div>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-150/50">
                      <div className="text-[8px] text-slate-400 uppercase font-bold">Profit Bersih</div>
                      <div className="font-black text-emerald-600 mt-0.5">+{order.profit >= 0 ? `Rp ${order.profit.toLocaleString('id-ID')}` : '—'}</div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-400">
                    <Plus className="h-5 w-5" />
                  </div>
                  <p className="text-xs text-slate-400 mt-2 font-medium">Belum ada emiten disimulasikan</p>
                </div>
              )}
            </div>

            {/* Account Card Footer: Add Button */}
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={() => addOrder(acc.id)}
                disabled={initialIpos.length === 0}
                className="w-full bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 hover:border-slate-350 text-xs font-bold text-slate-800 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <Plus className="h-4 w-4 text-blue-600" />
                Tambah Emiten Simulasi
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
