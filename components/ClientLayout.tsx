"use client";

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Navigation } from './Navigation';
import { InstallPrompt } from './InstallPrompt';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideNavigation = ['/login', '/register', '/onboarding'].includes(pathname);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('Service Worker registration failed: ', err);
      });
    }
  }, []);

  return (
    <div className="flex min-h-screen bg-[var(--color-befit-bg)]">
      {!hideNavigation && <Navigation />}
      <main className={`flex-1 min-h-screen w-full ${!hideNavigation ? 'md:ml-[240px] pb-24 md:pb-0' : ''}`}>
        {children}
      </main>
      <InstallPrompt />
    </div>
  );
}
