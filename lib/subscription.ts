// Decide se uma conta tem acesso ao que consome IA, a partir do status de assinatura.
//
// Função pura, sem banco e sem rede, pelo mesmo motivo de lib/periodization.ts: a mesma
// regra precisa valer no servidor (para barrar a rota) e na tela (para mostrar o aviso
// certo), e duas implementações divergem no primeiro caso de borda.
//
// O QUE NUNCA PODE ACONTECER: alguém que já usava o app antes do gateway ver uma tela de
// pagamento. Essas contas estão em 'cortesia', que é o único estado sem prazo nenhum.

export type SubscriptionStatus = 'cortesia' | 'trial' | 'ativo' | 'vencido' | 'cancelado';

/**
 * Dias de tolerância depois que a assinatura paga vence.
 *
 * O Mercado Pago não desiste no primeiro erro de cartão — ele reprocessa. Cortar o acesso
 * na primeira falha derruba gente cujo cartão só trocou de número, e essa pessoa não volta.
 * A tolerância dá tempo do reprocessamento acontecer.
 *
 * Não vale para 'cancelado': quem pediu para sair escolheu a data, e esticar o acesso
 * depois disso é confuso, não generoso.
 */
export const DIAS_DE_TOLERANCIA = 3;
const DIA_MS = 24 * 60 * 60 * 1000;

export interface DadosDeAssinatura {
  subscriptionStatus?: string | null;
  /** ISO string ou epoch em ms — o Supabase devolve ISO, os testes usam número. */
  trialEndsAt?: string | number | null;
  subscriptionExpiresAt?: string | number | null;
  subscriptionPlan?: string | null;
}

export interface EstadoDeAcesso {
  status: SubscriptionStatus;
  /** Pode usar as rotas de IA. */
  temAcesso: boolean;
  /** Está em teste gratuito agora. */
  emTeste: boolean;
  /** Dias inteiros restantes do teste; null quando não está em teste. */
  diasDeTesteRestantes: number | null;
  /** Já assinou e está dentro da tolerância pós-vencimento — avisar, não bloquear. */
  emTolerancia: boolean;
  /** Nunca assinou: o teste acabou e não houve pagamento. Muda o texto do paywall. */
  nuncaAssinou: boolean;
}

function paraMs(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const t = Date.parse(valor);
  return Number.isNaN(t) ? null : t;
}

function normalizarStatus(valor: string | null | undefined): SubscriptionStatus {
  switch (valor) {
    case 'cortesia':
    case 'trial':
    case 'ativo':
    case 'vencido':
    case 'cancelado':
      return valor;
    default:
      // Perfil antigo lido antes da migration rodar, ou valor inesperado. Cortesia é o
      // padrão seguro: na dúvida, NÃO bloqueia quem já estava usando o app. O prejuízo de
      // liberar um mês indevido é de centavos; o de barrar um aluno pagante é o cliente.
      return 'cortesia';
  }
}

export function estadoDeAcesso(dados: DadosDeAssinatura, agora: number = Date.now()): EstadoDeAcesso {
  const status = normalizarStatus(dados.subscriptionStatus);
  const fimDoTeste = paraMs(dados.trialEndsAt);
  const fimDaAssinatura = paraMs(dados.subscriptionExpiresAt);

  const base: EstadoDeAcesso = {
    status,
    temAcesso: false,
    emTeste: false,
    diasDeTesteRestantes: null,
    emTolerancia: false,
    nuncaAssinou: fimDaAssinatura === null,
  };

  switch (status) {
    // Sem prazo, sem gateway, sem paywall. É aqui que ficam os testadores que já usavam o
    // app antes da cobrança existir, e quem você liberar manualmente.
    case 'cortesia':
      return { ...base, temAcesso: true };

    case 'trial': {
      // Teste sem data de fim seria acesso infinito por acidente. Trata como encerrado.
      if (fimDoTeste === null) return base;
      const dentro = agora < fimDoTeste;
      return {
        ...base,
        temAcesso: dentro,
        emTeste: dentro,
        diasDeTesteRestantes: dentro ? Math.max(0, Math.ceil((fimDoTeste - agora) / DIA_MS)) : 0,
      };
    }

    case 'ativo': {
      // Assinatura ativa sem data de vencimento: o webhook ainda não escreveu, ou escreveu
      // torto. Libera — quem está pagando não pode pagar o preço do nosso bug.
      if (fimDaAssinatura === null) return { ...base, temAcesso: true };
      if (agora < fimDaAssinatura) return { ...base, temAcesso: true };
      const dentroDaTolerancia = agora < fimDaAssinatura + DIAS_DE_TOLERANCIA * DIA_MS;
      return { ...base, temAcesso: dentroDaTolerancia, emTolerancia: dentroDaTolerancia };
    }

    // Pediu para sair: usa até o fim do que já pagou, sem tolerância.
    case 'cancelado':
      return { ...base, temAcesso: fimDaAssinatura !== null && agora < fimDaAssinatura };

    case 'vencido':
      return base;
  }
}

/** Atalho para quem só precisa do sim/não. */
export function temAcesso(dados: DadosDeAssinatura, agora: number = Date.now()): boolean {
  return estadoDeAcesso(dados, agora).temAcesso;
}

/**
 * O que a rota de IA responde quando não há acesso.
 *
 * 402 (Payment Required) em vez de 403: o cliente precisa distinguir "sua assinatura
 * acabou, vá pagar" de "você não tem permissão para isto", e os dois mandam para telas
 * diferentes. Nenhum navegador trata 402 de forma especial, então é seguro usar.
 */
export const HTTP_ASSINATURA_NECESSARIA = 402;

export function mensagemDeBloqueio(estado: EstadoDeAcesso): string {
  if (estado.status === 'trial') return 'Seu teste gratuito de 7 dias terminou. Assine para continuar gerando treinos.';
  if (estado.status === 'cancelado') return 'Sua assinatura foi encerrada. Reative para continuar gerando treinos.';
  return 'Sua assinatura está inativa. Regularize o pagamento para continuar gerando treinos.';
}
