// Mobilidade, alongamento e aeróbico: o que vem ANTES, DEPOIS e QUANDO O ALUNO QUISER.
//
// A prescrição, definida pelo profissional (CREF) em 08/10/2026 e refinada em 11/10/2026:
//
//   MOBILIDADE    antes do treino, nas ARTICULAÇÕES que a sessão vai usar. Mobilidade de
//                 quadril e tornozelo no dia de perna, de ombro no dia de empurrar. A tela
//                 abre com essa sugestão em vez da lista inteira.
//   ALONGAMENTO   SOLTO, e de propósito. Chegou a ter sugestão pré-treino amarrada aos
//                 grupos do dia (11/10/2026); saiu no mesmo dia, por decisão do profissional:
//                 a pessoa alonga o que quiser, quando quiser, e amarrar ao treino de força
//                 transformava uma escolha livre em tarefa. É a única das quatro sem hora
//                 marcada, e a tela existe separada justamente por isso.
//   AERÓBICO      sempre DEPOIS da força, e a tela diz isso. Fazer antes compromete a carga
//                 do treino principal, que é o que o aluno veio buscar.
//
// Por que isso não custa IA: os blocos são montados por regra, lendo os grupos musculares que
// a sessão já tem. Nada disso vai ao prompt.

import { MUSCLE_ALIASES } from './exerciseType';

export type TipoDeExercicio = 'alongamento' | 'mobilidade' | 'cardio' | 'forca';

/**
 * Só alongamento. Separado da mobilidade porque o destino é outro: alongamento vai para a
 * tela livre, mobilidade entra no aquecimento da sessão.
 */
const ALONGAMENTO = [
  'alongamento',
  'postura de', 'postura do', 'postura da',
  'abraços nos joelhos', 'abraco nos joelhos',
  'toque lateral dos dedos', 'toque nos dedos', 'toques de dedos',
  'levantamento de braço apoiado na parede', 'levantamento de braco apoiado na parede',
];

/**
 * Mobilidade e liberação: movimento articular sem carga, para aquecer.
 *
 * "rotação externa/interna do ombro" NÃO entra: com cabo ou halter, é exercício de força do
 * manguito rotador, e o catálogo tem os dois. Quem decide é o RESISTENCIA abaixo, que roda
 * antes — mesma proteção que lib/exerciseType.ts já usava.
 */
const MOBILIDADE = [
  'mobilidade',
  'rolo de espuma', 'rolamento de espuma', 'rolagem de espuma',
  'pêndulo', 'pendulo',
  'dorsiflexão', 'dorsiflexao',
  'catavento',
  'joelho alternado',
  'bailarina',
  'inclinação lateral', 'inclinacao lateral',
  'rotação da coluna', 'rotacao da coluna',
  'rotação de pé e tornozelo', 'rotacao de pe e tornozelo',
  'rotação do corpo superior', 'rotacao do corpo superior',
  'rotação espinhal', 'rotacao espinhal',
  'rotação para trás de joelhos', 'rotacao para tras de joelhos',
  'círculos com', 'circulos com',
];

/** Com carga ou resistência, é exercício de força — mesmo citando uma articulação em rotação. */
const RESISTENCIA = ['cabo', 'faixa elástica', 'faixa elastica', 'haltere', 'halteres', 'máquina', 'maquina', 'polia'];

export function classificarTipo(nome: string, grupoMuscular?: string | null): TipoDeExercicio {
  if ((grupoMuscular || '').toLowerCase() === 'cardio') return 'cardio';

  const n = nome.toLowerCase();
  if (RESISTENCIA.some(p => n.includes(p))) return 'forca';
  if (ALONGAMENTO.some(p => n.includes(p))) return 'alongamento';
  if (MOBILIDADE.some(p => n.includes(p))) return 'mobilidade';
  return 'forca';
}

export interface ExercicioSimples {
  id?: string;
  name: string;
  muscle_group?: string | null;
}

/**
 * Que articulação cada grupo muscular move.
 *
 * O aluno não pensa em "mobilizar o grupo peito" — ele pensa em soltar o ombro. A tela de
 * mobilidade precisa dizer QUAL ARTICULAÇÃO vai ser usada no treino de hoje, e o catálogo só
 * guarda grupo muscular; a ponte entre os dois é esta.
 *
 * O mapa é anatômico, não exaustivo: lista a articulação que de fato limita o movimento
 * daquele grupo, não toda articulação que participa de alguma forma. Agachamento envolve o
 * ombro para segurar a barra, mas quem trava um agachamento é tornozelo, joelho e quadril.
 */
