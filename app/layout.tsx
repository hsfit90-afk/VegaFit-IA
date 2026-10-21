import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Inter, Outfit } from 'next/font/google';
import { AppProvider } from '@/app/context/AppContext';
import { ClientLayout } from '@/components/ClientLayout';
/**
 * POR QUE OS NOMES SÃO `--fonte-*` E NÃO `--font-*`
 *
 * O Tailwind v4 gera a classe `font-x` a partir de um token `--font-x` declarado no `@theme`
 * de globals.css. Se o next/font também chamasse a variável dele de `--font-outfit`, as duas
 * declarações cairiam no MESMO elemento e o token do tema apontaria para si mesmo —
 * referência circular, que o CSS descarta.
 *
 * Com nomes distintos, o next/font publica a família aqui e o `@theme` aponta para ela.
 */
const inter = Inter({ subsets: ['latin'], variable: '--fonte-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--fonte-outfit' });

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
  themeColor: 'var(--color-background-deep)',
};

/**
 * AS VARIÁVEIS DE FONTE VÃO NO <html>, não no <body>.
 *
 * O `@theme` do Tailwind emite seus tokens em `:root`, que É o <html>. Com as variáveis
 * declaradas só no <body>, um token do tema escrito como `var(--fonte-inter)` era resolvido
 * em `:root`, onde essa variável não existe — virava valor inválido, e a classe `font-sans`
 * caía na pilha do sistema.
 *
 * Era por isso que as duas fontes do projeto eram baixadas (9 arquivos .woff2) e nenhuma
 * chegava à tela: o app inteiro rodava na fonte padrão do sistema operacional, mudando de
 * cara conforme o aparelho.
 */
export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${outfit.variable}`}>
      <body className="font-sans bg-[var(--color-background-deep)] text-white antialiased" suppressHydrationWarning>
        <AppProvider>
          <ClientLayout>
            {children}
          </ClientLayout>
        </AppProvider>
      </body>
    </html>
  );
}
