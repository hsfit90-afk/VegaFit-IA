import { describe, it, expect } from 'vitest';
import {
  faltamEssenciais,
  temOEssencial,
  passosEssenciais,
  CAMPOS_ESSENCIAIS,
} from '@/lib/anamneseEssencial';
import { anamneseSteps } from '@/lib/anamneseSteps';

const completo = { objetivo: ['Hipertrofia'], nivel: 'Iniciante', local: 'Em casa' };

describe('faltamEssenciais', () => {
  it('nada falta quando os tres estao respondidos', () => {
    expect(faltamEssenciais(completo)).toEqual([]);
    expect(temOEssencial(completo)).toBe(true);
  });

  it('aponta o que falta', () => {
    expect(faltamEssenciais({ objetivo: ['Hipertrofia'] })).toEqual(['nivel', 'local']);
  });

  it('anamnese inexistente falta tudo', () => {
    // O caso real: 12 de 13 pessoas no banco em 11/10/2026.
    expect(faltamEssenciais(null)).toEqual(['objetivo', 'nivel', 'local']);
    expect(faltamEssenciais(undefined)).toEqual(['objetivo', 'nivel', 'local']);
    expect(faltamEssenciais({})).toEqual(['objetivo', 'nivel', 'local']);
  });

  it('string vazia e lista vazia contam como nao respondido', () => {
    expect(faltamEssenciais({ ...completo, nivel: '   ' })).toContain('nivel');
    expect(faltamEssenciais({ ...completo, objetivo: [] })).toContain('objetivo');
  });

  it('equipamento de casa NAO bloqueia', () => {
    // Lista vazia e resposta legitima: significa so peso do corpo, 424 exercicios. Exigir
    // marcacao transformaria um padrao correto em bloqueio.
    expect(temOEssencial({ ...completo, equipamentos_casa: [] })).toBe(true);
  });

  it('lesoes NAO bloqueia', () => {
    // Quem nao tem lesao nao deve ser obrigado a escrever "nenhuma" para destravar o app.
    expect(temOEssencial(completo)).toBe(true);
  });
});

describe('passosEssenciais', () => {
  const curtos = passosEssenciais(anamneseSteps);

  it('e bem menor que a anamnese completa', () => {
    const camposCompletos = anamneseSteps.reduce((n, p) => n + p.fields.length, 0);
    const camposCurtos = curtos.reduce((n, p) => n + p.fields.length, 0);
    expect(camposCurtos).toBeLessThanOrEqual(CAMPOS_ESSENCIAIS.length);
    expect(camposCurtos).toBeLessThan(camposCompletos / 4);
  });

  it('nao perde nenhum campo essencial pelo caminho', () => {
    // Se alguem renomear um id em anamneseSteps.ts, este teste cai -- que e o ponto: hoje a
    // lista curta reaproveita a definicao completa, e um id trocado faria a pergunta sumir
    // da anamnese curta em silencio.
    const ids = curtos.flatMap(p => p.fields.map(f => f.id));
    for (const campo of CAMPOS_ESSENCIAIS) {
      expect(ids).toContain(campo);
    }
  });

  it('nao devolve passo vazio', () => {
    expect(curtos.every(p => p.fields.length > 0)).toBe(true);
  });

  it('preserva a condicao dos passos e dos campos', () => {
    // "O que voce tem em casa" so aparece para quem treina em casa, e isso tem que continuar
    // valendo na versao curta.
    const campoCasa = curtos.flatMap(p => p.fields).find(f => f.id === 'equipamentos_casa');
    expect(campoCasa?.condition).toBeTypeOf('function');
    expect(campoCasa?.condition?.({ local: 'Em casa' })).toBe(true);
    expect(campoCasa?.condition?.({ local: 'Academia completa' })).toBe(false);
  });
});
