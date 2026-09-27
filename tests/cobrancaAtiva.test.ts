import { describe, it, expect, afterEach } from 'vitest';
import { cobrancaAtiva } from '@/utils/supabase/subscription-guard';

/**
 * O interruptor geral da cobranca. Ele existe para o dono publicar a integracao sem abrir a
 * venda, e para desligar a cobranca a qualquer momento sem mexer em codigo nem em banco.
 *
 * A regra que nao pode quebrar: DESLIGADO por padrao. Ambiente novo, variavel esquecida ou
 * valor digitado errado no painel nunca podem comecar barrando aluno pagante.
 */

const original = process.env.COBRANCA_ATIVA;
afterEach(() => {
  if (original === undefined) delete process.env.COBRANCA_ATIVA;
  else process.env.COBRANCA_ATIVA = original;
});

describe('cobrancaAtiva — desligado por padrao', () => {
  it('variavel ausente = desligado', () => {
    delete process.env.COBRANCA_ATIVA;
    expect(cobrancaAtiva()).toBe(false);
  });

  it('vazio = desligado', () => {
    process.env.COBRANCA_ATIVA = '';
    expect(cobrancaAtiva()).toBe(false);
  });

  it('so o valor exato "true" liga', () => {
    process.env.COBRANCA_ATIVA = 'true';
    expect(cobrancaAtiva()).toBe(true);
  });
});

describe('cobrancaAtiva — valores parecidos NAO ligam', () => {
  it('ligar por engano e pior que nao ligar: quem digita errado no painel nao abre a venda', () => {
    // O erro de digitacao tem que falhar para o lado seguro. Se "TRUE" ou "1" ligassem, o
    // dono poderia abrir cobranca sem querer e barrar os alunos de cortesia.
    for (const v of ['TRUE', 'True', '1', 'sim', 'yes', 'on', ' true', 'true ']) {
      process.env.COBRANCA_ATIVA = v;
      expect(cobrancaAtiva(), `valor ${JSON.stringify(v)} nao deveria ligar`).toBe(false);
    }
  });
});
