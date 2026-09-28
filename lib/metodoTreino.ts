// Descanso POR SÉRIE, em vez de um único valor por exercício.
//
// Sem isto, Drop Set e Rest-Pause eram só um nome na tela: o cronômetro disparava os mesmos
// 60 segundos depois de toda série, inclusive antes de um drop — e drop set é justamente NÃO
// descansar. O aluno que esperou seis meses para desbloquear a técnica recebia um treino
// tradicional com outra etiqueta.
//
// A decisão é tomada pelo RÓTULO da próxima série, não pelo método do plano. Dois motivos:
// um plano pode misturar séries normais e drops no mesmo exercício, e planos antigos, salvos
// antes desta regra existir, continuam funcionando sem nenhuma migração — eles simplesmente
// não têm rótulo especial e caem no descanso normal.

export const DESCANSO_DROP_SET = 0;
export const DESCANSO_REST_PAUSE = 15;

/** A próxima série é a continuação de um drop set? */
function ehDrop(rotulo: string): boolean {
  return /drop/i.test(rotulo);
}

/**
 * A próxima série é uma retomada de rest-pause?
 *
 * Aceita "RP", "RP1", "RP 2", "Rest-Pause" e "Rest Pause". Não aceita "S1" nem "Aquec" —
 * e, em especial, não pode casar com um rótulo qualquer que contenha as letras r e p, senão
 * uma série normal ganharia 15 segundos de descanso e o aluno treinaria exausto sem motivo.
 */
function ehRestPause(rotulo: string): boolean {
  return /^rp\s*\d*$/i.test(rotulo.trim()) || /rest[\s-]?pause/i.test(rotulo);
}

export interface EntradaDeDescanso {
  /** targetLabels do exercício, na ordem das séries. */
  rotulos?: string[] | null;
  /** Índice (base zero) da série que o aluno acabou de concluir. */
  indiceDaSerie: number;
  /** Descanso normal deste exercício, em segundos. */
  descansoPadrao: number;
}

/**
 * Quantos segundos descansar depois da série que acabou de ser concluída.
 *
 * Olha o rótulo da série SEGUINTE: é ela que define se o que vem é continuação da mesma
 * técnica (sem descanso, ou com micro-descanso) ou uma série nova de verdade.
 */
export function descansoAposSerie(e: EntradaDeDescanso): number {
  const proximo = e.rotulos?.[e.indiceDaSerie + 1];

  // Última série do exercício: descanso normal antes do próximo exercício.
  if (!proximo) return e.descansoPadrao;

  if (ehDrop(proximo)) return DESCANSO_DROP_SET;
  if (ehRestPause(proximo)) return DESCANSO_REST_PAUSE;
  return e.descansoPadrao;
}

/**
 * Texto curto para a tela explicar por que o descanso encurtou ou sumiu.
 *
 * Cronômetro que não aparece, sem explicação, parece bug — o aluno fica olhando a tela
 * esperando. Uma linha resolve e ainda ensina a técnica.
 */
export function avisoDoProximoPasso(e: EntradaDeDescanso): string | null {
  const proximo = e.rotulos?.[e.indiceDaSerie + 1];
  if (!proximo) return null;
  if (ehDrop(proximo)) return 'Sem descanso: reduza a carga em 20% e vá direto para a próxima.';
  if (ehRestPause(proximo)) return 'Respire 15 segundos e faça mais repetições com a mesma carga.';
  return null;
}

/**
 * Limpa os arrays por série que vieram da IA.
 *
 * Medido em 27/09/2026: pedindo uma pirâmide, o modelo devolveu
 * `targetWeights: ["Carga Moderada", "Carga Pesada", "Carga Máxima"]` — texto onde o tipo
 * declara `number[]`. A tela faz `ex.targetWeights?.[i] || 0`, e string é truthy: o campo de
 * carga do aluno receberia "Carga Moderada" e a conta de volume iria junto.
 *
 * O modelo não errou por acaso — ele não tem como saber quantos quilos o aluno levanta. Por
 * isso o prompt parou de pedir carga, e a app calcula a partir do 1RM real do histórico. Esta
 * função é a rede embaixo: qualquer valor não numérico é descartado, para qualquer método.
 */
export function limparAlvosPorSerie<T extends {
  sets?: number;
  targetReps?: unknown;
  targetWeights?: unknown;
  targetLabels?: unknown;
}>(exercicio: T): T {
  const limpo: T = { ...exercicio };

  const numeros = (v: unknown): number[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    const n = v.map(x => Number(x)).filter(x => Number.isFinite(x) && x >= 0);
    return n.length === v.length && n.length > 0 ? n : undefined;
  };

  const textos = (v: unknown): string[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    const t = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    return t.length === v.length && t.length > 0 ? t : undefined;
  };

  limpo.targetReps = numeros(exercicio.targetReps);
  limpo.targetWeights = numeros(exercicio.targetWeights);
  limpo.targetLabels = textos(exercicio.targetLabels);

  // Array de tamanho diferente de "sets" desalinha rótulo e série: a série 3 mostraria o
  // rótulo da 2, e no drop set isso significa descansar na hora errada. Melhor não ter.
  const n = exercicio.sets;
  if (typeof n === 'number' && n > 0) {
    if (limpo.targetReps && (limpo.targetReps as number[]).length !== n) limpo.targetReps = undefined;
    if (limpo.targetWeights && (limpo.targetWeights as number[]).length !== n) limpo.targetWeights = undefined;
    if (limpo.targetLabels && (limpo.targetLabels as string[]).length !== n) limpo.targetLabels = undefined;
  }

  return limpo;
}
