"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Zap, Dumbbell, PlayCircle, History, MessageSquare, Settings, TrendingUp, Apple } from 'lucide-react';
import { useAppContext } from '@/app/context/AppContext';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/generator', label: 'Gerador IA', icon: Zap },
  { href: '/active', label: 'Treinar', icon: PlayCircle },
  { href: '/library', label: 'Exercícios', icon: Dumbbell },
  { href: '/history', label: 'Histórico', icon: History },
  { href: '/progression', label: 'Check-in', icon: TrendingUp },
  { href: '/nutrition', label: 'Nutrição IA', icon: Apple },
  { href: '/coach', label: 'AI Coach', icon: MessageSquare },
  { href: '/settings', label: 'Perfil', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const { clearData } = useAppContext();

  const hideNavigation = ['/login', '/register', '/onboarding'].includes(pathname);
  if (hideNavigation) return null;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[240px] h-screen fixed top-0 left-0 bg-[var(--color-befit-surface)] border-r border-[var(--color-befit-surface-light)] p-6 z-50">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-befit-neon)] flex items-center justify-center">
            <Zap className="w-5 h-5 text-black" />
          </div>
          <h1 className="font-outfit text-[22px] font-extrabold tracking-tight text-white uppercase">VegaFit</h1>
        </div>
        
        <nav className="flex-1 flex flex-col gap-2 overflow-y-auto hide-scrollbar">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-300 ${
                  isActive 
                    ? 'bg-[var(--color-befit-surface-light)] text-[var(--color-befit-neon)] border border-[var(--color-befit-neon)]/30' 
                    : 'text-[var(--color-befit-text-muted)] hover:text-white hover:bg-[var(--color-befit-surface-light)]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-[var(--color-befit-surface-light)]">
          <button
            onClick={() => clearData()}
            className="flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-red-400 hover:text-red-300 hover:bg-red-400/10 transition-all duration-300 w-full"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span>Sair da Conta</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[var(--color-befit-surface)]/95 backdrop-blur-xl border-t border-[var(--color-befit-surface-light)] px-2 py-3 z-50 flex overflow-x-auto gap-2 pb-safe hide-scrollbar items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 min-w-[60px] p-2 transition-all ${
                isActive ? 'text-[var(--color-befit-neon)]' : 'text-[var(--color-befit-text-muted)] hover:text-white'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? '' : 'opacity-70'}`} />
              <span className="text-[10px] font-medium mt-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
