"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Zap, Dumbbell, PlayCircle, History, MessageSquare, Settings, TrendingUp, Apple, LogOut, BarChart2, PlusCircle } from 'lucide-react';
import { useAppContext } from '@/app/context/AppContext';

// Full list for Desktop Sidebar
const DESKTOP_NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/progress', label: 'Progresso', icon: BarChart2 },
  { href: '/generator', label: 'Gerador IA', icon: Zap },
  { href: '/manual-workout', label: 'Criar Treino', icon: PlusCircle },
  { href: '/active', label: 'Treinar', icon: PlayCircle },
  { href: '/library', label: 'Exercícios', icon: Dumbbell },
  { href: '/history', label: 'Histórico', icon: History },
  { href: '/progression', label: 'Check-in', icon: TrendingUp },
  { href: '/nutrition', label: 'Nutrição IA', icon: Apple },
  { href: '/coach', label: 'AI Coach', icon: MessageSquare },
  { href: '/settings', label: 'Perfil', icon: Settings },
];

// Core list for Mobile Bottom Nav
const MOBILE_NAV_ITEMS = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/active', label: 'Treinar', icon: PlayCircle },
  { href: '/progress', label: 'Progresso', icon: BarChart2 },
  { href: '/settings', label: 'Perfil', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const { profile, clearData } = useAppContext();

  const hideNavigation = ['/login', '/register', '/onboarding'].includes(pathname);
  if (hideNavigation) return null;

  // Filtrar menu baseado no perfil
  const role = profile?.role || 'client';
  
  let desktopItems = [...DESKTOP_NAV_ITEMS];
  
  // Adicionar painéis específicos baseados na role
  if (role === 'master') {
    desktopItems.unshift({ href: '/admin', label: 'Admin (Master)', icon: Settings });
    desktopItems.unshift({ href: '/trainer', label: 'Meus Alunos', icon: Zap });
  } else if (role === 'trainer') {
    desktopItems.unshift({ href: '/trainer', label: 'Meus Alunos', icon: Zap });
  }

  const filteredDesktopNav = desktopItems.filter(item => {
    // Alunos com personal não devem gerar próprios treinos
    if (profile?.trainerId) {
      if (item.href === '/generator' || item.href === '/manual-workout' || item.href === '/library') return false;
    }
    return true;
  });

  const filteredMobileNav = MOBILE_NAV_ITEMS.filter(item => {
    // Same filtering logic for mobile if needed, though MOBILE_NAV_ITEMS doesn't have generator
    return true;
  });

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[260px] h-screen fixed top-0 left-0 bg-surface border-r border-border p-6 z-50">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="font-outfit text-2xl font-extrabold tracking-tight text-foreground uppercase">VegaFit</h1>
        </div>
        
        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto hide-scrollbar">
          {filteredDesktopNav.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl font-semibold transition-all duration-300 ${
                  isActive 
                    ? 'bg-surface-light text-primary shadow-sm' 
                    : 'text-foreground-muted hover:text-foreground hover:bg-surface-light/50'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'fill-primary/20' : ''}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-border">
          <button
            onClick={() => clearData()}
            className="flex items-center gap-4 px-4 py-3.5 rounded-2xl font-semibold text-destructive hover:bg-destructive/10 transition-all duration-300 w-full"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full glass-panel border-t-white/10 px-2 pt-3 pb-safe z-50 flex items-center justify-around rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {filteredMobileNav.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center min-w-[70px] pb-3 pt-1 group"
            >
              {isActive && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-primary rounded-b-full shadow-[0_0_10px_rgba(0,255,136,0.5)]" />
              )}
              <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-primary/10 text-primary' : 'text-foreground-muted group-hover:text-foreground'}`}>
                <Icon className={`w-6 h-6 ${isActive ? 'fill-primary/20' : ''}`} />
              </div>
              <span className={`text-[11px] font-medium mt-1 transition-all duration-300 ${isActive ? 'text-primary' : 'text-foreground-muted group-hover:text-foreground'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
