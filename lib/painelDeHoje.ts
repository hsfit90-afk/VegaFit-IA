/**
 * As contas de apresentação do painel "Hoje". Nenhuma decide prescrição.
 *
 * O QUE ESTE ARQUIVO É, E O QUE ELE NÃO É
 *
 * O redesenho de 31/10/2026 pediu três informações que a tela não tinha: a letra do treino
 * separada do nome, a faixa de sete dias da semana, e um resumo de carga e frequência. As três
 * saem de dados que o app JÁ carrega — `history` e o nome da sessão. Nada aqui vai ao banco,
 * nada aqui escolhe exercício, carga ou dia de treino.
 *
 * Mora em `lib/` e não dentro da tela por um motivo medido: o painel e o Progresso já
 * duplicaram a conta de dias seguidos em 29/10/2026, e duas cópias da mesma conta dão duas
 * respostas possíveis para a mesma pergunta. Ver `lib/sequenciaDeTreinos.ts`.
 *
 * O QUE DELIBERADAMENTE NÃO EXISTE AQUI
 *
 * **Dia de descanso.** O redesenho pedia quatro estados na semana, sendo um deles "descanso".
 * O app não guarda dia de descanso em lugar nenhum: `sessions` lista os treinos, não o
 * calendário. Um dia passado sem treino pode ser descanso prescrito ou falta — e chamá-lo de
 * "descanso" na tela do aluno seria o app inventando prescrição. Então o quarto estado é
 * `sem-treino`, que é o que o dado realmente diz.
 *
 * **Meta de peso.** Pedida junto com o peso atual, e também não existe: não há campo de meta
 * no perfil nem no banco. Mostrar uma meta que ninguém definiu é pior que não mostrar.
 */

const UM_DIA_MS = 86_400_000;

/** Só o que estas contas precisam de um treino do histórico. */
type TreinoFeito = {
  date: number;
  /** Carga total do treino, em kg·rep. Gravada por `app/active` ao finalizar. */
  totalVolume?: number;
};

/* -------------------------------------------------------------------------- */
/* A letra do treino                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Separa "Treino A - Peito e Tríceps" em letra e título.
 *
 * POR QUE PARSEAR EM VEZ DE USAR O ÍNDICE
 *
 * A letra já existe no nome. Tanto a IA (`app/api/treino/route.ts`, que pede o formato
 * "Treino A - Peito e Tríceps") quanto o plano montado à mão
 * (`app/api/admin/plano/route.ts:95`, que preenche `Treino ${letra}` quando o nome vem vazio)
 * produzem esse padrão. Usar o índice da sessão daria a letra ERRADA sempre que o aluno
 * estivesse vendo o segundo treino da rotação com o primeiro pulado por fadiga — a tela
 * mostraria "A" sobre o nome "Treino B".
 *
 * O índice entra só como reserva, para o plano cujo nome não segue o padrão.
 *
 * `titulo` vem `null` quando não sobra nada descritivo ("Treino A" seco). A tela omite o
 * título nesse caso em vez de repetir a letra ao lado dela.
 */
export function letraDaSessao(
  nome: string | null | undefined,
  indice: number,
): { letra: string; titulo: string | null } {
  const limpo = (nome ?? '').trim();

  // Aceita hífen, travessão, dois-pontos ou barra como separador — os quatro aparecem em
  // plano montado à mão.
  const comTitulo = limpo.match(/^treino\s+([a-z])\s*[-–—:/]\s*(.+)$/i);
  if (comTitulo) {
    return { letra: comTitulo[1].toUpperCase(), titulo: comTitulo[2].trim() };
  }

  const soLetra = limpo.match(/^treino\s+([a-z])$/i);
  if (soLetra) {
    return { letra: soLetra[1].toUpperCase(), titulo: null };
  }

  // Nome fora do padrão: a letra vem da posição na rotação, e o nome inteiro é o título.
  // Índice negativo ou absurdo não deve produzir um caractere estranho na tela.
  const posicao = Number.isFinite(indice) && indice >= 0 ? Math.floor(indice) % 26 : 0;
  return {
    letra: String.fromCharCode(65 + posicao),
    titulo: limpo || null,
  };
}

/* -------------------------------------------------------------------------- */
/* A semana                                                                   */
/* -------------------------------------------------------------------------- */

/** O estado de um dia na faixa da semana. */
export type EstadoDoDia = 'feito' | 'hoje' | 'futuro' | 'sem-treino';

export type DiaDaSemana = {
  /** A inicial que aparece no quadrado: S T Q Q S S D. */
  sigla: string;
  /** Dia do mês, para o rótulo acessível ("segunda, dia 27"). */
  diaDoMes: number;
  estado: EstadoDoDia;
  /** Verdadeiro quando houve treino nesse dia — inclusive hoje. */
  treinou: boolean;
};

/**
 * As iniciais, de segunda a domingo.
 *
 * A semana começa na SEGUNDA, não no domingo. É a convenção brasileira de calendário de
 * treino, e é a ordem que o redesenho pediu ("S T Q Q S S D"). O `Date.getDay()` do
 * JavaScript conta domingo como 0, então a conversão é explícita abaixo — é exatamente o tipo
 * de descuido que faz a faixa inteira aparecer deslocada em um dia.
 */
