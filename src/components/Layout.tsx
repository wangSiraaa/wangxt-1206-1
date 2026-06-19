import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Gauge,
  Fuel,
  Truck,
  ShieldCheck,
  Radio,
  CircleDot,
} from 'lucide-react';
import { useAppStore, ROLE_META } from '../store';
import type { Role } from '@shared/types';
import { cn } from '../lib/utils';

const NAV: { to: string; label: string; icon: typeof Gauge; roles: Role[] }[] = [
  { to: '/', label: '总控台', icon: Gauge, roles: ['station', 'delivery', 'supervisor'] },
  { to: '/filling', label: '充装作业台', icon: Fuel, roles: ['station', 'supervisor'] },
  { to: '/delivery', label: '配送作业台', icon: Truck, roles: ['delivery', 'supervisor'] },
  { to: '/supervise', label: '监管中心', icon: ShieldCheck, roles: ['supervisor'] },
];

const ROLES: Role[] = ['station', 'delivery', 'supervisor'];

export default function Layout() {
  const role = useAppStore((s) => s.role);
  const setRole = useAppStore((s) => s.setRole);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const visible = NAV.filter((n) => n.roles.includes(role));

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/85 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-5 h-16 flex items-center gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-safety-500 flex items-center justify-center shadow-glow">
                <Fuel className="w-5 h-5 text-ink-950" strokeWidth={2.5} />
              </div>
              <CircleDot className="w-3 h-3 text-ok-400 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div className="leading-none">
              <div className="stat-num text-lg text-ink-100 tracking-wide">LPG · TRACE</div>
              <div className="label-tag mt-0.5">液化气瓶充装追溯</div>
            </div>
          </div>

          <nav className="flex items-center gap-1 flex-1 min-w-0">
            {visible.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-safety-500/15 text-safety-300 border border-safety-600/40'
                      : 'text-ink-300 hover:text-ink-100 hover:bg-ink-800/60 border border-transparent',
                  )
                }
              >
                <n.icon className="w-4 h-4" />
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2 text-ink-400">
              <Radio className="w-3.5 h-3.5 text-ok-400" />
              <span className="font-mono text-xs">SYSTEM ONLINE</span>
            </div>
            <div className="hidden sm:block font-mono text-xs text-ink-300 tabular-nums">
              {now.toLocaleTimeString('zh-CN', { hour12: false })}
            </div>
            <div className="flex items-center rounded-lg border border-ink-700 bg-ink-900/80 p-0.5">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors',
                    role === r
                      ? 'bg-safety-500 text-ink-950'
                      : 'text-ink-300 hover:text-ink-100',
                  )}
                >
                  {ROLE_META[r].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-5 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-ink-800 bg-ink-950/60">
        <div className="max-w-[1400px] mx-auto px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] font-mono text-ink-400">
          <span className="text-ink-300">阻断规则:</span>
          <span>① 超期未检 · 禁止充装</span>
          <span>② 重量超差 · 转入复称</span>
          <span>③ 已配送 · 记录锁定</span>
          <span className="ml-auto opacity-60">当前角色: {ROLE_META[role].label}</span>
        </div>
      </footer>
    </div>
  );
}
