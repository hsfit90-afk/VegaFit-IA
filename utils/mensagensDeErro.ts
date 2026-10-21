// O QUE O USUÁRIO LÊ QUANDO ALGO FALHA.
//
// O CASO QUE DEU ORIGEM A ISTO
//
// Em 20/10/2026 uma aluna tentou entrar e recebeu na tela, em inglês:
//
//     Invalid login credentials
//
// Ela não tinha como saber se errou a senha, se a conta não existia, ou se o app estava
// quebrado. (Era a senha — conta criada em setembro, usada uma vez só.) As telas faziam
// `setError(error.message)` e mandavam para o usuário o texto cru que o Supabase devolve,
// escrito para quem programa.
//
// POR QUE AQUI E NÃO EM lib/
//
// `lib/` é regra de negócio: o que decide treino, carga, assinatura. Texto de interface não é
// regra — é apresentação, muda com o tom do produto e não tem nada a ver com prescrição.
// Também não vai em `utils/supabase/`, que é conexão e guarda de acesso.
//
// O QUE ESTE MÓDULO NÃO FAZ
//
// Não adivinha. Se a mensagem não está no dicionário, ele devolve o PADRÃO que quem chamou
// passou — e só cai no texto genérico quando não há padrão. É o que permite usá-lo nas telas
// que falam com a nossa própria API, onde a mensagem já vem em português e boa: ali o
// tradutor só entra em ação para falha de rede, e passa o resto adiante intacto.

/** Quando não dá para dizer nada específico. Admite o problema e diz o que fazer. */
export const MENSAGEM_GENERICA =
  'Não consegui completar essa ação agora. Tente de novo em instantes.';

/**
 * Pelo CÓDIGO do erro, que é mais confiável que o texto.
 *
 * O Supabase expõe `code` nos erros de autenticação desde a v2, e o código não muda quando
 * eles reescrevem a mensagem em inglês. O texto continua sendo consultado logo abaixo porque
 * erro antigo, erro de banco e erro de rede não trazem código nenhum.
 */
const POR_CODIGO: Record<string, string> = {
  invalid_credentials:
    "E-mail ou senha incorretos. Se não lembra a senha, use 'Esqueceu sua senha?' logo abaixo.",
  email_not_confirmed:
    'Seu e-mail ainda não foi confirmado. Procure a mensagem de confirmação na caixa de entrada e no spam.',
  user_already_exists:
    "Já existe uma conta com esse e-mail. Entre pela tela de login, ou use 'Esqueceu sua senha?' se não lembra a senha.",
  email_exists:
    "Já existe uma conta com esse e-mail. Entre pela tela de login, ou use 'Esqueceu sua senha?' se não lembra a senha.",
  weak_password: 'A senha precisa ter pelo menos 6 caracteres.',
  same_password: 'A senha nova precisa ser diferente da anterior.',
  validation_failed:
    'Esse e-mail não parece válido. Confira se não falta algo, como o @ ou o ponto com.',
  over_request_rate_limit:
    'Foram muitas tentativas seguidas. Espere um minuto e tente de novo.',
  over_email_send_rate_limit:
    'Já enviamos vários e-mails para esse endereço agora há pouco. Espere alguns minutos antes de pedir outro.',
  otp_expired:
    "Esse link expirou ou já foi usado. Peça um novo em 'Esqueceu sua senha?'.",
  session_not_found: 'Sua sessão expirou. Entre de novo para continuar.',
  signup_disabled: 'O cadastro está fechado no momento.',
  user_not_found: 'Não encontrei nenhuma conta com esse e-mail.',
};

/**
 * Pelo começo do texto, para o que não traz código.
 *
 * Compara o INÍCIO e não a frase inteira de propósito: várias mensagens do Supabase terminam
 * com um número que muda ("you can only request this after 47 seconds"), e exigir igualdade
 * exata faria a tradução falhar justamente no caso mais comum.
 */
