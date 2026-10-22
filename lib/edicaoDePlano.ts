// O QUE ESTE MÓDULO IMPEDE
//
// Achado em 19/10/2026, lendo o montador para construir a tela de edição: abrir um plano
// gerado pela IA, mexer em UM exercício e salvar apagava, de TODOS os exercícios do plano:
//
//   - targetWeights, targetReps, targetLabels — a carga e as repetições alvo por série;
//   - method — o texto da periodização ("Semana 1: 3 séries. ... Semana 4: Deload").
//
// A causa não era a rota. `normalizarSessoes` já repassava os três primeiros; o `method` ela
// perdia. O que faltava era o editor: o `ExercicioLinha` do montador só tem oito campos, e o
// que não está no formulário não volta no salvamento. Quem edita manda a sessão INTEIRA de
// volta, então um campo ausente não é "não mudou" — é "apaga".
//
// POR QUE A CORREÇÃO NÃO É "ADICIONAR OS CAMPOS AO FORMULÁRIO"
//
// Adicionar resolve estes quatro e deixa a armadilha armada para o quinto. Qualquer campo novo
// em WorkoutExercise volta a ser apagado silenciosamente pelo editor, e ninguém percebe —
// porque o treino continua abrindo, só mais pobre do que era. A correção é inverter o padrão:
// o editor declara o que EDITA, e tudo o mais é preservado a partir do que estava salvo.
//
// POR QUE AQUI, E NÃO DENTRO DA ROTA
//
// Mesmo motivo de lib/periodization.ts e lib/subscription.ts: a mesma mesclagem precisa valer
// no servidor (ao salvar) e na tela (ao mostrar o que vai ser salvo), e duas implementações
// divergem no primeiro caso de borda que alguém ajustar de um lado só.

/** O que o formulário de edição realmente mexe. O resto vem do plano salvo. */
export const CAMPOS_EDITAVEIS = [
  'exerciseId',
  'name',
  'muscleGroup',
  'sets',
  'reps',
  'restSeconds',
  'tips',
  'targetWeights',
] as const;

/**
 * Campos que o editor NÃO mexe e que precisam sobreviver ao salvamento.
 *
 * `targetWeights` não está aqui de propósito: desde 19/10/2026 a carga sugerida é editável no
 * montador, então ela é dado do formulário, não dado preservado. Se um dia sair da tela, ela
 * volta para esta lista.
 */
export const CAMPOS_PRESERVADOS = ['method', 'targetReps', 'targetLabels', 'youtubeSearchTerm', 'bloco'] as const;

export interface ExercicioComChave {
  id?: string;
  exerciseId?: string;
  name?: string;
}

export interface SessaoComExercicios<T = unknown> {
  id?: string;
  name?: string;
  exercises?: T[];
}

/**
 * Como reencontrar, no plano salvo, o exercício que está sendo editado.
 *
 * Ordem deliberada. O `id` é a instância dentro do plano e é o único identificador exato — o
 * mesmo exercício pode aparecer duas vezes no mesmo dia com séries diferentes, e só o id
 * distingue um do outro. Sem ele, `exerciseId` acerta o exercício mas não a instância. O nome
 * é o último recurso, porque plano antigo foi salvo antes de o id existir, e modelo de sessão
 * guarda nome e não id (ver database/38_modelos_de_sessao.sql).
 *
 * O prefixo evita a colisão que um identificador só não evitaria: um exercício cujo NOME é,
 * por acaso, o uuid de outro.
 */
export function chaveDoExercicio(ex: ExercicioComChave | null | undefined): string | null {
  if (!ex) return null;
  const id = typeof ex.id === 'string' ? ex.id.trim() : '';
  if (id) return 'id:' + id;
  const exerciseId = typeof ex.exerciseId === 'string' ? ex.exerciseId.trim() : '';
  if (exerciseId) return 'ex:' + exerciseId;
  const nome = typeof ex.name === 'string' ? ex.name.trim().toLowerCase() : '';
  return nome ? 'nome:' + nome : null;
}

/** A mesma ideia para o dia de treino. */
export function chaveDaSessao(s: SessaoComExercicios | null | undefined): string | null {
  if (!s) return null;
  const id = typeof s.id === 'string' ? s.id.trim() : '';
  if (id) return 'id:' + id;
  const nome = typeof s.name === 'string' ? s.name.trim().toLowerCase() : '';
  return nome ? 'nome:' + nome : null;
}

/**
 * Indexa os exercícios do plano salvo por chave, para a mesclagem achar o original em O(1).
 *
 * O índice é do PLANO INTEIRO e não de cada dia: o profissional pode mover um exercício do
 * Treino A para o B, e nesse caso o original continua existindo — só mudou de lugar. Procurar
 * apenas dentro do mesmo dia trataria isso como exercício novo e apagaria a periodização dele.
 *
 * Em caso de chave repetida, a PRIMEIRA ocorrência ganha. Repetição só acontece quando a chave
 * caiu para nome ou exerciseId (plano antigo, sem id), e aí não existe resposta certa — a
 * primeira é estável, que é o que importa para não variar entre dois salvamentos iguais.
 */
export function indexarExercicios<T extends ExercicioComChave>(
  sessoes: SessaoComExercicios<T>[] | null | undefined
): Map<string, T> {
  const indice = new Map<string, T>();
  for (const sessao of sessoes ?? []) {
    for (const ex of sessao?.exercises ?? []) {
      const chave = chaveDoExercicio(ex);
      if (chave && !indice.has(chave)) indice.set(chave, ex);
    }
  }
  return indice;
}

