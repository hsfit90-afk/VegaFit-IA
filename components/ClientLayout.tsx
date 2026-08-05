"use client";

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Navigation } from './Navigation';
import { InstallPrompt } from './InstallPrompt';
import { AnimatePresence, motion } from 'motion/react';

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
    <div className="flex min-h-screen bg-background">
      {!hideNavigation && <Navigation />}
      <main className={`flex-1 min-h-screen w-full ${!hideNavigation ? 'md:ml-[260px] pb-20 md:pb-0' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="h-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <InstallPrompt />
    </div>
  );
}
