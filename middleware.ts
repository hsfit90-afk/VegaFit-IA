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
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
