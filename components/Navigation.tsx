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

  // Esconder a navegação nas telas de autenticação e onboarding
  const hideNavigation = ['/login', '/register', '/onboarding'].includes(pathname);
  if (hideNavigation) return null;

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[240px] h-screen fixed top-0 left-0 bg-white/[0.02] border-r border-white/[0.08] p-6 backdrop-blur-md">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00ff88] to-[#7c3aed] flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#0a0a0f]" />
          </div>
          <h1 className="font-outfit text-[22px] font-extrabold tracking-tight text-[#00ff88]">VEGAFIT IA</h1>
        </div>
        
        <nav className="flex-1 flex flex-col gap-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all duration-300 ${
                  isActive 
                    ? 'bg-[#00ff88]/10 text-[#00ff88]' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-white/10">
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
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-[#0a0a0f]/90 backdrop-blur-xl border-t border-white/10 p-3 z-50 flex justify-around items-center pb-safe">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                isActive ? 'text-[#00ff88]' : 'text-gray-400'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'animate-pulse' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
