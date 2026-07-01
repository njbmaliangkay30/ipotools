'use client';

import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, TrendingDown, RefreshCw, Layers } from 'lucide-react';

interface IpoOption {
  ticker: string;
  name: string;
  price: number;
  board: string;
}

// Helper untuk mengambil fraksi harga berdasarkan harga aktif
function getFraction(price: number): number {
  if (price < 50) return 1; // Papan akselerasi bisa sampai Rp 1
  if (price <= 200) return 1;
  if (price <= 500) return 2;
  if (price <= 2000) return 5;
  if (price <= 5000) return 10;
  return 25;
}

// Helper untuk menghitung persentase batas reject BEI (Symmetrical 2023 Rules)
function getRejectLimit(price: number, isAcceleration: boolean): number {
  if (isAcceleration) return 0.10; // Flat 10% untuk Papan Akselerasi
  if (price <= 200) return 0.35;   // 35%
  if (price <= 500) return 0.25;   // 25%
  return 0.20;                     // 20%
}

// Perhitungan ARA (Auto Rejection Atas)
function calculateARA(price: number, isAcceleration: boolean): number {
  const limit = getRejectLimit(price, isAcceleration);
  const rawARA = price + (price * limit);
  const fraction = getFraction(rawARA);
  
  // Pembulatan kebawah kelipatan fraksi
  const rounded = Math.floor(rawARA / fraction) * fraction;
  return rounded;
}

// Perhitungan ARB (Auto Rejection Bawah)
function calculateARB(price: number, isAcceleration: boolean): number {
  const limit = getRejectLimit(price, isAcceleration);
  const rawARB = price - (price * limit);
  const fraction = getFraction(rawARB);
  
  // Pembulatan keatas kelipatan fraksi
  let rounded = Math.ceil(rawARB / fraction) * fraction;
  
  // Harga minimum reguler adalah Rp 50, akselerasi Rp 1
  const minPrice = isAcceleration ? 1 : 50;
  if (rounded < minPrice) rounded = minPrice;
  return rounded;
}

