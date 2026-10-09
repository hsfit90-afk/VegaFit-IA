// As duas listas de exercícios de um aluno: o que priorizar e o que nunca prescrever.
//
// POR QUE ISTO É UMA FUNÇÃO, E NÃO TRÊS LINHAS DENTRO DA ROTA
//
// A regra que importa aqui é uma invariante, não um cálculo: um exercício está em UMA lista ou
// em nenhuma, nunca nas duas. Se o mesmo id ficar nas duas, app/api/treino/route.ts filtra os
// banidos antes de resolver os favoritos — o exercício é descartado e o favorito simplesmente
// não acontece, sem erro, sem aviso, sem nada na tela que explique por quê.
//
// Invariante silenciosa é exatamente o tipo de coisa que precisa de teste, e teste precisa de
// função que não dependa de banco.

export type Marca = 'favorito' | 'banido' | 'nenhum';

export interface ListasDoAluno {
  favoritos: string[];
  banidos: string[];
}

/**
 * Teto por lista.
 *
 * Só 70 exercícios do catálogo chegam ao prompt (TOTAL_CATALOG_BUDGET em
 * app/api/treino/route.ts). Favoritar sessenta já é mais do que a IA consegue considerar; o
 * teto existe para a lista não virar um despejo de nomes que não orienta nada.
 */
export const LIMITE_POR_LISTA = 60;

/**
 * Move um exercício para uma das listas, ou tira das duas.
 *
 * Sai das duas listas primeiro e só depois entra na pedida. É o que garante a exclusividade, e
 * também o que faz 'nenhum' funcionar sem nenhum caso especial.
 *
 * Idempotente: marcar como favorito algo que já é favorito não duplica o id.
 */
export function moverExercicio(
  listas: ListasDoAluno,
  exercicioId: string,
  marca: Marca
): ListasDoAluno {
  const semEle = (arr: string[]) => arr.filter(id => id !== exercicioId);
  const favoritos = semEle(listas.favoritos);
  const banidos = semEle(listas.banidos);

  if (marca === 'favorito') return { favoritos: [...favoritos, exercicioId], banidos };
  if (marca === 'banido') return { favoritos, banidos: [...banidos, exercicioId] };
  return { favoritos, banidos };
}

/** Em qual lista o exercício está. */
export function marcaDe(listas: ListasDoAluno, exercicioId: string): Marca {
  if (listas.favoritos.includes(exercicioId)) return 'favorito';
  if (listas.banidos.includes(exercicioId)) return 'banido';
  return 'nenhum';
}

/** Normaliza o que veio do banco: coluna nula, duplicata e id vazio viram lista limpa. */
export function normalizarListas(
  favoritos: string[] | null | undefined,
  banidos: string[] | null | undefined
): ListasDoAluno {
  const limpar = (arr: string[] | null | undefined) =>
    [...new Set((arr ?? []).filter(id => typeof id === 'string' && id.length > 0))];

  const favs = limpar(favoritos);
  const bans = limpar(banidos);

  // Se o banco já tem um id nas duas listas (escrita antiga, antes desta função existir),
  // banido ganha. É a marca que carrega decisão de saúde: na dúvida, não prescrever.
  return { favoritos: favs.filter(id => !bans.includes(id)), banidos: bans };
}

/** true quando alguma lista passou do teto — a rota recusa a gravação nesse caso. */
export function passouDoLimite(listas: ListasDoAluno): boolean {
  return listas.favoritos.length > LIMITE_POR_LISTA || listas.banidos.length > LIMITE_POR_LISTA;
}
