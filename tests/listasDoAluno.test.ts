import { describe, it, expect } from 'vitest';
import {
  moverExercicio,
  marcaDe,
  normalizarListas,
  passouDoLimite,
  LIMITE_POR_LISTA,
  type ListasDoAluno,
} from '@/lib/listasDoAluno';

const AGACHAMENTO = 'a1111111-1111-1111-1111-111111111111';
const SUPINO = 'b2222222-2222-2222-2222-222222222222';
const ROSCA = 'c3333333-3333-3333-3333-333333333333';

const vazio = (): ListasDoAluno => ({ favoritos: [], banidos: [] });

describe('moverExercicio', () => {
  it('coloca na lista pedida', () => {
    expect(moverExercicio(vazio(), SUPINO, 'favorito')).toEqual({
      favoritos: [SUPINO], banidos: [],
    });
    expect(moverExercicio(vazio(), SUPINO, 'banido')).toEqual({
      favoritos: [], banidos: [SUPINO],
    });
  });

  it('nunca deixa o mesmo exercicio nas duas listas', () => {
    // A invariante que da nome ao arquivo. Nas duas listas, a rota de geracao filtra os
    // banidos primeiro: o exercicio e descartado e o favorito nunca acontece, em silencio.
    const favoritado = moverExercicio(vazio(), AGACHAMENTO, 'favorito');
    const depoisBanido = moverExercicio(favoritado, AGACHAMENTO, 'banido');

    expect(depoisBanido.banidos).toContain(AGACHAMENTO);
    expect(depoisBanido.favoritos).not.toContain(AGACHAMENTO);

    const devolta = moverExercicio(depoisBanido, AGACHAMENTO, 'favorito');
    expect(devolta.favoritos).toContain(AGACHAMENTO);
    expect(devolta.banidos).not.toContain(AGACHAMENTO);
  });

  it("'nenhum' tira das duas listas", () => {
    const comMarcas: ListasDoAluno = { favoritos: [SUPINO], banidos: [AGACHAMENTO] };
    expect(moverExercicio(comMarcas, SUPINO, 'nenhum').favoritos).toEqual([]);
    expect(moverExercicio(comMarcas, AGACHAMENTO, 'nenhum').banidos).toEqual([]);
  });

  it('e idempotente: marcar duas vezes nao duplica', () => {
    let listas = moverExercicio(vazio(), SUPINO, 'favorito');
    listas = moverExercicio(listas, SUPINO, 'favorito');
    expect(listas.favoritos).toEqual([SUPINO]);
  });

  it('nao mexe nos outros exercicios', () => {
    const listas: ListasDoAluno = { favoritos: [SUPINO, ROSCA], banidos: [AGACHAMENTO] };
    const depois = moverExercicio(listas, SUPINO, 'nenhum');
    expect(depois.favoritos).toEqual([ROSCA]);
    expect(depois.banidos).toEqual([AGACHAMENTO]);
  });

  it('nao altera o objeto recebido', () => {
    const listas: ListasDoAluno = { favoritos: [SUPINO], banidos: [] };
    moverExercicio(listas, AGACHAMENTO, 'banido');
    expect(listas).toEqual({ favoritos: [SUPINO], banidos: [] });
  });
});

describe('marcaDe', () => {
  it('diz em qual lista o exercicio esta', () => {
    const listas: ListasDoAluno = { favoritos: [SUPINO], banidos: [AGACHAMENTO] };
    expect(marcaDe(listas, SUPINO)).toBe('favorito');
    expect(marcaDe(listas, AGACHAMENTO)).toBe('banido');
    expect(marcaDe(listas, ROSCA)).toBe('nenhum');
  });
});

describe('normalizarListas', () => {
  it('trata coluna nula como lista vazia', () => {
    // Perfil novo nasce com as colunas nulas, desde que o upsert de AppContext parou de
    // gravar as duas listas junto com o resto do perfil.
    expect(normalizarListas(null, null)).toEqual({ favoritos: [], banidos: [] });
    expect(normalizarListas(undefined, undefined)).toEqual({ favoritos: [], banidos: [] });
  });

  it('remove duplicata e id vazio', () => {
    expect(normalizarListas([SUPINO, SUPINO, ''], [])).toEqual({
      favoritos: [SUPINO], banidos: [],
    });
  });

  it('banido ganha quando o id esta nas duas listas', () => {
    // Dado sujo de escrita antiga, de antes da exclusividade existir. Banido carrega decisao
    // de saude: na duvida, nao prescrever.
    const r = normalizarListas([AGACHAMENTO, SUPINO], [AGACHAMENTO]);
    expect(r.banidos).toEqual([AGACHAMENTO]);
    expect(r.favoritos).toEqual([SUPINO]);
  });
});

describe('passouDoLimite', () => {
  it('aceita exatamente o limite', () => {
    const cheia = Array.from({ length: LIMITE_POR_LISTA }, (_, i) => `id-${i}`);
    expect(passouDoLimite({ favoritos: cheia, banidos: [] })).toBe(false);
  });

  it('recusa um a mais, em qualquer das duas listas', () => {
    const demais = Array.from({ length: LIMITE_POR_LISTA + 1 }, (_, i) => `id-${i}`);
    expect(passouDoLimite({ favoritos: demais, banidos: [] })).toBe(true);
    expect(passouDoLimite({ favoritos: [], banidos: demais })).toBe(true);
  });
});
