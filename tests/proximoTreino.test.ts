import { describe, it, expect } from 'vitest';
import {
  musculosEmFadiga,
  escolherSessao,
  sessaoSeguinte,
  minutosDaSessao,
  HORAS_DE_FADIGA,
  type TreinoFeito,
  type SessaoDoPlano,
} from '@/lib/proximoTreino';

const HORA = 60 * 60 * 1000;
const AGORA = 1_760_000_000_000;

const treino = (horasAtras: number, musculos: string[]): TreinoFeito => ({
  date: AGORA - horasAtras * HORA,
  exercises: musculos.map(m => ({ muscleGroup: m })),
});

/** Um plano A-B-C clássico. */
const plano: SessaoDoPlano[] = [
  { name: 'Treino A', exercises: [{ muscleGroup: 'Peito' }, { muscleGroup: 'Tríceps' }] },
  { name: 'Treino B', exercises: [{ muscleGroup: 'Costas' }, { muscleGroup: 'Bíceps' }] },
  { name: 'Treino C', exercises: [{ muscleGroup: 'Pernas (quadríceps)' }] },
];

describe('musculosEmFadiga', () => {
  it('pega o que foi treinado nas ultimas 24h', () => {
    const f = musculosEmFadiga([treino(3, ['Peito', 'Tríceps'])], AGORA);
    expect([...f].sort()).toEqual(['peito', 'tríceps']);
  });

  it('ignora o que passou das 24h', () => {
    expect(musculosEmFadiga([treino(25, ['Peito'])], AGORA).size).toBe(0);
  });

  it('a fronteira de 24h exclui, nao inclui', () => {
    expect(musculosEmFadiga([treino(HORAS_DE_FADIGA, ['Peito'])], AGORA).size).toBe(0);
    expect(musculosEmFadiga([treino(HORAS_DE_FADIGA - 0.1, ['Peito'])], AGORA).size).toBe(1);
  });

  it('normaliza a caixa', () => {
    // O catalogo gravou "Peito", "peito" e "PEITO" conforme a epoca. Um Set que distingue os
    // tres nao detecta fadiga nenhuma.
    const f = musculosEmFadiga([treino(1, ['PEITO']), treino(2, ['peito'])], AGORA);
    expect(f.size).toBe(1);
    expect(f.has('peito')).toBe(true);
  });

  it('junta varios treinos recentes', () => {
    const f = musculosEmFadiga([treino(2, ['Peito']), treino(20, ['Costas'])], AGORA);
    expect([...f].sort()).toEqual(['costas', 'peito']);
  });

  it('aguenta historico vazio, exercicio sem grupo e lista ausente', () => {
    expect(musculosEmFadiga([], AGORA).size).toBe(0);
    expect(musculosEmFadiga([{ date: AGORA, exercises: [{ muscleGroup: null }] }], AGORA).size).toBe(0);
    expect(musculosEmFadiga([{ date: AGORA, exercises: [] }], AGORA).size).toBe(0);
  });
});

