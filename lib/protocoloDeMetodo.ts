import { ehSerieEspecial, ehRetomadaDeRestPause } from './metodoTreino';

/**
 * O protocolo de cada método de treino, fixado em código.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 *
 * Em 28/09/2026 ficou decidido fixar os protocolos aqui e deixar para a IA só o que é decisão
 * dela — quais exercícios escolher e o texto da dica. Os números nunca foram definidos, então
 * a decisão ficou no papel e o prompt seguiu sendo a única regra. Mesmo motivo registrado em
 * lib/exerciseLevel.ts e lib/equipmentTier.ts: enforcement só por prompt falha.
 *
 * Os números vieram da revisão de evidência que o profissional levantou em 22/10/2026 ("Guia
 * de Aplicação dos Métodos de Treino no App"). O achado que atravessa tudo: com volume
 * equivalente, NENHUM dos seis métodos mostrou superioridade consistente sobre o tradicional
 * para hipertrofia ou força. Eles se justificam por tempo, fadiga e objetivo — nunca por
 * prometer mais músculo. Qualquer texto novo de tela que contrarie isso está errado.
 *
 * O QUE AINDA NÃO ESTÁ AQUI
 *
 * Pareamento do superset e estrutura do circuito dependem de um campo que o dado ainda não
 * tem: nada no plano diz qual exercício faz par com qual. Entram quando esse campo existir.
 */

/**
 * Os métodos que o teto limita.
 *
 * Pirâmide fica de fora de propósito: ela muda carga e repetição ao longo das séries, mas não
 * leva o aluno à falha repetida como drop set e rest-pause. A revisão trata os dois como
 * "intensificação" e pede teto só para eles.
 */
export const METODOS_INTENSIFICADOS = ['drop_set', 'rest_pause'] as const;

/**
 * Quantos exercícios por GRUPO MUSCULAR do dia podem levar a técnica.
 *
 * Decisão do profissional (22/10/2026), dentro do que a evidência pede: "limitar a poucos
 * exercícios por sessão", porque drop set e rest-pause elevam esforço percebido, lactato e
 * fadiga neuromuscular. O teto por GRUPO, e não por sessão, escala com o tamanho do treino —
 * um dia de três grupos pode ter três, um dia de um grupo tem um.
 *
 * A medição de 27/09/2026 que motivou isto: a IA aplicou drop set em 21 de 21 exercícios.
 */
export const TETO_INTENSIFICADO_POR_GRUPO = 1;

/** Quantas quedas de carga um drop set pede. Revisão: 1 ou 2. */
export const QUEDAS_DO_DROP = { minimo: 1, maximo: 2 } as const;

/**
 * Quanto a carga cai a cada queda, em fração do que vinha antes.
 *
 * A revisão diz 20 a 25%. O código já usava 20% (FATOR_DO_DROP = 0.8 em lib/metodoTreino.ts),
 * que está dentro da faixa — por isso não foi mexido. Fica registrado aqui o teto.
 */
export const QUEDA_MAXIMA_DO_DROP = 0.25;

/** Quantas retomadas um rest-pause pede depois da série de trabalho. Revisão: 1 ou 2. */
export const RETOMADAS_DO_REST_PAUSE = { minimo: 1, maximo: 2 } as const;

/**
 * Quantas SÉRIES este exercício somou ao volume semanal do músculo.
 *
 * As retomadas do rest-pause não contam: são continuação da mesma série, com o aluno sem
 * largar o peso. A revisão de 22/10/2026 pede somar as repetições dos mini-blocos como uma
 * série só — e era o que o app não fazia: um exercício com "S1 · RP1 · RP2" aparecia como 3
 * séries no gráfico de volume, inflando a semana de quem treina rest-pause.
 *
 * O drop set conta tudo, de propósito: cada queda é uma série de trabalho com carga menor, e
 * a própria revisão pede que entre no volume como qualquer outra.
 *
 * Isto conta SÉRIES. Repetição e tonelagem continuam somando os mini-blocos, que é o que a
 * revisão pede — são duas perguntas diferentes sobre o mesmo treino.
 */
