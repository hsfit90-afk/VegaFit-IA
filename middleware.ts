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
     *
     * A CORREÇÃO DE 08/10 ESTAVA PELA METADE (descoberto em 22/10/2026).
     *
     * Isentar `sw.js` não bastava: o service worker faz `importScripts` de outros dois
     * arquivos que o next-pwa gera ao lado dele — `workbox-<hash>.js` e `worker-<hash>.js` —
     * e esses continuavam respondendo 307. Verificado em produção: `sw.js` dava 200 e
     * `worker-WDW1zc-m-pa1ZsGf39oT8.js` dava 307 para /login. `importScripts` que falha
     * derruba a instalação inteira, então o PWA seguiu sem instalar mesmo depois do 08/10 —
     * só que agora com o sintoma escondido, porque o arquivo da frente carregava.
     *
     * Vão por padrão, não por nome: o hash muda a cada build.
     *
     * `mp3` entrou junto. O som do fim de descanso saiu do CDN do Mixkit para
     * `public/sons/descanso.mp3` (auditoria de LGPD), e é a única entrada do precache que
     * não é imagem — sem a extensão aqui, ela também voltaria 307 e levaria o install junto.
     *
     * A LIÇÃO, porque é a terceira vez: toda vez que um arquivo novo entra em `public/`,
     * conferir se a extensão dele está nesta lista. O 307 não quebra nada na hora e não
     * aparece em teste nenhum — aparece semanas depois, como "o app não instala".
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-[^/]+\\.js|worker-[^/]+\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3)$).*)',
  ],
}
