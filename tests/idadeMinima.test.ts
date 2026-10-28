import { describe, it, expect } from 'vitest';
import { validarIdade, IDADE_MINIMA, IDADE_MAXIMA } from '@/lib/idadeMinima';

/**
 * A politica de privacidade diz "nao e direcionado a menores de 18 anos" desde que foi
 * publicada. Ate 28/10/2026 o app dizia outra coisa: o seletor do onboarding tinha piso 14 e o
 * campo da anamnese aceitava qualquer numero.
 */

describe('validarIdade', () => {
  it('aceita a idade minima', () => {
    expect(validarIdade(18)).toBeNull();
  });

  it('aceita idade normal de aluno', () => {
    expect(validarIdade(29)).toBeNull();
    expect(validarIdade(45)).toBeNull();
  });

  it('aceita o teto', () => {
    expect(validarIdade(IDADE_MAXIMA)).toBeNull();
  });

  it('RECUSA 17: um ano abaixo ja e menor', () => {
    expect(validarIdade(17)).toContain('18');
  });

  it('recusa o piso antigo de 14', () => {
    expect(validarIdade(14)).not.toBeNull();
  });

  it('recusa crianca', () => {
    expect(validarIdade(8)).not.toBeNull();
  });

  it('recusa acima do teto: e erro de digitacao, nao pessoa', () => {
    expect(validarIdade(150)).toContain('100');
  });

  it('aceita texto que e numero, porque o campo da anamnese devolve string', () => {
    expect(validarIdade('18')).toBeNull();
    expect(validarIdade(' 25 ')).toBeNull();
    expect(validarIdade('16')).not.toBeNull();
  });

  it('RECUSA FRACAO: 17,9 nao e maior de idade', () => {
    // Sem isto, "17.99" passaria num campo que so compara com >= 18 depois de arredondar.
    expect(validarIdade(17.99)).not.toBeNull();
    expect(validarIdade('18.5')).not.toBeNull();
  });

  it('recusa o que nao e numero', () => {
    expect(validarIdade('abc')).not.toBeNull();
    expect(validarIdade({})).not.toBeNull();
  });

  it('pede a idade quando o campo esta vazio, em vez de reclamar do valor', () => {
    expect(validarIdade('')).toBe('Informe sua idade.');
    expect(validarIdade(null)).toBe('Informe sua idade.');
    expect(validarIdade(undefined)).toBe('Informe sua idade.');
  });

  it('a mensagem DIZ O QUE FAZER, nao so que esta errado', () => {
    // A anamnese mostrava "Esse campo e obrigatorio" para qualquer problema -- texto errado
    // para quem digitou 16.
    const m = validarIdade(16);
    expect(m).toBeTruthy();
    expect(m).not.toContain('obrigatório');
  });

  it('a constante e 18', () => {
    expect(IDADE_MINIMA).toBe(18);
  });
});
