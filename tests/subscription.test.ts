import { describe, it, expect } from 'vitest';
import { estadoDeAcesso, temAcesso, DIAS_DE_TOLERANCIA } from '@/lib/subscription';

/**
 * A regra que não pode quebrar nunca: quem já usava o app antes de existir cobrança está em
 * 'cortesia' e não vê paywall. Se um destes testes falhar, alguém que confiou no produto vai
 * abrir o app e encontrar uma tela de pagamento.
 */

const DIA = 24 * 60 * 60 * 1000;
const AGORA = Date.parse('2026-10-01T12:00:00Z');

describe('cortesia — os testadores que já existiam', () => {
  it('tem acesso, sem prazo nenhum', () => {
    expect(temAcesso({ subscriptionStatus: 'cortesia' }, AGORA)).toBe(true);
  });

  it('continua tendo acesso daqui a dez anos', () => {
    expect(temAcesso({ subscriptionStatus: 'cortesia' }, AGORA + 3650 * DIA)).toBe(true);
  });

  it('não é afetado por datas antigas que tenham sobrado no perfil', () => {
    expect(temAcesso({
      subscriptionStatus: 'cortesia',
      trialEndsAt: AGORA - 90 * DIA,
      subscriptionExpiresAt: AGORA - 90 * DIA,
    }, AGORA)).toBe(true);
  });
});

describe('status desconhecido cai em cortesia', () => {
  it('perfil lido antes da migration rodar não bloqueia ninguém', () => {
    // O app pode subir antes do SQL ser executado. Nesse intervalo, subscription_status vem
    // undefined para todo mundo — e barrar a base inteira seria muito pior que liberar.
    expect(temAcesso({ subscriptionStatus: undefined }, AGORA)).toBe(true);
    expect(temAcesso({ subscriptionStatus: null }, AGORA)).toBe(true);
    expect(temAcesso({ subscriptionStatus: 'sei_la' }, AGORA)).toBe(true);
    expect(temAcesso({}, AGORA)).toBe(true);
  });
});

describe('trial — quem chega novo', () => {
  it('tem acesso dentro dos 7 dias', () => {
    const e = estadoDeAcesso({ subscriptionStatus: 'trial', trialEndsAt: AGORA + 7 * DIA }, AGORA);
    expect(e.temAcesso).toBe(true);
    expect(e.emTeste).toBe(true);
    expect(e.diasDeTesteRestantes).toBe(7);
  });

  it('arredonda para cima o dia parcial — meio dia restante ainda é "1 dia"', () => {
    const e = estadoDeAcesso({ subscriptionStatus: 'trial', trialEndsAt: AGORA + DIA / 2 }, AGORA);
    expect(e.diasDeTesteRestantes).toBe(1);
    expect(e.temAcesso).toBe(true);
  });

  it('perde o acesso quando o prazo passa', () => {
    const e = estadoDeAcesso({ subscriptionStatus: 'trial', trialEndsAt: AGORA - 1 }, AGORA);
    expect(e.temAcesso).toBe(false);
    expect(e.diasDeTesteRestantes).toBe(0);
  });

  it('trial sem data de fim NÃO vira acesso infinito', () => {
    // Um bug que gravasse status sem data daria assinatura vitalícia de graça.
    expect(temAcesso({ subscriptionStatus: 'trial', trialEndsAt: null }, AGORA)).toBe(false);
  });

  it('aceita a data em ISO, que é como o Supabase devolve', () => {
    expect(temAcesso({
      subscriptionStatus: 'trial',
      trialEndsAt: '2026-10-05T12:00:00Z',
    }, AGORA)).toBe(true);
  });

  it('data ilegível é tratada como ausente, não como válida', () => {
    expect(temAcesso({ subscriptionStatus: 'trial', trialEndsAt: 'ontem' }, AGORA)).toBe(false);
  });
});

describe('ativo — quem paga', () => {
  it('tem acesso enquanto a assinatura não venceu', () => {
    expect(temAcesso({
      subscriptionStatus: 'ativo',
      subscriptionExpiresAt: AGORA + DIA,
    }, AGORA)).toBe(true);
  });

  it('continua liberado durante a tolerância pós-vencimento', () => {
    // O Mercado Pago reprocessa cartão recusado. Cortar na primeira falha derruba quem só
    // trocou o número do cartão — e essa pessoa não volta.
    const e = estadoDeAcesso({
      subscriptionStatus: 'ativo',
      subscriptionExpiresAt: AGORA - DIA,
    }, AGORA);
    expect(e.temAcesso).toBe(true);
    expect(e.emTolerancia).toBe(true);
  });

  it('perde o acesso depois da tolerância', () => {
    const e = estadoDeAcesso({
      subscriptionStatus: 'ativo',
      subscriptionExpiresAt: AGORA - (DIAS_DE_TOLERANCIA + 1) * DIA,
    }, AGORA);
    expect(e.temAcesso).toBe(false);
    expect(e.emTolerancia).toBe(false);
  });

  it('ativo sem data de vencimento libera — quem paga não paga pelo nosso bug', () => {
    expect(temAcesso({ subscriptionStatus: 'ativo', subscriptionExpiresAt: null }, AGORA)).toBe(true);
  });
});

describe('cancelado — pediu para sair', () => {
  it('usa até o fim do período que já pagou', () => {
    expect(temAcesso({
      subscriptionStatus: 'cancelado',
      subscriptionExpiresAt: AGORA + 10 * DIA,
    }, AGORA)).toBe(true);
  });

  it('NÃO ganha tolerância: quem escolheu sair escolheu a data', () => {
    expect(temAcesso({
      subscriptionStatus: 'cancelado',
      subscriptionExpiresAt: AGORA - 1,
    }, AGORA)).toBe(false);
  });
});

describe('vencido — sem acesso', () => {
  it('não gera mais nada, com ou sem datas no perfil', () => {
    expect(temAcesso({ subscriptionStatus: 'vencido' }, AGORA)).toBe(false);
    expect(temAcesso({
      subscriptionStatus: 'vencido',
      trialEndsAt: AGORA + 30 * DIA,
      subscriptionExpiresAt: AGORA + 30 * DIA,
    }, AGORA)).toBe(false);
  });
});

describe('nuncaAssinou — muda o texto do paywall', () => {
  it('é verdadeiro para quem só teve teste', () => {
    const e = estadoDeAcesso({ subscriptionStatus: 'trial', trialEndsAt: AGORA - DIA }, AGORA);
    expect(e.nuncaAssinou).toBe(true);
  });

  it('é falso para quem já pagou alguma vez', () => {
    const e = estadoDeAcesso({
      subscriptionStatus: 'vencido',
      subscriptionExpiresAt: AGORA - DIA,
    }, AGORA);
    expect(e.nuncaAssinou).toBe(false);
  });
});
