"use client";

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Navigation } from './Navigation';
import { InstallPrompt } from './InstallPrompt';
import { AnimatePresence, motion } from 'motion/react';
import { useAppContext } from '@/app/context/AppContext';
import { ToastProvider } from './ui/Toast';
import { ConfirmProvider } from './ui/ConfirmDialog';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile } = useAppContext();
  const hideNavigation = ['/login', '/register', '/onboarding'].includes(pathname);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('Service Worker registration failed: ', err);
      });
    }
  }, []);

  return (
    // Os dois providers envolvem tudo pra que qualquer tela chame useToast()/useConfirm()
    // sem precisar montar estado local de modal em cada uma.
    <ToastProvider>
      <ConfirmProvider>
        <div className="min-h-screen bg-background overflow-x-hidden w-full relative">
          {!hideNavigation && <Navigation />}
          <main className={`min-h-screen w-full block ${!hideNavigation ? 'pt-safe pb-[90px] md:pb-0 md:pt-0 md:pl-[260px]' : ''}`}>
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
      </ConfirmProvider>
    </ToastProvider>
  );
}
