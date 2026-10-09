// Casa o que foi lido de uma ficha com os exercícios do catálogo.
//
// É a parte que decide se a importação serve para alguma coisa. Um nome solto não traz vídeo,
// não passa pelo filtro de nível nem pelo de equipamento, e não entra na conta de volume —
// vira texto numa tela. Casado com o catálogo, o exercício importado se comporta como
// qualquer outro.
//
// NÃO É BUSCA EXATA, de propósito. A ficha escrita à mão diz "Supino reto", o catálogo diz
// "Supino reto com barra". Exigir igualdade descartaria quase tudo.

export interface ExercicioDoCatalogo {
  id: string;
  name: string;
  muscle_group?: string | null;
}

export interface ExercicioLido {
  name: string;
  sets?: number;
  reps?: string;
  restSeconds?: number;
}

export interface ExercicioCasado extends ExercicioLido {
  /** Preenchido quando achou correspondente no catálogo. */
  exerciseId?: string;
  /** O nome do CATÁLOGO, que é o que o resto do app entende. */
  nomeNoCatalogo?: string;
  muscleGroup?: string;
  /** 0 a 1. A tela usa para destacar o que precisa de conferência. */
  confianca: number;
}

/**
 * Tira acento, pontuação e palavras que não distinguem nada.
 *
 * "Supino reto c/ barra" e "Supino Reto com Barra" precisam virar a mesma coisa. As palavras
 * descartadas aparecem em quase todo nome e só atrapalham a contagem.
 */
const RUIDO = new Set(['com', 'de', 'do', 'da', 'no', 'na', 'em', 'o', 'a', 'e', 'c', 'para', 'the']);

export function normalizar(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(p => p.length > 1 && !RUIDO.has(p));
}

/**
 * Quanto dois nomes se parecem, de 0 a 1.
 *
 * Conta palavras em comum sobre o total do nome LIDO, não do catálogo. O motivo: a ficha
 * costuma ser mais curta que o catálogo ("Supino reto" vs "Supino reto com barra"), e dividir
 * pelo nome longo puniria justamente o caso comum.
 */
export function semelhanca(lido: string, doCatalogo: string): number {
  const a = normalizar(lido);
  const b = new Set(normalizar(doCatalogo));
  if (a.length === 0) return 0;
  const comuns = a.filter(p => b.has(p)).length;
  return comuns / a.length;
}

/** Abaixo disto, é chute: melhor devolver sem correspondente e deixar o aluno escolher. */
export const CONFIANCA_MINIMA = 0.6;

export function casarComCatalogo(
  lidos: ExercicioLido[],
  catalogo: ExercicioDoCatalogo[]
): ExercicioCasado[] {
  return lidos.map(lido => {
    let melhor: ExercicioDoCatalogo | null = null;
    let melhorNota = 0;

    for (const c of catalogo) {
      const nota = semelhanca(lido.name, c.name);
      if (nota > melhorNota) { melhorNota = nota; melhor = c; }
      if (nota === 1) break; // não há como melhorar
    }

    if (!melhor || melhorNota < CONFIANCA_MINIMA) {
      return { ...lido, confianca: melhorNota };
    }

    return {
      ...lido,
      exerciseId: melhor.id,
      nomeNoCatalogo: melhor.name,
      muscleGroup: melhor.muscle_group ?? undefined,
      confianca: melhorNota,
    };
  });
}

/**
 * Normaliza os números que vieram da leitura.
 *
 * Ficha de academia escreve "3x12", "3 x 12", "3X12-15" e "12 reps". O modelo costuma separar,
 * mas quando não separa, o valor chega torto — e um "sets: 0" vira sessão quebrada na tela do
 * aluno, que não tem como consertar sozinho.
 */
export function limparNumeros(e: ExercicioLido): ExercicioLido {
  const sets = Number(e.sets);
  const descanso = Number(e.restSeconds);
  return {
    ...e,
    name: String(e.name || '').trim().slice(0, 160),
    sets: Number.isFinite(sets) && sets >= 1 && sets <= 10 ? Math.round(sets) : 3,
    reps: String(e.reps || '8-12').trim().slice(0, 20) || '8-12',
    restSeconds: Number.isFinite(descanso) && descanso >= 0 && descanso <= 600 ? Math.round(descanso) : 60,
  };
}

/** Quantos exercícios a tela precisa que o aluno confira. */
export function precisamDeConferencia(casados: ExercicioCasado[]): number {
  return casados.filter(c => !c.exerciseId).length;
}
