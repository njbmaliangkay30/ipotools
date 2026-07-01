'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, LayoutDashboard, GitCompare, Users, BarChart3, Calculator, Wallet } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/compare", label: "Compare", icon: GitCompare, exact: false },
  { href: "/underwriters", label: "Underwriters", icon: Users, exact: false },
  { href: "/outcomes", label: "Outcomes", icon: BarChart3, exact: false },
  { href: "/calculator", label: "ARA/ARB Calc", icon: Calculator, exact: false },
  { href: "/simulator", label: "Wallet Sim", icon: Wallet, exact: false },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Top accent line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500" />

      <div className="bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-sm shadow-slate-900/[0.04]">
        <div className="container flex h-14 items-center justify-between max-w-7xl mx-auto px-4">

          {/* Logo + Brand */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md shadow-blue-500/25 group-hover:shadow-blue-500/40 transition-all duration-300 group-hover:scale-105">
                <TrendingUp className="h-4 w-4 text-white" strokeWidth={2.5} />
                {/* Pulse ring */}
                <span className="absolute inset-0 rounded-lg ring-2 ring-blue-500/30 animate-pulse" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-bold text-slate-900 text-sm tracking-tight">IPO Decision</span>
                <span className="text-[9px] font-semibold text-blue-600 tracking-widest uppercase">Support Tool</span>
              </div>
            </Link>

            {/* Nav Links */}
            <nav className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map(({ href, label, icon: Icon, exact }) => {
                const isActive = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`
                      relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-wider
                      transition-all duration-200
                      ${isActive
                        ? "text-blue-600 bg-blue-50/80"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/80"
                      }
                    `}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                    {label}
                    {/* Active underline */}
                    {isActive && (
                      <span className="absolute bottom-0.5 left-3 right-3 h-[2px] rounded-full bg-gradient-to-r from-blue-600 to-indigo-500" />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Live badge + market status */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-3 py-1.5 rounded-full">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600" />
              </span>
              Live IDX Data
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
