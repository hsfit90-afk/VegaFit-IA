import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  // B1: este log rodava em TODA requisição e ia para os logs da Vercel. Não guarda dado
  // pessoal direto, mas compõe rastro de navegação por sessão — e `/anamnese` ali indica
  // que aquela pessoa tratou dado de saúde. Parecia depuração esquecida; fica só em dev.
  if (process.env.NODE_ENV === 'development') {
    console.log("MIDDLEWARE RUNNING FOR:", request.nextUrl.pathname);
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     *
     * manifest.json e sw.js entraram em 08/10/2026, depois de os dois responderem 307.
     * A lista antiga isentava imagem por extensão, mas não .json nem .js — então o
     * middleware mandava os dois para /login, e o navegador, sem conseguir ler o manifest,
     * nunca oferecia instalar o app. O PWA simplesmente não instalava, e a página de vendas
     * promete justamente "instala pelo navegador, sem baixar de loja".
     *
     * Os dois são arquivos estáticos públicos por natureza: o manifest só tem nome, cor e
     * ícone, e o service worker é código que o navegador precisa buscar ANTES de existir
     * qualquer sessão. Não há nada para proteger ali.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