describe('escolherSessao', () => {
  const semFadiga = new Set<string>();

  it('sem fadiga, segue o rodizio', () => {
    expect(escolherSessao(plano, 1, semFadiga)).toEqual({
      indice: 1, indiceDoCiclo: 1, desviadoPorFadiga: false,
    });
  });

  it('desvia quando o dia do rodizio usa musculo em recuperacao', () => {
    // Treinou peito ontem; hoje o rodizio cairia no Treino A (peito). Pula para o B.
    const fadiga = musculosEmFadiga([treino(10, ['Peito'])], AGORA);
    const r = escolherSessao(plano, 0, fadiga);
    expect(r.indice).toBe(1);
    expect(r.desviadoPorFadiga).toBe(true);
    expect(r.indiceDoCiclo).toBe(0);
  });

  it('pula mais de um dia quando precisa', () => {
    const fadiga = musculosEmFadiga([treino(5, ['Peito', 'Costas'])], AGORA);
    expect(escolherSessao(plano, 0, fadiga).indice).toBe(2);
  });

  it('da a volta no plano', () => {
    // Comeca no C, que esta fatigado; o A esta livre.
    const fadiga = musculosEmFadiga([treino(5, ['Pernas (quadríceps)'])], AGORA);
    expect(escolherSessao(plano, 2, fadiga).indice).toBe(0);
  });

  it('todos fatigados devolve o dia do rodizio, sem alegar desvio', () => {
    // Um app que se recusa a sugerir treino e pior que um que sugere com ressalva.
    const fadiga = musculosEmFadiga(
      [treino(2, ['Peito', 'Tríceps', 'Costas', 'Bíceps', 'Pernas (quadríceps)'])],
      AGORA
    );
    expect(escolherSessao(plano, 1, fadiga)).toEqual({
      indice: 1, indiceDoCiclo: 1, desviadoPorFadiga: false,
    });
  });

  it('plano vazio ou ausente nao quebra', () => {
    expect(escolherSessao([], 0, semFadiga).indice).toBe(0);
    expect(escolherSessao(null, 2, semFadiga).indice).toBe(2);
    expect(escolherSessao(undefined, 2, semFadiga).indice).toBe(2);
  });

  it('COMPORTAMENTO PRESERVADO: indice do ciclo fora da faixa alega desvio sem fadiga', () => {
    // Acontece quando o aluno troca para um plano com MENOS dias e o indice guardado em
    // user_session_index ficou maior. O laco devolve o indice normalizado (0), o do ciclo
    // continua 3, e os dois diferem apontando para a MESMA sessao -- a tela mostra "Fadiga
    // Detectada" sem fadiga.
    //
    // Isto e o que o dashboard faz desde sempre, e a extracao nao pode mudar o que o aluno ve.
    // O teste existe para quem for corrigir saber que e decisao, nao descuido.
    const fadiga = musculosEmFadiga([treino(5, ['Costas'])], AGORA);
    const r = escolherSessao(plano, 3, fadiga);
    expect(r.indice).toBe(0);
    expect(r.indiceDoCiclo).toBe(3);
    expect(r.desviadoPorFadiga).toBe(true);
  });
});

describe('sessaoSeguinte', () => {
  const semFadiga = new Set<string>();

  it('é o proximo do ciclo quando nada esta fatigado', () => {
    expect(sessaoSeguinte(plano, 0, semFadiga)).toBe(1);
    expect(sessaoSeguinte(plano, 2, semFadiga)).toBe(0);
  });

  it('nunca devolve o dia atual', () => {
    for (let i = 0; i < plano.length; i++) {
      expect(sessaoSeguinte(plano, i, semFadiga)).not.toBe(i);
    }
  });

  it('pula o que esta em recuperacao', () => {
    const fadiga = musculosEmFadiga([treino(5, ['Costas'])], AGORA);
    expect(sessaoSeguinte(plano, 0, fadiga)).toBe(2);
  });

  it('todos fatigados devolve o proximo do ciclo mesmo assim', () => {
    const fadiga = musculosEmFadiga(
      [treino(2, ['Peito', 'Tríceps', 'Costas', 'Bíceps', 'Pernas (quadríceps)'])],
      AGORA
    );
    expect(sessaoSeguinte(plano, 0, fadiga)).toBe(1);
  });

  it('plano vazio nao quebra', () => {
    expect(sessaoSeguinte([], 0, semFadiga)).toBe(1);
    expect(sessaoSeguinte(null, 4, semFadiga)).toBe(5);
  });
});

describe('minutosDaSessao', () => {
  it('conta cinco minutos por exercicio, como a tela do aluno mostra', () => {
    expect(minutosDaSessao(plano[0])).toBe(10);
    expect(minutosDaSessao(plano[2])).toBe(5);
  });

  it('sessao vazia ou ausente da zero', () => {
    expect(minutosDaSessao({ exercises: [] })).toBe(0);
    expect(minutosDaSessao(undefined)).toBe(0);
    expect(minutosDaSessao(null)).toBe(0);
  });
});
