// Regras do Treino Personalizado: o treino montado à mão pelo profissional.
//
// Função pura, sem banco, pelo mesmo motivo de lib/periodization.ts: a contagem de vagas
// aparece na tela do aluno e é conferida de novo no servidor antes de aceitar o pedido. Duas
// implementações da mesma regra divergem no primeiro caso de borda — e aqui o caso de borda
// é você prometer uma vaga que não existe.

export const VALOR = 147;
export const PRAZO_DIAS_UTEIS = 3;

/**
 * Vagas por mês.
 *
 * O limite não é de marketing, é de agenda: cada treino consome suas horas, e prometer mais
 * do que cabe no mês transforma o produto de maior margem no seu maior problema. Dez é o que
 * cabe revisando um plano gerado — montar do zero levaria mais tempo e caberiam menos.
 */
export const VAGAS_POR_MES = 10;

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

function mesmoMes(quando: string | number, referencia: Date): boolean {
  const d = new Date(quando);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCFullYear() === referencia.getUTCFullYear()
      && d.getUTCMonth() === referencia.getUTCMonth();
}

export interface EstadoDasVagas {
  ocupadas: number;
  restantes: number;
  esgotado: boolean;
}

export function vagasDoMes(pedidos: PedidoResumo[], agora: Date = new Date()): EstadoDasVagas {
  const ocupadas = pedidos.filter(p =>
    STATUS_QUE_OCUPAM_VAGA.includes(p.status as StatusPedido) && mesmoMes(p.createdAt, agora)
  ).length;

  // Nunca devolve número negativo: se você abrir uma vaga extra na mão num mês cheio, a tela
  // mostra "esgotado" em vez de "-1 vagas".
  const restantes = Math.max(0, VAGAS_POR_MES - ocupadas);
  return { ocupadas, restantes, esgotado: restantes === 0 };
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
