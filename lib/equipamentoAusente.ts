// O que a academia do aluno NÃO tem.
//
// Complementa lib/equipmentTier.ts, que decide o TIPO de lugar (academia completa, halteres
// em casa, barra, peso corporal). Isto é a camada fina: dentro de uma academia completa, cada
// uma tem um conjunto diferente de aparelhos.
//
// POR QUE MARCAR O QUE FALTA, E NÃO O QUE TEM
//
// Quem não preencher nada continua recebendo o catálogo inteiro — que é o comportamento de
// hoje, e o certo para a maioria. Se a lista fosse do que TEM, o campo vazio significaria
// "não tem nada" e quebraria o treino de todo aluno que ignorasse a tela.
//
// POR QUE NÃO CUSTA IA
//
// O corte acontece no código, antes de montar o prompt. Não há pergunta extra ao modelo. E
// economiza indiretamente: exercício que a academia não tem vira troca, e cada troca É uma
// chamada de IA.

export interface ItemDeEquipamento {
  id: string;
  /** Como o aluno reconhece o aparelho. */
  rotulo: string;
  /** Uma frase curta para quem não tem certeza do que é. */
  ajuda?: string;
  /** Palavras que identificam o exercício pelo nome, em minúsculas. */
  palavras: string[];
}

/**
 * A lista é curta de propósito.
 *
 * Trinta caixas para marcar é um formulário que ninguém preenche. Estes são os aparelhos que
 * de fato faltam com frequência em academia de bairro — e cada um corta vários exercícios do
 * catálogo, então o ganho por caixa marcada é alto.
 */
export const EQUIPAMENTOS: ItemDeEquipamento[] = [
  { id: 'leg_press',   rotulo: 'Leg press',            palavras: ['leg press'] },
  { id: 'hack',        rotulo: 'Hack',                 ajuda: 'agachamento na máquina inclinada', palavras: ['hack'] },
  { id: 'extensora',   rotulo: 'Cadeira extensora',    palavras: ['cadeira extensora', 'mesa extensora'] },
  { id: 'flexora',     rotulo: 'Cadeira ou mesa flexora', palavras: ['cadeira flexora', 'mesa flexora'] },
  { id: 'adutora',     rotulo: 'Adutora e abdutora',   ajuda: 'as cadeiras de abrir e fechar as pernas', palavras: ['cadeira adutora', 'cadeira abdutora', 'adutor', 'abdutor'] },
  { id: 'graviton',    rotulo: 'Graviton',             ajuda: 'máquina de barra fixa assistida', palavras: ['graviton'] },
  { id: 'cross_over',  rotulo: 'Cross over',           ajuda: 'as duas polias altas, uma de cada lado', palavras: ['cross over', 'crossover'] },
  { id: 'voador',      rotulo: 'Voador / peck deck',   palavras: ['voador', 'pec deck', 'peck deck'] },
  { id: 'smith',       rotulo: 'Smith',                ajuda: 'a barra guiada nos trilhos', palavras: ['smith'] },
  { id: 'barra_fixa',  rotulo: 'Barra fixa',           palavras: ['barra fixa'] },
  { id: 'paralelas',   rotulo: 'Paralelas',            ajuda: 'para mergulho de tríceps', palavras: ['paralelas', 'dips', 'mergulho'] },
  { id: 'polia',       rotulo: 'Polia / cabo',         ajuda: 'raro faltar, mas acontece em academia pequena', palavras: ['polia', 'cabo', 'pulley'] },
];

/** Para validar o que chega do formulário. */
export const IDS_VALIDOS = EQUIPAMENTOS.map(e => e.id);

/**
 * Remove do bolso os exercícios que dependem de aparelho que a academia não tem.
 *
 * SALVAGUARDA POR GRUPO MUSCULAR: se o corte esvaziar um grupo inteiro, esse grupo volta
 * completo. Sem isso, um aluno que marca muitas caixas ficaria sem nenhum exercício de perna,
 * e o treino sairia torto sem ele entender por quê — melhor receber um exercício que talvez
 * não sirva do que não receber nada.
 */
export function filtrarPorEquipamentoAusente<T extends { name: string; muscle_group?: string | null }>(
  exercicios: T[],
  ausentes: string[] | null | undefined
): T[] {
  if (!ausentes?.length) return exercicios;

  const palavras = EQUIPAMENTOS
    .filter(e => ausentes.includes(e.id))
    .flatMap(e => e.palavras);

  if (palavras.length === 0) return exercicios;

  const usa = (nome: string) => {
    const n = nome.toLowerCase();
    return palavras.some(p => n.includes(p));
  };

  const filtrados = exercicios.filter(ex => !usa(ex.name));

  const gruposAntes = new Set(exercicios.map(e => e.muscle_group || 'Outros'));
  const gruposDepois = new Set(filtrados.map(e => e.muscle_group || 'Outros'));
  const zerados = [...gruposAntes].filter(g => !gruposDepois.has(g));

  if (zerados.length === 0) return filtrados;

  return [
    ...filtrados,
    ...exercicios.filter(e => zerados.includes(e.muscle_group || 'Outros')),
  ];
}

/** Texto curto para a tela dizer o que a escolha está cortando. */
export function resumirAusentes(ausentes: string[] | null | undefined): string {
  if (!ausentes?.length) return 'Nenhum aparelho marcado — você recebe o catálogo completo.';
  const nomes = EQUIPAMENTOS.filter(e => ausentes.includes(e.id)).map(e => e.rotulo);
  if (nomes.length === 0) return 'Nenhum aparelho marcado — você recebe o catálogo completo.';
  if (nomes.length === 1) return `Exercícios de ${nomes[0]} não vão aparecer nos seus treinos.`;
  return `Exercícios de ${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]} não vão aparecer nos seus treinos.`;
}