const POR_TEXTO: { comeca: string; diz: string }[] = [
  { comeca: 'invalid login credentials', diz: POR_CODIGO.invalid_credentials },
  { comeca: 'email not confirmed', diz: POR_CODIGO.email_not_confirmed },
  { comeca: 'user already registered', diz: POR_CODIGO.user_already_exists },
  { comeca: 'a user with this email address has already been registered', diz: POR_CODIGO.user_already_exists },
  { comeca: 'password should be at least', diz: POR_CODIGO.weak_password },
  { comeca: 'new password should be different', diz: POR_CODIGO.same_password },
  { comeca: 'unable to validate email address', diz: POR_CODIGO.validation_failed },
  { comeca: 'for security purposes, you can only request this after', diz: POR_CODIGO.over_request_rate_limit },
  { comeca: 'email rate limit exceeded', diz: POR_CODIGO.over_email_send_rate_limit },
  { comeca: 'email link is invalid or has expired', diz: POR_CODIGO.otp_expired },
  { comeca: 'token has expired or is invalid', diz: POR_CODIGO.otp_expired },
  { comeca: 'auth session missing', diz: POR_CODIGO.session_not_found },
  { comeca: 'signups not allowed', diz: POR_CODIGO.signup_disabled },
  { comeca: 'user not found', diz: POR_CODIGO.user_not_found },

  /*
   * FALHA DE REDE.
   *
   * Cada navegador escreve a dele: Chrome diz "Failed to fetch", Firefox diz "NetworkError
   * when attempting to fetch resource." e o Safari diz só "Load failed". São os três textos
   * que chegam à tela quando o celular perde o sinal no meio de um salvamento — e é o erro
   * mais frequente de todos num app que se usa dentro da academia.
   */
  { comeca: 'failed to fetch', diz: 'Sem conexão com o servidor. Confira sua internet e tente de novo.' },
  { comeca: 'networkerror', diz: 'Sem conexão com o servidor. Confira sua internet e tente de novo.' },
  { comeca: 'load failed', diz: 'Sem conexão com o servidor. Confira sua internet e tente de novo.' },
  { comeca: 'the operation was aborted', diz: 'A conexão demorou demais e foi interrompida. Tente de novo.' },

  /*
   * PAGAMENTO.
   *
   * As rotas de cobrança deste app já respondem em português (ver app/api/checkout), então o
   * que sobra para traduzir aqui é a falha de configuração do gateway, que vem do
   * lib/mercadopago.ts sem acento e sem contexto para quem lê.
   */
  { comeca: 'mercadopago_access_token nao configurado', diz: 'O pagamento ainda não está configurado. Tente novamente em instantes.' },
  { comeca: 'nao foi possivel abrir o pagamento', diz: 'Não consegui abrir a tela de pagamento. Tente de novo em instantes.' },
];

/** Tira `code` e `message` de um erro de forma não confiável, que é como eles chegam. */
function partesDoErro(erro: unknown): { codigo: string; texto: string } {
  if (typeof erro === 'string') return { codigo: '', texto: erro };
  if (erro && typeof erro === 'object') {
    const e = erro as { code?: unknown; message?: unknown; error_code?: unknown };
    const codigo = typeof e.code === 'string' ? e.code : typeof e.error_code === 'string' ? e.error_code : '';
    const texto = typeof e.message === 'string' ? e.message : '';
    return { codigo, texto };
  }
  return { codigo: '', texto: '' };
}

/**
 * A mensagem que vai para a tela.
 *
 * @param erro    o que o Supabase, o navegador ou um `throw` devolveu
 * @param padrao  o que dizer quando o erro não é conhecido. Sem ele, cai no texto genérico.
 *
 * Nas telas que falam com a nossa API, `padrao` recebe a mensagem que a rota já mandou em
 * português — assim o tradutor só age sobre o que ele de fato reconhece e nunca troca uma
 * mensagem boa por uma genérica.
 */
export function traduzirErro(erro: unknown, padrao?: string): string {
  const { codigo, texto } = partesDoErro(erro);

  if (codigo && POR_CODIGO[codigo]) return POR_CODIGO[codigo];

  const normalizado = texto.trim().toLowerCase();
  if (normalizado) {
    const achado = POR_TEXTO.find(t => normalizado.startsWith(t.comeca));
    if (achado) return achado.diz;
  }

  const limpo = padrao?.trim();
  if (limpo) return limpo;
  return MENSAGEM_GENERICA;
}