const SIGLAS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/**
 * Os sete dias da semana corrente, com o estado de cada um.
 *
 * Agrupa por DIA, ignorando a hora: dois treinos na mesma terça marcam a terça uma vez.
 *
 * Mesma ressalva de `lib/sequenciaDeTreinos.ts`: o passo entre dias é de 86.400.000 ms fixos,
 * então em fuso com horário de verão o dia da virada erraria por uma casa. O Brasil não tem
 * horário de verão desde 2019.
 */
export function semanaDoAluno(history: TreinoFeito[], agora: number): DiaDaSemana[] {
  const hoje = new Date(agora).setHours(0, 0, 0, 0);

  // getDay(): 0 = domingo ... 6 = sábado. Queremos 0 = segunda ... 6 = domingo.
  const diaDaSemana = new Date(hoje).getDay();
  const desdeSegunda = (diaDaSemana + 6) % 7;
  const segunda = hoje - desdeSegunda * UM_DIA_MS;

  const diasComTreino = new Set(
    history.map(h => new Date(h.date).setHours(0, 0, 0, 0)),
  );

  return SIGLAS.map((sigla, i) => {
    const dia = segunda + i * UM_DIA_MS;
    const treinou = diasComTreino.has(dia);

    const estado: EstadoDoDia =
      dia === hoje ? 'hoje'
      : dia > hoje ? 'futuro'
      : treinou ? 'feito'
      : 'sem-treino';

    return { sigla, diaDoMes: new Date(dia).getDate(), estado, treinou };
  });
}

/* -------------------------------------------------------------------------- */
/* O resumo                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A carga somada dos treinos desta semana, em kg·rep.
 *
 * Soma o `totalVolume` que `app/active` já gravou em cada treino. NÃO recalcula a partir das
 * séries: o cálculo de volume é do registro do treino, e refazê-lo aqui criaria uma segunda
 * resposta para "quanto o aluno levantou" — a mesma doença que a conta de dias seguidos teve.
 *
 * Treino sem `totalVolume` (registro antigo) conta como zero em vez de quebrar a soma.
 */
export function cargaDaSemana(history: TreinoFeito[], agora: number): number {
  const hoje = new Date(agora).setHours(0, 0, 0, 0);
  const desdeSegunda = (new Date(hoje).getDay() + 6) % 7;
  const segunda = hoje - desdeSegunda * UM_DIA_MS;
  const fim = segunda + 7 * UM_DIA_MS;

  return history.reduce((soma, h) => {
    const dia = new Date(h.date).setHours(0, 0, 0, 0);
    if (dia < segunda || dia >= fim) return soma;
    return soma + (Number.isFinite(h.totalVolume) ? h.totalVolume! : 0);
  }, 0);
}

/**
 * Quantos treinos neste mês, e a variação contra o mês passado.
 *
 * Mês de CALENDÁRIO, não "últimos 30 dias". É o que o aluno entende por "este mês", e é o que
 * permite comparar com o anterior sem explicar a janela.
 *
 * A variação é a diferença crua de treinos, não porcentagem: com 2 treinos no mês passado e 3
 * neste, "+50%" é verdadeiro e inútil; "+1" é o que a pessoa faz com a informação.
 *
 * No dia 1º do mês a comparação é desigual de propósito — um mês inteiro contra um dia. A tela
 * resolve isso escondendo a variação quando o mês tem menos de uma semana, porque o número
 * seria honesto e enganoso ao mesmo tempo.
 */
export function treinosNoMes(
  history: TreinoFeito[],
  agora: number,
): { esteMes: number; mesPassado: number; variacao: number; diasDeMes: number } {
  const ref = new Date(agora);
  const ano = ref.getFullYear();
  const mes = ref.getMonth();

  const inicioDeste = new Date(ano, mes, 1).getTime();
  const inicioDoPassado = new Date(ano, mes - 1, 1).getTime();

  let esteMes = 0;
  let mesPassado = 0;

  for (const h of history) {
    if (h.date >= inicioDeste) {
      // Registro com data no futuro (relógio do aparelho errado) não deve virar treino do
      // mês que vem: a conta é "deste mês para cá", e a tela só mostra o mês corrente.
      esteMes++;
    } else if (h.date >= inicioDoPassado) {
      mesPassado++;
    }
  }

  return {
    esteMes,
    mesPassado,
    variacao: esteMes - mesPassado,
    diasDeMes: ref.getDate(),
  };
}

/**
 * O peso corporal mais recente, em kg, ou `null` se o aluno nunca registrou.
 *
 * `null` e não zero: zero é um peso, e apareceria na tela como "0 kg". Ausência de registro
 * tira o bloco inteiro.
 *
 * NÃO existe meta — ver o cabeçalho deste arquivo.
 */
export function pesoAtual(
  historicoDePeso: { date: number; weight: number }[],
): number | null {
  if (!historicoDePeso.length) return null;

  let maisRecente = historicoDePeso[0];
  for (const e of historicoDePeso) {
    if (e.date > maisRecente.date) maisRecente = e;
  }

  return Number.isFinite(maisRecente.weight) && maisRecente.weight > 0
    ? maisRecente.weight
    : null;
}
