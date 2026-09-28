// Regras do Treino Personalizado: o treino montado à mão pelo profissional.
//
// Função pura, sem banco, pelo mesmo motivo de lib/periodization.ts: a contagem de vagas
// aparece na tela do aluno e é conferida de novo no servidor antes de aceitar o pedido. Duas
// implementações da mesma regra divergem no primeiro caso de borda — e aqui o caso de borda
// é você prometer uma vaga que não existe.

export const VALOR = 147;
export const PRAZO_DIAS_UTEIS = 3;

/**
 * Vagas do LANÇAMENTO — total, não por mês.
 *
 * Dez no total, e quando acabarem, acabou. É escassez real: cada treino consome horas do
 * profissional, e as dez primeiras também servem para descobrir quanto tempo cada uma leva de
 * verdade antes de prometer mais.
 *
 * Para abrir outro lote depois, mude VAGAS_PERSONALIZADO no painel da Vercel — sem tocar em
 * código. O valor é lido só no servidor: a tela recebe a contagem já calculada, para o limite
 * não virar algo que o navegador possa alterar.
 */
export const VAGAS_PADRAO = 10;

export function limiteDeVagas(): number {
  const n = Number(process.env.VAGAS_PERSONALIZADO);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : VAGAS_PADRAO;
}

export type StatusPedido =
  | 'aguardando_pagamento'
  | 'pago'
  | 'em_producao'
  | 'entregue'
  | 'cancelado';

/**
 * Status que consomem vaga.
 *
 * Pedido sem pagamento NÃO consome: senão bastaria alguém abrir a tela e pedir dez vezes para
 * fechar o mês inteiro sem pagar nada. E 'entregue' continua contando, porque a vaga foi
 * gasta — o trabalho já aconteceu.
 */
export const STATUS_QUE_OCUPAM_VAGA: StatusPedido[] = ['pago', 'em_producao', 'entregue'];

/** Status em que o aluno ainda está esperando algo de você. */
export const STATUS_EM_ANDAMENTO: StatusPedido[] = ['aguardando_pagamento', 'pago', 'em_producao'];

export interface PedidoResumo {
  status: StatusPedido | string;
  createdAt: string | number;
}

export interface EstadoDasVagas {
  ocupadas: number;
  restantes: number;
  esgotado: boolean;
  limite: number;
  /** Menos de um terço restante: a tela passa a mostrar urgência em vez de só informar. */
  acabando: boolean;
}

/**
 * Conta as vagas do lote inteiro, sem recorte de data.
 *
 * O limite entra por parâmetro em vez de ser lido aqui dentro porque esta função também roda
 * no navegador, onde `process.env` não enxerga variável de servidor. Quem chama passa o valor
 * — e assim o limite nunca vira algo que o cliente possa mudar.
 */
export function vagasDoLote(pedidos: PedidoResumo[], limite: number = VAGAS_PADRAO): EstadoDasVagas {
  const ocupadas = pedidos.filter(p =>
    STATUS_QUE_OCUPAM_VAGA.includes(p.status as StatusPedido)
  ).length;

  // Nunca devolve número negativo: se você atender alguém fora do app e o lote estourar, a
  // tela mostra "esgotado" em vez de "-2 vagas".
  const restantes = Math.max(0, limite - ocupadas);
  return {
    ocupadas,
    restantes,
    esgotado: restantes === 0,
    limite,
    // floor, não ceil: com limite 10, ceil daria 4 — e 4 de 10 não é "um terço ou menos".
    acabando: restantes > 0 && restantes <= Math.floor(limite / 3),
  };
}

/**
 * Um aluno só pode ter um pedido em andamento por vez.
 *
 * Sem isto, alguém pede três, paga um, e fica esperando três treinos. E você descobre a
 * confusão quando ele reclamar.
 */
export function jaTemPedidoAberto(pedidosDoAluno: PedidoResumo[]): boolean {
  return pedidosDoAluno.some(p => STATUS_EM_ANDAMENTO.includes(p.status as StatusPedido));
}

/** Texto do status para a tela do aluno. */
export function descreverStatus(status: string): string {
  switch (status) {
    case 'aguardando_pagamento': return 'Aguardando pagamento';
    case 'pago': return 'Pagamento confirmado — na fila';
    case 'em_producao': return 'Sendo montado agora';
    case 'entregue': return 'Entregue';
    case 'cancelado': return 'Cancelado';
    default: return status;
  }
}

/**
 * Data de entrega prometida, contando só dias úteis.
 *
 * Prometer "3 dias" e entregar na terça seguinte porque caiu numa sexta é o jeito mais rápido
 * de transformar um cliente satisfeito num pedido de reembolso.
 */
export function prazoDeEntrega(inicio: Date = new Date(), diasUteis: number = PRAZO_DIAS_UTEIS): Date {
  const d = new Date(inicio);
  let restantes = diasUteis;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) restantes--;
  }
  return d;
}