export default function CalculatorClient({ initialIpos }: { initialIpos: IpoOption[] }) {
  const [selectedTicker, setSelectedTicker] = useState('');
  const [customPrice, setCustomPrice] = useState('100');
  const [isAcceleration, setIsAcceleration] = useState(false);
  const [days, setDays] = useState(5);
  const [results, setResults] = useState<any[]>([]);

  // Cari detail emiten terpilih
  const activeIpo = initialIpos.find(ipo => ipo.ticker === selectedTicker);

  // Set nilai awal saat emiten dipilih
  useEffect(() => {
    if (activeIpo) {
      setCustomPrice(activeIpo.price.toString());
      setIsAcceleration(activeIpo.board?.toUpperCase() === 'ACCELERATION' || activeIpo.board?.toUpperCase() === 'AKSELERASI');
    }
  }, [selectedTicker, activeIpo]);

  // Jalankan perhitungan multi-hari
  useEffect(() => {
    const startPrice = parseFloat(customPrice);
    if (isNaN(startPrice) || startPrice <= 0) {
      setResults([]);
      return;
    }

    const calculatedDays = [];
    let currentAraPrice = startPrice;
    let currentArbPrice = startPrice;

    for (let day = 1; day <= days; day++) {
      const nextAra = calculateARA(currentAraPrice, isAcceleration);
      const araPct = ((nextAra - currentAraPrice) / currentAraPrice) * 100;

      const nextArb = calculateARB(currentArbPrice, isAcceleration);
      const arbPct = ((nextArb - currentArbPrice) / currentArbPrice) * 100;

      calculatedDays.push({
        day,
        prevAra: currentAraPrice,
        ara: nextAra,
        araPercent: araPct,
        araAccumulated: ((nextAra - startPrice) / startPrice) * 100,

        prevArb: currentArbPrice,
        arb: nextArb,
        arbPercent: arbPct,
        arbAccumulated: ((nextArb - startPrice) / startPrice) * 100,
      });

      // Iterasikan ke hari berikutnya
      currentAraPrice = nextAra;
      currentArbPrice = nextArb;
    }

    setResults(calculatedDays);
  }, [customPrice, isAcceleration, days]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* Kolom Input Panel */}
      <div className="md:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6 self-start">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Calculator className="h-4 w-4 text-blue-600" />
          Parameter Hitung
        </h2>

        {/* 1. Pilih Ticker Terdaftar */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Pilih Emiten IPO</label>
          <select
            value={selectedTicker}
            onChange={(e) => setSelectedTicker(e.target.value)}
            className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 shadow-sm"
          >
            <option value="">-- Input Harga Custom --</option>
            {initialIpos.map(ipo => (
              <option key={ipo.ticker} value={ipo.ticker}>
                {ipo.ticker} - {ipo.name.substring(0, 24)}... (Rp {ipo.price})
              </option>
            ))}
          </select>
        </div>

        {/* 2. Custom Base Price */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Harga Awal (Base Price)</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs select-none">Rp</span>
            <input
              type="number"
              min="1"
              value={customPrice}
              onChange={(e) => {
                setSelectedTicker('');
                setCustomPrice(e.target.value);
              }}
              className="w-full bg-slate-50 border border-slate-250 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-blue-500 shadow-sm"
              placeholder="Contoh: 150"
            />
          </div>
        </div>

        {/* 3. Papan Pencatatan */}
        <div className="space-y-3">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-550">Papan Pencatatan</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="board"
                checked={!isAcceleration}
                onChange={() => setIsAcceleration(false)}
                className="w-4 h-4 text-blue-600 border-slate-350 focus:ring-blue-500"
              />
              Utama / Pengembangan
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="board"
                checked={isAcceleration}
                onChange={() => setIsAcceleration(true)}
                className="w-4 h-4 text-blue-600 border-slate-350 focus:ring-blue-500"
              />
              Akselerasi (10% flat)
            </label>
          </div>
        </div>

        {/* 4. Durasi Simulasi */}
        <div className="space-y-2">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Simulasi Hari Beruntun</label>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold focus:outline-none focus:border-blue-500 shadow-sm"
          >
            {[1, 2, 3, 4, 5, 7, 10].map(d => (
              <option key={d} value={d}>{d} Hari Bursa</option>
            ))}
          </select>
        </div>

        {/* Reset Button */}
        <button
          onClick={() => {
            setSelectedTicker('');
            setCustomPrice('100');
            setIsAcceleration(false);
            setDays(5);
          }}
          className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs py-2.5 rounded-xl transition-colors shadow-sm uppercase tracking-wider"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reset Hitungan
        </button>
      </div>

      {/* Kolom Hasil Panel */}
      <div className="md:col-span-2 space-y-6">
        
        {/* Rangkuman Singkat */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-emerald-50/30 border border-emerald-100 p-5 rounded-2xl flex items-center justify-between shadow-sm/30">
            <div>
              <div className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                ARA Hari 1 (D+1)
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {results[0] ? `Rp ${results[0].ara.toLocaleString('id-ID')}` : '—'}
              </div>
              <p className="text-[10px] text-emerald-600 font-bold mt-1">
                {results[0] ? `+${results[0].araPercent.toFixed(2)}%` : ''}
              </p>
            </div>
            <TrendingUp className="h-10 w-10 text-emerald-600/30 stroke-[2.5]" />
          </div>

          <div className="bg-rose-50/30 border border-rose-100 p-5 rounded-2xl flex items-center justify-between shadow-sm/30">
            <div>
              <div className="text-[10px] uppercase font-bold text-rose-700 tracking-wider mb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
                ARB Hari 1 (D+1)
              </div>
              <div className="text-3xl font-black text-slate-900 tracking-tight">
                {results[0] ? `Rp ${results[0].arb.toLocaleString('id-ID')}` : '—'}
              </div>
              <p className="text-[10px] text-rose-600 font-bold mt-1">
                {results[0] ? `${results[0].arbPercent.toFixed(2)}%` : ''}
              </p>
            </div>
            <TrendingDown className="h-10 w-10 text-rose-600/30 stroke-[2.5]" />
          </div>
        </div>

        {/* Tabel Rincian Hari */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600" />
              Rencana Perjalanan Harga (Price Path)
            </h3>
            <span className="text-[9px] uppercase font-black bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded">
              Fraksi Aktif: Rp {results[0] ? getFraction(parseFloat(customPrice)) : '—'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/30">
                  <th className="py-3.5 px-4.5 text-center w-16">Hari</th>
                  <th className="py-3.5 px-4.5">Acuan Awal</th>
                  <th className="py-3.5 px-4.5 text-emerald-600">Batas ARA</th>
                  <th className="py-3.5 px-4.5 text-emerald-700 text-center">Akumulasi ARA</th>
                  <th className="py-3.5 px-4.5 text-rose-600">Batas ARB</th>
                  <th className="py-3.5 px-4.5 text-rose-700 text-center">Akumulasi ARB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {results.map((res) => (
                  <tr key={res.day} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4.5 text-center bg-slate-50/30 font-bold text-slate-500">D+{res.day}</td>
                    <td className="py-3.5 px-4.5 text-slate-500">Rp {res.prevAra.toLocaleString('id-ID')}</td>
                    <td className="py-3.5 px-4.5 font-bold text-slate-900">
                      Rp {res.ara.toLocaleString('id-ID')}
                      <span className="text-[10px] text-emerald-600 font-bold ml-1.5">+{res.araPercent.toFixed(1)}%</span>
                    </td>
                    <td className="py-3.5 px-4.5 text-center">
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 font-extrabold px-2 py-0.5 rounded text-[10px]">
                        +{res.araAccumulated.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4.5 font-bold text-slate-900">
                      Rp {res.arb.toLocaleString('id-ID')}
                      <span className="text-[10px] text-rose-600 font-bold ml-1.5">{res.arbPercent.toFixed(1)}%</span>
                    </td>
                    <td className="py-3.5 px-4.5 text-center">
                      <span className="bg-rose-50 text-rose-700 border border-rose-100 font-extrabold px-2 py-0.5 rounded text-[10px]">
                        {res.arbAccumulated.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {results.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-450 italic">
                      Masukkan harga awal yang valid untuk memulai simulasi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
