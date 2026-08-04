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
    <div className="flex min-h-screen bg-black justify-center">
      <div className="w-full max-w-md bg-[var(--color-befit-bg)] min-h-screen relative flex flex-col shadow-2xl overflow-hidden">
        <main className={`flex-1 overflow-y-auto ${!hideNavigation ? 'pb-20' : ''}`}>
          {children}
        </main>
        {!hideNavigation && <Navigation />}
        <InstallPrompt />
      </div>
    </div>
  );
}
