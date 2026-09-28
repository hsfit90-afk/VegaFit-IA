import { describe, it, expect } from 'vitest';
import {
  vagasDoMes, jaTemPedidoAberto, prazoDeEntrega, VAGAS_POR_MES, type PedidoResumo,
} from '@/lib/treinoPersonalizado';

/**
 * O limite de vagas protege a AGENDA do profissional, não é escassez de marketing. Cada
 * treino personalizado consome horas dele; prometer mais do que cabe no mês transforma o
 * produto de maior margem no maior problema.
 */

const OUTUBRO = new Date('2026-10-15T12:00:00Z');
const p = (status: string, iso: string): PedidoResumo => ({ status, createdAt: iso });

describe('vagasDoMes — o que ocupa vaga', () => {
  it('mês vazio tem as dez vagas', () => {
    expect(vagasDoMes([], OUTUBRO)).toEqual({ ocupadas: 0, restantes: VAGAS_POR_MES, esgotado: false });
  });

  it('pedido sem pagamento NÃO ocupa vaga', () => {
    // Senão bastaria alguém abrir a tela e pedir dez vezes para fechar o mês sem pagar nada.
    const dez = Array.from({ length: 10 }, () => p('aguardando_pagamento', '2026-10-02T10:00:00Z'));
    expect(vagasDoMes(dez, OUTUBRO).ocupadas).toBe(0);
  });

  it('pago, em produção e entregue ocupam', () => {
    const pedidos = [
      p('pago', '2026-10-01T10:00:00Z'),
      p('em_producao', '2026-10-05T10:00:00Z'),
      p('entregue', '2026-10-08T10:00:00Z'),
    ];
    expect(vagasDoMes(pedidos, OUTUBRO).ocupadas).toBe(3);
  });

  it('entregue continua contando — a vaga foi gasta, o trabalho aconteceu', () => {
    const pedidos = Array.from({ length: 10 }, () => p('entregue', '2026-10-03T10:00:00Z'));
    expect(vagasDoMes(pedidos, OUTUBRO).esgotado).toBe(true);
  });

  it('cancelado devolve a vaga', () => {
    const pedidos = [p('cancelado', '2026-10-01T10:00:00Z'), p('pago', '2026-10-02T10:00:00Z')];
    expect(vagasDoMes(pedidos, OUTUBRO).ocupadas).toBe(1);
  });
});

describe('vagasDoMes — a contagem é do mês corrente', () => {
  it('pedido do mês passado não ocupa vaga deste mês', () => {
    const pedidos = Array.from({ length: 10 }, () => p('entregue', '2026-09-20T10:00:00Z'));
    expect(vagasDoMes(pedidos, OUTUBRO).restantes).toBe(VAGAS_POR_MES);
  });

  it('a virada do mês devolve as dez vagas', () => {
    const cheio = Array.from({ length: 10 }, () => p('pago', '2026-10-28T10:00:00Z'));
    expect(vagasDoMes(cheio, OUTUBRO).esgotado).toBe(true);
    expect(vagasDoMes(cheio, new Date('2026-11-01T00:00:00Z')).esgotado).toBe(false);
  });

  it('data ilegível não conta, em vez de derrubar a contagem', () => {
    expect(vagasDoMes([p('pago', 'ontem')], OUTUBRO).ocupadas).toBe(0);
  });
});

describe('vagasDoMes — nunca mostra número negativo', () => {
  it('mês com mais pedidos que vagas mostra esgotado, não "-2 vagas"', () => {
    // Acontece se você abrir vagas extras na mão num mês cheio.
    const doze = Array.from({ length: 12 }, () => p('pago', '2026-10-10T10:00:00Z'));
    const v = vagasDoMes(doze, OUTUBRO);
    expect(v.restantes).toBe(0);
    expect(v.esgotado).toBe(true);
  });
});

describe('jaTemPedidoAberto — um por vez', () => {
  it('bloqueia quem já tem pedido em andamento', () => {
    expect(jaTemPedidoAberto([p('aguardando_pagamento', '2026-10-01T10:00:00Z')])).toBe(true);
    expect(jaTemPedidoAberto([p('pago', '2026-10-01T10:00:00Z')])).toBe(true);
    expect(jaTemPedidoAberto([p('em_producao', '2026-10-01T10:00:00Z')])).toBe(true);
  });

  it('quem já recebeu pode pedir de novo', () => {
    expect(jaTemPedidoAberto([p('entregue', '2026-09-01T10:00:00Z')])).toBe(false);
    expect(jaTemPedidoAberto([p('cancelado', '2026-09-01T10:00:00Z')])).toBe(false);
  });
});

describe('prazoDeEntrega — só dias úteis', () => {
  it('pedido na segunda entrega na quinta', () => {
    const segunda = new Date('2026-10-05T10:00:00Z');
    expect(prazoDeEntrega(segunda).getUTCDate()).toBe(8);
  });

  it('pedido na sexta pula o fim de semana', () => {
    // Prometer "3 dias" e entregar na terça porque caiu numa sexta é o caminho mais curto
    // para um cliente satisfeito virar pedido de reembolso.
    const sexta = new Date('2026-10-09T10:00:00Z');
    const entrega = prazoDeEntrega(sexta);
    expect(entrega.getUTCDate()).toBe(14); // quarta da semana seguinte
    expect([0, 6]).not.toContain(entrega.getDay());
  });

  it('nunca cai em sábado ou domingo', () => {
    for (let dia = 1; dia <= 28; dia++) {
      const inicio = new Date(Date.UTC(2026, 9, dia, 12));
      expect([0, 6]).not.toContain(prazoDeEntrega(inicio).getDay());
    }
  });
});