/**
 * `canonicos` é a segunda tentativa, para o nome CURTO.
 *
 * A sessão gerada traz "Perna"; o catálogo traz "Pernas (quadríceps)". O casamento por
 * substring resolve o longo e falha no curto — "perna" não contém "quadriceps". Quando o
 * direto falha, o nome passa por MUSCLE_ALIASES (que já sabe que perna, quadríceps, coxa e
 * posterior de coxa são a mesma família) e tenta de novo por aqui.
 *
 * Só `quadriceps` reivindica o canônico 'perna': se `posterior` também reivindicasse, um dia
 * de "Perna" somaria as duas entradas e o resultado seria idêntico ao de quadriceps, com o
 * trabalho de somar. O nome longo "Posterior de coxa" continua casando direto e mantendo a
 * precisão de não incluir tornozelo.
 */
const ARTICULACOES_POR_GRUPO: { grupo: string; canonicos?: string[]; articulacoes: string[] }[] = [
  { grupo: 'peito',      canonicos: ['peito'],       articulacoes: ['Ombro'] },
  { grupo: 'costas',     canonicos: ['costas'],      articulacoes: ['Ombro', 'Coluna torácica'] },
  { grupo: 'ombro',      canonicos: ['ombro'],       articulacoes: ['Ombro'] },
  { grupo: 'biceps',     canonicos: ['biceps'],      articulacoes: ['Cotovelo'] },
  { grupo: 'triceps',    canonicos: ['triceps'],     articulacoes: ['Cotovelo', 'Ombro'] },
  // Antebraço fica de FORA, e é decisão: o que ele carrega é o punho, e punho não está neste
  // mapa. Responder "Cotovelo" seria meia-verdade anatômica, que num produto de CREF é pior
  // que não responder. O teste de 'ignora grupo desconhecido' guarda isto.
  { grupo: 'quadriceps', canonicos: ['perna'],       articulacoes: ['Quadril', 'Joelho', 'Tornozelo'] },
  { grupo: 'posterior',  articulacoes: ['Quadril', 'Joelho'] },
  { grupo: 'gluteos',    canonicos: ['gluteo'],      articulacoes: ['Quadril'] },
  { grupo: 'panturrilha', canonicos: ['panturrilha'], articulacoes: ['Tornozelo'] },
  { grupo: 'core',       canonicos: ['core'],        articulacoes: ['Coluna lombar'] },
  { grupo: 'lombar',     canonicos: ['lombar'],      articulacoes: ['Quadril', 'Coluna lombar'] },
];

/** Tira acento e caixa: o catálogo tem "Pernas (quadríceps)", "PERNAS (QUADRÍCEPS)" e "Perna". */
function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * As articulações que a sessão de hoje vai exigir, sem repetição.
 *
 * Grupo que não casa com nada é ignorado em silêncio — é melhor mostrar três articulações
 * certas do que quatro com uma inventada.
 */
export function articulacoesDosGrupos(grupos: string[]): string[] {
  const achadas: string[] = [];
  for (const g of grupos) {
    for (const a of articulacoesDeUmGrupo(g)) {
      if (!achadas.includes(a)) achadas.push(a);
    }
  }
  return achadas;
}

/** Nome longo por substring; falhando, nome curto pelo canônico de MUSCLE_ALIASES. */
function articulacoesDeUmGrupo(grupo: string): string[] {
  const n = semAcento(grupo);
  const direto = ARTICULACOES_POR_GRUPO.filter(e => n.includes(e.grupo));
  if (direto.length > 0) return direto.flatMap(e => e.articulacoes);

  const canonico = normalizarGrupo(grupo);
  return ARTICULACOES_POR_GRUPO
    .filter(e => e.canonicos?.includes(canonico))
    .flatMap(e => e.articulacoes);
}

/**
 * Opções de sorteio, compartilhadas pela mobilidade e pelo abdominal.
 *
 * `semente` existe para o resultado ser ESTÁVEL quando precisa ser: o bloco dentro do treino
 * não pode trocar de exercício a cada re-render, no meio da sessão. `excluir` existe para o
 * contrário — o botão de roletar, que precisa devolver um conjunto diferente do que está na
 * tela, senão o clique parece quebrado.
 */
