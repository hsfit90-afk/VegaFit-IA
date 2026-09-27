import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protect all routes except login, register, and auth callback
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/register') &&
    !request.nextUrl.pathname.startsWith('/auth/callback') &&
    !request.nextUrl.pathname.startsWith('/forgot-password') &&
    // A política de privacidade PRECISA ser pública. Ela estava atrás do login, então quem
    // ainda não tem conta — justamente quem precisa decidir se aceita o tratamento dos dados,
    // incluindo os de saúde — era redirecionado para /login ao tentar lê-la. O art. 9 da LGPD
    // dá ao titular o direito de informação clara sobre o tratamento ANTES de consentir.
    !request.nextUrl.pathname.startsWith('/privacy') &&
    !request.nextUrl.pathname.startsWith('/api/cron/') &&
    // Webhook de gateway de pagamento. Quem chama é o servidor do Mercado Pago, que não tem
    // — nem pode ter — sessão de usuário. Sem esta linha a notificação era redirecionada
    // para /login com 307, e o gateway nunca alcançava a rota: a assinatura do aluno ficaria
    // paga e nunca ativada, sem erro visível em lugar nenhum.
    //
    // A rota NÃO fica desprotegida: ela valida a assinatura HMAC do Mercado Pago e, mesmo
    // depois disso, consulta a API do gateway antes de mudar qualquer coisa no banco. Mesmo
    // motivo pelo qual /api/cron/ já estava liberado aqui — autenticação própria, por segredo
    // compartilhado, em vez de sessão.
    !request.nextUrl.pathname.startsWith('/api/webhooks/')
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  
  if (user && (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/register'))) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
  }

  return supabaseResponse
}
