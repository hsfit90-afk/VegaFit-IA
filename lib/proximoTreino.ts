// QUAL TREINO O ALUNO ABRE HOJE — e por que isto saiu de dentro do dashboard.
//
// Esta regra decide a prescrição: qual dia do plano a pessoa vai executar, e quando o app
// DESVIA para outro dia porque o músculo treinado ontem ainda não recuperou. Ela morava
// inteira dentro de app/page.tsx, como três `useMemo` de uns cinquenta linhas, sem teste.
//
// O QUE ISSO IMPEDIA
//
// Qualquer outra tela que precisasse dizer "o próximo treino dele é o Treino A" teria que
// reimplementar o cálculo — e duas implementações divergem na primeira correção que alguém
// faz num lado só. Este projeto já pagou esse preço três vezes: o filtro de equipamento na
// troca de exercício (desligado seis dias sem ninguém saber), a escolha do abdominal, e o
// sorteio da mobilidade entre a prévia e o servidor.
//
// A prévia do profissional precisa mostrar o MESMO dia que o aluno vai abrir. Mostrar outro
// seria pior que não mostrar nada, porque ele entregaria confiando.
//
// O QUE NÃO MUDOU
//
// Nada. Este módulo é uma extração literal do que o dashboard já fazia, incluindo um
// comportamento de borda que os testes documentam em vez de corrigir — ver
// `desviadoPorFadiga`. Corrigir aqui mudaria a tela que todo aluno abre, e isso é decisão
// do profissional, não efeito colateral de uma refatoração.

/** Quantas horas um grupo muscular fica "em recuperação" depois de ser treinado. */
export const HORAS_DE_FADIGA = 24;

const HORA_MS = 60 * 60 * 1000;

export interface ExercicioDoHistorico {
  muscleGroup?: string | null;
}

export interface TreinoFeito {
  /** Epoch em ms, como o AppContext entrega. */
  date: number;
  exercises: ExercicioDoHistorico[];
}

export interface SessaoDoPlano {
  name?: string;
  exercises?: ExercicioDoHistorico[];
}

/**
 * Os grupos musculares treinados nas últimas 24 horas, em minúsculas.
 *
 * Minúsculas porque o catálogo grava "Peito", "peito" e "PEITO" conforme a época do cadastro,
 * e um Set que distingue os três não detecta fadiga nenhuma.
 */
export function musculosEmFadiga(
  historico: TreinoFeito[],
  agora: number = Date.now()
): Set<string> {
  const fatigados = new Set<string>();
  for (const treino of historico ?? []) {
    const horas = (agora - treino.date) / HORA_MS;
    if (horas >= HORAS_DE_FADIGA) continue;
    for (const ex of treino.exercises ?? []) {
      if (ex.muscleGroup) fatigados.add(ex.muscleGroup.toLowerCase());
    }
  }
  return fatigados;
}

/** Esta sessão usa algum músculo que ainda está em recuperação? */
function temFadiga(sessao: SessaoDoPlano | undefined, fadiga: Set<string>): boolean {
  return (sessao?.exercises ?? []).some(ex =>
    fadiga.has((ex.muscleGroup || '').toLowerCase())
  );
}

export interface EscolhaDeSessao {
  /** O índice que a tela deve abrir. */
  indice: number;
  /** Onde o rodízio A-B-C estaria, sem considerar fadiga. */
  indiceDoCiclo: number;
  /** O app pulou o dia do rodízio porque o músculo não recuperou. */
  desviadoPorFadiga: boolean;
}

/**
 * A sessão que o aluno vai receber hoje.
 *
 * Procura, a partir do dia do rodízio, o primeiro que não usa músculo em recuperação. Se
 * TODOS usarem — semana cheia, treino diário —, devolve o dia do rodízio mesmo assim: um app
 * que se recusa a sugerir treino é pior que um que sugere com ressalva.
 *
 * SOBRE `desviadoPorFadiga` E UM COMPORTAMENTO DE BORDA
 *
 * A comparação é entre o índice escolhido e o do rodízio, crus. Quando `indiceDoCiclo` é
 * maior que o número de sessões — acontece se o aluno trocou para um plano com menos dias —,
 * o laço devolve o índice já normalizado e os dois números diferem mesmo apontando para a
 * MESMA sessão. A tela mostra "Fadiga Detectada" sem fadiga nenhuma.
 *
 * Isso é o que o dashboard faz desde sempre, e está preservado de propósito: esta extração
 * não pode mudar o que o aluno vê. Está documentado em teste para quem for corrigir depois
 * saber que é decisão, não descuido.
 */
export function escolherSessao(
  sessoes: SessaoDoPlano[] | null | undefined,
  indiceDoCiclo: number,
  fadiga: Set<string>
): EscolhaDeSessao {
  const total = sessoes?.length ?? 0;
  const semDesvio = { indice: indiceDoCiclo, indiceDoCiclo, desviadoPorFadiga: false };

  if (total === 0 || fadiga.size === 0) return semDesvio;

  for (let i = 0; i < total; i++) {
    const idx = (indiceDoCiclo + i) % total;
    if (!temFadiga(sessoes![idx], fadiga)) {
      return { indice: idx, indiceDoCiclo, desviadoPorFadiga: idx !== indiceDoCiclo };
    }
  }

  // Todos os dias têm músculo em recuperação.
  return semDesvio;
}

/**
 * O dia DEPOIS do escolhido, também pulando os que estão em recuperação.
 *
 * Alimenta o "Ver Próximo Treino": o aluno que não quer fazer o sugerido precisa de uma
 * alternativa que também faça sentido, não simplesmente do próximo da fila.
 */
export function sessaoSeguinte(
  sessoes: SessaoDoPlano[] | null | undefined,
  indiceAtual: number,
  fadiga: Set<string>
): number {
  const total = sessoes?.length ?? 0;
  if (total === 0) return indiceAtual + 1;

  for (let i = 1; i <= total; i++) {
    const idx = (indiceAtual + i) % total;
    if (!temFadiga(sessoes![idx], fadiga)) return idx;
  }
  return (indiceAtual + 1) % total;
}

/**
 * Minutos estimados da sessão.
 *
 * Cinco minutos por exercício, que é a conta que o dashboard mostra ao aluno desde sempre.
 * Fica aqui para a prévia do profissional mostrar o MESMO número — ele precisa saber o que a
 * pessoa lê na tela dela, não uma estimativa própria.
 */
export const MINUTOS_POR_EXERCICIO = 5;

export function minutosDaSessao(sessao: SessaoDoPlano | undefined | null): number {
  return (sessao?.exercises?.length ?? 0) * MINUTOS_POR_EXERCICIO;
}