export interface OpcoesDeSorteio {
  /** Nomes que esta rodada deve evitar. Preferência, não proibição: ver a ordem dos baldes. */
  excluir?: string[];
  /** Sem semente, sorteio aleatório a cada chamada. */
  semente?: number;
}

/**
 * ORDEM DOS BALDES, e por que relevância vence novidade.
 *
 * 1. serve a articulação do dia E não está na tela
 * 2. serve a articulação do dia E está na tela
 * 3. não serve E não está na tela
 * 4. não serve E está na tela
 *
 * Quando o grupo de articulação tem exatamente três exercícios, roletar devolve os mesmos
 * três — e isso é certo. Mobilidade de ombro repetida é melhor que mobilidade de tornozelo
 * nova num dia de supino. O botão não finge variedade que o catálogo não tem.
 */
function ordenarPorRelevancia<T extends ExercicioSimples>(
  candidatos: T[],
  serve: (e: T) => boolean,
  opcoes: OpcoesDeSorteio
): T[] {
  const evitar = new Set((opcoes.excluir ?? []).map(n => n.trim().toLowerCase()));
  const naTela = (e: T) => evitar.has((e.name ?? '').trim().toLowerCase());

  const baldes: T[][] = [[], [], [], []];
  for (const e of candidatos) {
    const i = (serve(e) ? 0 : 2) + (naTela(e) ? 1 : 0);
    baldes[i].push(e);
  }
  return baldes.flatMap(b => embaralhar(b, opcoes.semente));
}

/**
 * Escolhe a mobilidade do aquecimento pelas ARTICULAÇÕES que a sessão vai carregar.
 *
 * O QUE ESTAVA ERRADO, medido em 19/10/2026
 *
 * A escolha casava o GRUPO MUSCULAR do exercício de mobilidade com o grupo da sessão. Só que
 * o catálogo não tem mobilidade etiquetada "Peito" nem "Bíceps" — os cinco de ombro estão
 * etiquetados "Ombro". Resultado medido, para um aluno de casa:
 *
 *   Peito + Tríceps   → 0 candidatos do dia → caía no genérico: DORSIFLEXÃO PLANTAR
 *   Costas + Bíceps   → 0 candidatos do dia → idem
 *
 * Mobilidade de tornozelo antes do supino. O aquecimento existia, rodava, e preparava a
 * articulação errada — o tipo de defeito que não quebra nada e por isso ninguém vê.
 *
 * A PONTE JÁ EXISTIA
 *
 * ARTICULACOES_POR_GRUPO sabe que peito→Ombro e costas→Ombro+Coluna torácica. Ele só era
 * usado para ESCREVER na tela qual articulação ia trabalhar, nunca para escolher. Agora o
 * mesmo mapa roda nos dois sentidos: grupo da sessão → articulação, e grupo do exercício de
 * mobilidade → articulação, casando pela articulação. Nenhum dado novo, nenhuma lista de
 * palavras nova.
 *
 * Com isso, dia de peito passa de 0 para 7 candidatos.
 *
 * "PREFERINDO", NÃO "EXIGINDO", continua valendo: são 24 exercícios no catálogo inteiro, e o
 * COTOVELO não tem nenhum. Dia de bíceps cai no genérico — e isso é falta de cadastro, não
 * do filtro. Melhor aquecer com algo genérico do que não aquecer.
 */
export function selecionarMobilidade(
  catalogo: ExercicioSimples[],
  gruposDaSessao: string[],
  quantidade = 3,
  opcoes: OpcoesDeSorteio = {}
): ExercicioSimples[] {
  const todas = catalogo.filter(e => classificarTipo(e.name, e.muscle_group) === 'mobilidade');
  const alvo = new Set(articulacoesDosGrupos(gruposDaSessao));

  const serve = (e: ExercicioSimples) =>
    articulacoesDosGrupos([e.muscle_group || '']).some(a => alvo.has(a));

  return ordenarPorRelevancia(todas, serve, opcoes).slice(0, quantidade);
}

/**
 * A chave e a semente da mobilidade de uma sessão.
 *
 * POR QUE ISTO PRECISA SER COMPARTILHADO
 *
 * O montador mostra ao profissional o que o aluno receberia no modo automático. Se o servidor
 * sorteasse de outro jeito na hora de salvar, a prévia mentiria — mostraria três exercícios e
 * entregaria outros três, que é pior do que não ter prévia nenhuma.
 *
 * Com a mesma chave dos dois lados, o sorteio é o MESMO sorteio. Nada precisa ser transmitido.
 */
