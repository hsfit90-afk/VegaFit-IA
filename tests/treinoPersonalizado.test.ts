import { describe, it, expect } from 'vitest';
import {
  vagasDoLote, jaTemPedidoAberto, prazoDeEntrega, VAGAS_PADRAO, type PedidoResumo, PLANO, valorVigente, valorPorMes } from '@/lib/treinoPersonalizado';

/**
 * As dez vagas sao do LOTE DE LANCAMENTO, nao de um mes. Quando acabarem, acabou -- e um novo
 * lote e decisao do dono, feita pela variavel VAGAS_PERSONALIZADO no painel da Vercel.
 *
 * Isso protege duas coisas: a agenda dele (cada treino consome horas) e a promessa feita ao
 * aluno (escassez que reseta sozinha todo mes nao e escassez, e mentira que o cliente percebe).
 */

const p = (status: string, iso = '2026-10-02T10:00:00Z'): PedidoResumo => ({ status, createdAt: iso });

describe('vagasDoLote — o que ocupa vaga', () => {
  it('lote novo tem as dez vagas', () => {
    const v = vagasDoLote([]);
    expect(v.ocupadas).toBe(0);
    expect(v.restantes).toBe(VAGAS_PADRAO);
    expect(v.esgotado).toBe(false);
  });

  it('pedido sem pagamento NAO ocupa vaga', () => {
    // Senao bastaria alguem abrir a tela e pedir dez vezes para fechar o lote sem pagar nada.
    const dez = Array.from({ length: 10 }, () => p('aguardando_pagamento'));
    expect(vagasDoLote(dez).ocupadas).toBe(0);
  });

  it('pago, em producao e entregue ocupam', () => {
    expect(vagasDoLote([p('pago'), p('em_producao'), p('entregue')]).ocupadas).toBe(3);
  });

  it('cancelado devolve a vaga', () => {
    expect(vagasDoLote([p('cancelado'), p('pago')]).ocupadas).toBe(1);
  });
});

describe('vagasDoLote — o lote NAO reseta com o tempo', () => {
  it('pedido antigo continua ocupando: e lote, nao mes', () => {
    // A regra anterior contava por mes, e a virada devolvia tudo. Aqui nao: dez entregues no
    // ano passado mantem o lote fechado ate o dono abrir outro.
    const antigos = Array.from({ length: 10 }, () => p('entregue', '2025-01-15T10:00:00Z'));
    expect(vagasDoLote(antigos).esgotado).toBe(true);
  });

  it('pedidos espalhados em meses diferentes somam no mesmo lote', () => {
    const pedidos = [
      p('entregue', '2026-08-01T10:00:00Z'),
      p('entregue', '2026-09-01T10:00:00Z'),
      p('pago',     '2026-10-01T10:00:00Z'),
    ];
    expect(vagasDoLote(pedidos).ocupadas).toBe(3);
  });
});

describe('vagasDoLote — limite configuravel', () => {
  it('aceita um lote maior sem mexer em codigo', () => {
    const cinco = Array.from({ length: 5 }, () => p('pago'));
    expect(vagasDoLote(cinco, 10).restantes).toBe(5);
    expect(vagasDoLote(cinco, 25).restantes).toBe(20);
  });

  it('nunca mostra numero negativo', () => {
    // Acontece se ele atender alguem fora do app e o lote estourar.
    const doze = Array.from({ length: 12 }, () => p('pago'));
    const v = vagasDoLote(doze, 10);
    expect(v.restantes).toBe(0);
    expect(v.esgotado).toBe(true);
  });
});

describe('vagasDoLote — quando a tela mostra urgencia', () => {
  it('acabando liga com um terco ou menos restante', () => {
    const ocupar = (n: number) => Array.from({ length: n }, () => p('pago'));
    expect(vagasDoLote(ocupar(5), 10).acabando).toBe(false);  // 5 restantes
    expect(vagasDoLote(ocupar(6), 10).acabando).toBe(false);  // 4 restantes
    expect(vagasDoLote(ocupar(7), 10).acabando).toBe(true);   // 3 restantes
    expect(vagasDoLote(ocupar(9), 10).acabando).toBe(true);   // 1 restante
  });

  it('esgotado NAO e "acabando": sao mensagens diferentes na tela', () => {
    const v = vagasDoLote(Array.from({ length: 10 }, () => p('pago')), 10);
    expect(v.esgotado).toBe(true);
    expect(v.acabando).toBe(false);
  });
});

describe('jaTemPedidoAberto — um por vez', () => {
  it('bloqueia quem ja tem pedido em andamento', () => {
    expect(jaTemPedidoAberto([p('aguardando_pagamento')])).toBe(true);
    expect(jaTemPedidoAberto([p('pago')])).toBe(true);
    expect(jaTemPedidoAberto([p('em_producao')])).toBe(true);
  });

  it('quem ja recebeu pode pedir de novo', () => {
    expect(jaTemPedidoAberto([p('entregue')])).toBe(false);
    expect(jaTemPedidoAberto([p('cancelado')])).toBe(false);
  });
});

describe('prazoDeEntrega — so dias uteis', () => {
  it('pedido na segunda entrega na quinta', () => {
    expect(prazoDeEntrega(new Date('2026-10-05T10:00:00Z')).getUTCDate()).toBe(8);
  });

  it('pedido na sexta pula o fim de semana', () => {
    const entrega = prazoDeEntrega(new Date('2026-10-09T10:00:00Z'));
    expect(entrega.getUTCDate()).toBe(14);
    expect([0, 6]).not.toContain(entrega.getDay());
  });

  it('nunca cai em sabado ou domingo', () => {
    for (let dia = 1; dia <= 28; dia++) {
      expect([0, 6]).not.toContain(prazoDeEntrega(new Date(Date.UTC(2026, 9, dia, 12))).getDay());
    }
  });
});

/**
 * O produto virou TRIMESTRAL com preco de inauguracao (16/10/2026).
 *
 * Era R$ 147 avulso. O problema nao era o preco, era o produto: um treino isolado nao muda
 * ninguem, e o protocolo do app e um mesociclo de 4 semanas. Tres meses e o menor periodo em
 * que o aluno ve resultado.
 *
 * A promocao acaba com as VAGAS, nao com uma data -- contagem regressiva inventada ninguem
 * acredita mais, e aqui a escassez e real: cada aluno consome horas do profissional.
 */
describe('preco do plano trimestral', () => {
  it('cobra o promocional enquanto ha vaga no lote', () => {
    expect(valorVigente(10)).toBe(PLANO.valorPromocional);
    expect(valorVigente(1)).toBe(PLANO.valorPromocional);
  });

  it('sobe para o cheio quando o lote fecha', () => {
    expect(valorVigente(0)).toBe(PLANO.valorCheio);
  });

  it('o promocional e MENOR que o cheio', () => {
    // Trava obvia, e por isso mesmo: trocar os dois numeros de lugar num ajuste de preco
    // passaria despercebido ate alguem pagar mais na promocao.
    expect(PLANO.valorPromocional).toBeLessThan(PLANO.valorCheio);
  });

  it('o valor por mes divide o total pelos meses', () => {
    expect(valorPorMes(297)).toBe(99);
    expect(valorPorMes(397)).toBe(132);
  });

  it('o plano tem tres meses, como o protocolo pede', () => {
    // Tres mesociclos de 4 semanas. Se alguem mudar para 2 meses, o produto deixa de entregar
    // o que a tela promete.
    expect(PLANO.meses).toBe(3);
  });
});
