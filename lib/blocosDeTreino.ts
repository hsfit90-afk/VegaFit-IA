/**
 * Blocos: exercícios que o aluno executa juntos, dividindo o mesmo descanso.
 *
 * O BURACO QUE ISTO FECHA
 *
 * Superset e Circuito eram só rótulo. Pirâmide, Rest-Pause e Drop Set ganharam estrutura no
 * dado em 27/09/2026 (targetLabels, targetReps, targetWeights) — estes dois ficaram de fora,
 * porque NÃO HAVIA ONDE GRAVAR O PAR. O prompt pedia "certifique-se de parear exercícios
 * coerentes", e o par existia só na cabeça do modelo: sumia no salvamento.
 *
 * Resultado: o aluno que esperou três meses pelo Superset recebia uma lista igual à do
 * tradicional, um exercício embaixo do outro, cada um com seu descanso. O método não existia.
 *
 * QUEM DECIDE O QUÊ
 *
 * A IA ORDENA a sessão — quais exercícios ficam lado a lado é escolha de prescrição, do mesmo
 * tipo que escolher os exercícios. O CÓDIGO monta o bloco a partir dessa ordem e garante a
 * estrutura: par de dois, contíguo, sobra tratada. É a divisão de sempre neste projeto, e o
 * motivo de sempre — prompt não é enforcement, mas prescrição também não se resolve por regex.
 *
 * Se a IA ordenar mal, o par sai do mesmo músculo. Isso não é erro: é um BI-SET, que existe,
 * e a tela avisa que a carga tende a cair. A falha é suave de propósito.
 *
 * O RÓTULO NÃO É GRAVADO, É CALCULADO
 *
 * Guardar "é bi-set" junto do exercício criaria uma segunda fonte de verdade que envelhece: o
 * profissional troca um exercício no montador e o rótulo continua dizendo o que era antes.
 * tipoDoBloco() responde na hora, a partir dos exercícios que estão lá.
 */

/**
 * Grupo muscular canônico, a partir do que o catálogo escreve.
 *
 * Mapeamento EXPLÍCITO, não por pedaço de palavra. "Extensão" sozinha casa com 43 exercícios
 * do catálogo e a maioria é tríceps; "frontal" pegou 17 errados para acertar 6. A armadilha do
 * prefixo já mordeu três vezes neste repositório.
 *
 * Os valores vêm do tipo MuscleGroup (lib/types.ts) e foram conferidos contra as migrações.
 * MUSCLE_ALIASES não serve aqui: ele junta quadríceps e posterior de coxa em "perna", e esses
 * dois são justamente o par antagonista das pernas.
 */
const CANONICO: Record<string, string> = {
  'peito': 'peito',
  'peitoral': 'peito',
  'costas': 'costas',
  'dorsal': 'costas',
  'ombro': 'ombro',
  'deltoide': 'ombro',
  'biceps': 'biceps',
  'triceps': 'triceps',
  'antebraco': 'antebraco',
  'pernas (quadriceps)': 'quadriceps',
  'quadriceps': 'quadriceps',
  'posterior de coxa': 'posterior',
  'posterior': 'posterior',
  'gluteos': 'gluteos',
  'gluteo': 'gluteos',
  'core/abdomen': 'core',
  'abdomen': 'core',
  'core': 'core',
  'panturrilhas': 'panturrilha',
  'panturrilha': 'panturrilha',
  'lombar': 'lombar',
};

/** Tira acento e caixa, para "Pernas (quadríceps)" e "pernas (quadriceps)" caírem no mesmo lugar. */
function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

export function grupoCanonico(muscleGroup: string | null | undefined): string | null {
  if (typeof muscleGroup !== 'string') return null;
  return CANONICO[semAcento(muscleGroup)] ?? null;
}

/**
 * Os pares agonista-antagonista.
 *
 * Exatamente os três que a revisão de evidência de 22/10/2026 nomeia. Ombro fica de fora: a
 * oposição do deltoide é entre porções do próprio músculo, não entre grupos do catálogo, e
 * inventar um par aqui seria dizer de evidência o que ela não diz.
 *
 * A meta-análise de 19 estudos (Zhang 2025) mostra que o par antagonista permite MAIS
 * repetições, e que o par do mesmo músculo REDUZ o volume de carga. Por isso o gerador tenta
 * antagonista primeiro, e por isso o bi-set vem com aviso em vez de vir proibido.
 */