export function contarSeriesNoVolume(
  series: { label?: string; completed?: boolean }[] | null | undefined,
): number {
  if (!Array.isArray(series)) return 0;
  return series.filter(s => s?.completed && !ehRetomadaDeRestPause(s.label)).length;
}

export function ehMetodoIntensificado(metodo: string | null | undefined): boolean {
  return (METODOS_INTENSIFICADOS as readonly string[]).includes((metodo ?? '').trim());
}

/**
 * Rótulos de série sem técnica nenhuma: "S1", "S2", "S3"...
 *
 * É este o formato que o resto do app lê como série comum — lib/metodoTreino.ts decide
 * descanso e carga pelo rótulo, então trocar o rótulo É remover a técnica, sem precisar mexer
 * em mais nada do exercício.
 */
export function rotulosNeutros(quantidade: number): string[] {
  if (!Number.isFinite(quantidade) || quantidade <= 0) return [];
  return Array.from({ length: Math.floor(quantidade) }, (_, i) => `S${i + 1}`);
}

interface ExercicioComRotulos {
  muscleGroup?: string | null;
  targetLabels?: string[] | null;
}

/** O exercício carrega drop set ou rest-pause em alguma série? */
function temTecnica(ex: ExercicioComRotulos): boolean {
  return Array.isArray(ex.targetLabels) && ex.targetLabels.some(r => ehSerieEspecial(r));
}

/** Chave de agrupamento. Grupo ausente ou vazio vira um grupo só, e não um grupo por exercício. */
function chaveDoGrupo(ex: ExercicioComRotulos): string {
  return (ex.muscleGroup ?? '').trim().toLowerCase();
}

/**
 * Quais exercícios da sessão têm direito de MANTER a técnica.
 *
 * Devolve os índices, no máximo TETO_INTENSIFICADO_POR_GRUPO por grupo muscular.
 *
 * ESCOLHE ENTRE OS QUE JÁ TÊM A TÉCNICA, não o último exercício do grupo em absoluto. A
 * diferença importa: se a IA marcou só o primeiro exercício de Peito, mirar no último deixaria
 * a sessão inteira sem técnica nenhuma — o aluno que escolheu Drop Set receberia um treino
 * tradicional, que é exatamente o defeito que estas regras existem para evitar.
 *
 * Dentro do grupo, mantém os ÚLTIMOS: terminar o grupo com a série mais dura é a prática
 * usual, e a revisão pede a técnica na última série do exercício pelo mesmo motivo.
 */
export function indicesQueMantemTecnica(exercicios: ExercicioComRotulos[]): number[] {
  if (!Array.isArray(exercicios)) return [];

  const porGrupo = new Map<string, number[]>();
  exercicios.forEach((ex, i) => {
    if (!temTecnica(ex)) return;
    const chave = chaveDoGrupo(ex);
    const lista = porGrupo.get(chave);
    if (lista) lista.push(i);
    else porGrupo.set(chave, [i]);
  });

  const mantidos: number[] = [];
  for (const indices of porGrupo.values()) {
    mantidos.push(...indices.slice(-TETO_INTENSIFICADO_POR_GRUPO));
  }
  return mantidos.sort((a, b) => a - b);
}

/**
 * Aplica o teto: tira a técnica de todo exercício que passou do limite do grupo dele.
 *
 * Devolve um array novo; os exercícios que não mudam voltam pelo mesmo objeto, para quem
 * chamar poder comparar por identidade.
 *
 * Só mexe em `targetLabels`. Carga e descanso do drop saem da leitura do rótulo em
 * lib/metodoTreino.ts, então rótulo neutro já desliga os dois — não existe segundo lugar para
 * esquecer de limpar.
 */
export function aplicarTetoDeIntensificacao<T extends ExercicioComRotulos>(
  exercicios: T[],
  metodo: string | null | undefined,
): T[] {
  if (!Array.isArray(exercicios)) return [];
  if (!ehMetodoIntensificado(metodo)) return exercicios;

  const mantidos = new Set(indicesQueMantemTecnica(exercicios));

  return exercicios.map((ex, i) => {
    if (mantidos.has(i) || !temTecnica(ex)) return ex;
    return { ...ex, targetLabels: rotulosNeutros(ex.targetLabels!.length) };
  });
}
