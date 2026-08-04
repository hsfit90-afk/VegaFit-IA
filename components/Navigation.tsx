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
    <nav className="absolute bottom-0 left-0 w-full bg-[var(--color-befit-surface)]/95 backdrop-blur-xl border-t border-[var(--color-befit-surface-light)] px-2 py-3 z-50 flex overflow-x-auto gap-2 pb-safe hide-scrollbar items-center justify-around rounded-b-xl md:rounded-none">
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
  );
}