/**
 * Devolve o exercício editado com os campos preservados do original colados de volta.
 *
 * Exercício que não existia no plano salvo (foi adicionado agora) sai como veio: não há nada a
 * preservar, e inventar `method` para ele seria pior que não ter.
 *
 * Um valor preservado só é copiado quando o editado NÃO tem aquele campo. Assim a mesclagem
 * nunca sobrescreve o que a tela mandou de propósito — inclusive quando a tela manda `null`
 * para dizer "apaga isto".
 */
export function mesclarPreservados<T extends ExercicioComChave>(
  editado: T,
  original: ExercicioComChave | undefined
): T {
  if (!original) return editado;

  // Monta o que falta num objeto simples e espalha no fim. Escrever direto no resultado
  // tipado como T exigiria indexar um genérico para ESCRITA, que o TypeScript recusa
  // (TS2862) — ler, ele permite.
  const doEditado = editado as T & Record<string, unknown>;
  const doOriginal = original as ExercicioComChave & Record<string, unknown>;

  const preservados: Record<string, unknown> = {};
  for (const campo of CAMPOS_PRESERVADOS) {
    if (doEditado[campo] !== undefined) continue;
    const vindo = doOriginal[campo];
    if (vindo !== undefined) preservados[campo] = vindo;
  }

  return { ...editado, ...preservados } as T;
}

/**
 * A mesclagem do plano inteiro: o que a tela mandou, mais o que ela não sabia que existia.
 *
 * Chamada pelo servidor ANTES de normalizar, para que `limparAlvosPorSerie` ainda tenha a
 * palavra final sobre alvo por série desalinhado — ver lib/metodoTreino.ts. A ordem importa:
 * mesclar depois de limpar reintroduziria exatamente o desalinhamento que a limpeza tirou.
 */
export function mesclarSessoesEditadas<T extends ExercicioComChave>(
  editadas: SessaoComExercicios<T>[],
  armazenadas: SessaoComExercicios<ExercicioComChave>[] | null | undefined
): SessaoComExercicios<T>[] {
  const indice = indexarExercicios(armazenadas);
  if (indice.size === 0) return editadas;

  return editadas.map(sessao => ({
    ...sessao,
    exercises: (sessao?.exercises ?? []).map(ex => {
      const chave = chaveDoExercicio(ex);
      return mesclarPreservados(ex, chave ? indice.get(chave) : undefined);
    }),
  }));
}

/**
 * Move um item de posição, sem mutar a lista original.
 *
 * Genérica porque reordenar exercício dentro do dia e reordenar o dia dentro do plano são a
 * mesma operação, e duas cópias divergiriam no primeiro ajuste de borda.
 *
 * Índice fora da lista devolve a lista como estava, em vez de lançar: isto é chamado por
 * clique de botão, e um "subir" no primeiro item não é erro — é um não-evento.
 */
export function moverNaLista<T>(lista: readonly T[], de: number, para: number): T[] {
  const copia = [...lista];
  if (!Number.isInteger(de) || !Number.isInteger(para)) return copia;
  if (de < 0 || de >= copia.length) return copia;
  if (para < 0 || para >= copia.length) return copia;
  if (de === para) return copia;
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}

/**
 * Ajusta a carga sugerida quando o número de séries muda.
 *
 * `limparAlvosPorSerie` DESCARTA o array inteiro quando o tamanho não bate com `sets`, e está
 * certo: rótulo desalinhado faz o aluno descansar na hora errada no drop set. Só que descartar
 * é a resposta errada para quem acabou de subir de 3 para 4 séries no montador — ele perderia
 * a carga que acabou de digitar por ter mexido num campo vizinho.
 *
 * Então aqui o array ACOMPANHA: encurta cortando o fim, e cresce repetindo a última carga. A
 * série nova nascer com a carga da anterior é a prescrição conservadora e é o que o
 * profissional ajustaria de qualquer forma; nascer com zero seria a tela sugerindo barra vazia.
 */
export function ajustarCargas(
  cargas: readonly number[] | null | undefined,
  sets: number
): number[] | undefined {
  const n = Math.floor(sets);
  if (!Number.isFinite(n) || n <= 0) return undefined;

  const validas = (cargas ?? []).filter(c => Number.isFinite(c) && c >= 0);
  if (validas.length === 0) return undefined;
  if (validas.length === n) return [...validas];
  if (validas.length > n) return validas.slice(0, n);

  const ultima = validas[validas.length - 1];
  return [...validas, ...Array(n - validas.length).fill(ultima)];
}

/**
 * Repete uma carga em todas as séries.
 *
 * Existe porque digitar o mesmo número quatro vezes é o caso comum: o profissional prescreve
 * "20 kg nas quatro", e a progressão por série é exceção, não regra.
 *
 * Carga zero devolve undefined, não [0,0,0]: zero não é prescrição, é campo em branco — e um
 * array de zeros faria a tela do aluno mostrar "0 kg" como se alguém tivesse decidido isso.
 */
export function aplicarCargaEmTodas(valor: number, sets: number): number[] | undefined {
  const n = Math.floor(sets);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (!Number.isFinite(valor) || valor <= 0) return undefined;
  return Array(n).fill(valor);
}