export const PARES_ANTAGONISTAS: readonly (readonly [string, string])[] = [
  ['peito', 'costas'],
  ['biceps', 'triceps'],
  ['quadriceps', 'posterior'],
] as const;

export function saoAntagonistas(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = grupoCanonico(a);
  const cb = grupoCanonico(b);
  if (!ca || !cb) return false;
  return PARES_ANTAGONISTAS.some(([x, y]) => (ca === x && cb === y) || (ca === y && cb === x));
}

export type TipoDeBloco = 'superset' | 'biset' | 'circuito';

interface ExercicioEmBloco {
  muscleGroup?: string | null;
  bloco?: number | null;
}

/**
 * Como este bloco se chama na tela.
 *
 * Dois exercícios do MESMO músculo é bi-set; de músculos diferentes é superset — antagonistas
 * ou não. Essa é a distinção que o profissional usa, e a que o aluno precisa ver: no bi-set a
 * carga do segundo exercício cai, e ele não deve achar que perdeu força.
 */
export function tipoDoBloco(
  exercicios: ExercicioEmBloco[],
  metodo: string | null | undefined,
): TipoDeBloco {
  if ((metodo ?? '').trim() === 'circuito') return 'circuito';
  if (exercicios.length !== 2) return 'superset';

  const a = grupoCanonico(exercicios[0]?.muscleGroup);
  const b = grupoCanonico(exercicios[1]?.muscleGroup);
  // Grupo desconhecido não vira bi-set por acidente: na dúvida, superset.
  if (!a || !b) return 'superset';
  return a === b ? 'biset' : 'superset';
}

/** O bi-set custa volume de carga; a tela precisa dizer isso antes de o aluno achar que piorou. */
export const AVISO_DO_BISET =
  'Os dois trabalham o mesmo músculo. É normal usar menos carga no segundo — não é perda de força.';

/**
 * Marca os blocos da sessão.
 *
 * Superset: pares de dois, na ordem em que a IA entregou. Número ímpar deixa o ÚLTIMO de fora,
 * sem bloco, e ele vira série tradicional. Melhor sobrar um exercício do que forçar um trio
 * que a técnica não prevê.
 *
 * Circuito: a sessão inteira é um bloco só. As estações são os exercícios do dia, cuja
 * quantidade já sai do nível e da duração (3 a 8), e as voltas são as séries do protocolo —
 * nenhum número novo foi inventado para o circuito.
 *
 * Devolve o mesmo array quando o método não tem bloco, para quem chama poder comparar por
 * identidade.
 */
export function montarBlocos<T extends ExercicioEmBloco>(
  exercicios: T[],
  metodo: string | null | undefined,
): T[] {
  if (!Array.isArray(exercicios)) return [];
  const m = (metodo ?? '').trim();

  if (m === 'circuito') {
    return exercicios.map(ex => ({ ...ex, bloco: 1 }));
  }

  if (m === 'superset') {
    const pares = Math.floor(exercicios.length / 2);
    return exercicios.map((ex, i) => {
      const indiceDoPar = Math.floor(i / 2);
      // O ímpar que sobra no fim não entra em bloco nenhum.
      if (indiceDoPar >= pares) return { ...ex, bloco: undefined };
      return { ...ex, bloco: indiceDoPar + 1 };
    });
  }

  return exercicios;
}

/**
 * Agrupa a sessão para a tela desenhar: cada item é um bloco, ou um exercício solto.
 *
 * Exercício sem `bloco` vira um grupo de um. Assim a tela percorre uma lista só, em vez de
 * decidir a cada item se desenha cartão ou bloco — e plano antigo, salvo antes de `bloco`
 * existir, cai naturalmente em grupos de um, sem migração.
 */
export function agruparEmBlocos<T extends ExercicioEmBloco>(exercicios: T[]): T[][] {
  if (!Array.isArray(exercicios)) return [];

  const grupos: T[][] = [];
  let atual: number | null = null;

  for (const ex of exercicios) {
    const bloco = typeof ex.bloco === 'number' ? ex.bloco : null;
    if (bloco !== null && bloco === atual) {
      grupos[grupos.length - 1].push(ex);
    } else {
      grupos.push([ex]);
      atual = bloco;
    }
  }
  return grupos;
}
