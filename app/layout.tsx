import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Inter, Outfit } from 'next/font/google';
import { AppProvider } from '@/app/context/AppContext';
import { ClientLayout } from '@/components/ClientLayout';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'VegaFit IA',
  description: 'Seu personal trainer com inteligência artificial.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'VegaFit IA',
  },
  icons: {
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} ${outfit.variable} font-sans bg-[#0a0a0f] text-white antialiased`} suppressHydrationWarning>
        <AppProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </AppProvider>
      </body>
    </html>
  );
}