export function chaveDeMobilidade(sessaoId: string, grupos: string[]): string {
  return `${sessaoId}|mob|${[...grupos].sort().join(',')}`;
}

export function chaveDeAbdominal(sessaoId: string): string {
  return `${sessaoId}|abd`;
}

export function sementeDaChave(chave: string): number {
  return [...chave].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
}

/**
 * As articulações que ESTE exercício de mobilidade atende.
 *
 * Exportada para a tela poder dizer por que escolheu cada um — "Pêndulo de ombro · Ombro" —
 * em vez de mostrar uma lista que o profissional tem que aceitar no escuro.
 */
export function articulacoesDoExercicio(grupoMuscular: string | null | undefined): string[] {
  return articulacoesDosGrupos([grupoMuscular || '']);
}

/**
 * Escolhe o abdominal do dia.
 *
 * Mesma função para os dois lados, de propósito: o montador mostra ao profissional o que o
 * aluno receberia, e a tela do aluno escolhe quando não houve prescrição. Duas regras
 * separadas divergiriam, e a divergência apareceria como "não foi isso que eu vi quando
 * montei".
 *
 * Recebe o catálogo JÁ filtrado por equipamento, como a mobilidade — quem conhece o perfil do
 * aluno é quem chama. São 97 exercícios de core, 56 sem equipamento nenhum, então o pool
 * sobra em qualquer cenário.
 *
 * Não usa articulação: core é core. O que importa aqui é não repetir os mesmos três toda
 * semana, e é disso que a semente e o `excluir` cuidam.
 */
export function selecionarAbdominal(
  catalogo: ExercicioSimples[],
  quantidade = 3,
  opcoes: OpcoesDeSorteio = {}
): ExercicioSimples[] {
  const core = catalogo.filter(e => /core|abd/i.test(e.muscle_group ?? ''));
  return ordenarPorRelevancia(core, () => true, opcoes).slice(0, quantidade);
}

/** Alongamento dos grupos pedidos; sem grupo, devolve o catálogo inteiro de alongamento. */
export function selecionarAlongamento(
  catalogo: ExercicioSimples[],
  grupos: string[] = [],
  quantidade?: number
): ExercicioSimples[] {
  const todos = catalogo.filter(e => classificarTipo(e.name, e.muscle_group) === 'alongamento');
  if (grupos.length === 0) return quantidade ? todos.slice(0, quantidade) : todos;

  const alvo = new Set(grupos.map(normalizarGrupo));
  const doGrupo = todos.filter(e => alvo.has(normalizarGrupo(e.muscle_group || '')));
  const escolhidos = doGrupo.length > 0 ? doGrupo : todos;
  return quantidade ? embaralhar(escolhidos).slice(0, quantidade) : escolhidos;
}

/**
 * Sorteio embaralhado, estável quando recebe semente.
 *
 * Sem semente mantém o comportamento antigo (aleatório a cada chamada), que é o que o
 * servidor quer ao montar o aquecimento uma vez. Com semente, a mesma entrada devolve sempre
 * a mesma ordem — é o que impede o bloco dentro do treino de trocar os exercícios debaixo de
 * quem está no meio da sessão.
 *
 * `sort` com comparador aleatório não é um embaralhamento uniforme, mas aqui o uso é escolher
 * 3 de 13 para aquecer. Fisher-Yates seria mais correto e não mudaria nada que alguém perceba.
 */
function embaralharComSemente<T extends { name?: string }>(lista: T[], semente: number): T[] {
  const peso = (nome: string) =>
    [...nome].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, semente) % 100000;
  return [...lista].sort((a, b) => peso(a.name ?? '') - peso(b.name ?? ''));
}

/**
 * "Pernas (quadríceps)" e "Perna" precisam casar. O catálogo tem o nome longo, e a sessão
 * gerada costuma trazer o curto.
 */
function normalizarGrupo(g: string): string {
  const n = g.toLowerCase().trim();
  for (const [canonico, variantes] of Object.entries(MUSCLE_ALIASES)) {
    if (variantes.some(v => n.includes(v))) return canonico;
  }
  return n;
}

function embaralhar<T extends { name?: string }>(lista: T[], semente?: number): T[] {
  if (semente !== undefined) return embaralharComSemente(lista, semente);
  return [...lista].sort(() => Math.random() - 0.5);
}
