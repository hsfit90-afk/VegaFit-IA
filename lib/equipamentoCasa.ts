// O que o aluno tem em casa.
//
// Espelho invertido de lib/equipamentoAusente.ts, e a inversão é proposital:
//
//   ACADEMIA  o aluno marca o que FALTA. Não marcar nada = recebe tudo, que é o caso da
//             maioria. A pergunta é opcional.
//   CASA      o aluno marca o que TEM. Não marcar nada = só peso corporal, que é o caso da
//             maioria. A pergunta é obrigatória: sem ela a IA não sabe se a pessoa tem dois
//             halteres ou uma academia na garagem, e chuta.
//
// A REGRA É "TUDO QUE O EXERCÍCIO PEDE, A PESSOA TEM"
//
// Em vez de liberar baldes de equipamento, cada exercício é lido pelo nome: se ele cita algum
// aparelho que a pessoa não marcou, sai. Se não cita nenhum, é peso corporal e entra sempre.
// São 424 exercícios de peso corporal puro no catálogo, cobrindo todos os grupos musculares —
// quem não tem nada ainda treina o corpo inteiro.

import { EquipmentTier } from './equipmentTier';

export interface ItemDeCasa {
  id: string;
  rotulo: string;
  ajuda?: string;
  palavras: string[];
}

/**
 * Sete caixas. A lista é curta pelo mesmo motivo da outra: formulário longo ninguém preenche,
 * e esta aqui é obrigatória para quem treina em casa — então o atrito importa mais ainda.
 *
 * O que NÃO virou caixa, e por quê:
 *
 *   "corda"  — os 11 exercícios do catálogo são quase todos "Tríceps francês na polia com
 *              corda". É acessório de cabo, não corda de pular, e já sai pelo filtro de polia.
 *   "banco inclinado/declinado" — "inclinado" pega 70 exercícios, e a maioria é de cabo ou
 *              máquina ("Supino inclinado com cabo"). A palavra que de fato indica banco é
 *              "banco", com 31.
 */
export const EQUIPAMENTOS_CASA: ItemDeCasa[] = [
  { id: 'halteres',   rotulo: 'Halteres',            palavras: ['haltere', 'halter', 'dumbbell'] },
  { id: 'barra',      rotulo: 'Barra e anilhas',     ajuda: 'barra olímpica ou comum, com peso', palavras: ['barra', 'anilha'] },
  { id: 'elastico',   rotulo: 'Elástico ou faixa',   palavras: ['elástico', 'elastico', 'faixa', 'banda'] },
  // "supino", "crucifixo", "scott" e "apoio no peito" entram junto de "banco" porque pedem
  // banco sem dizer a palavra. Medido um a um em 12/10/2026, no catálogo JÁ sem os de
  // academia: supino 25 (todos de banco, menos o "no chão", tratado em NO_CHAO), crucifixo 5,
  // scott 7 (todos de banco scott), "apoio no peito" 1.
  //
  // "inclinado" ficou DE FORA apesar de pegar 33: metade é tronco inclinado em pé — remada
  // curvada, elevação lateral com tronco inclinado, alongamento —, não banco. Seria repetir o
  // erro do "frontal", que pegou 17 errados para acertar 6.
  { id: 'banco',      rotulo: 'Banco',               ajuda: 'para supino, remada e apoio',
    palavras: ['banco', 'supino', 'crucifixo', 'scott', 'apoio no peito'] },
  { id: 'barra_fixa', rotulo: 'Barra fixa',          ajuda: 'de porta ou de parede', palavras: ['barra fixa'] },
  { id: 'kettlebell', rotulo: 'Kettlebell',          palavras: ['kettlebell'] },
  { id: 'acessorios', rotulo: 'Bola, TRX ou argolas', palavras: ['trx', 'bola', 'argola'] },
];

export const IDS_CASA = EQUIPAMENTOS_CASA.map(e => e.id);

/**
 * Aparelho que nunca existe em casa.
 *
 * Exercício que cita qualquer um destes sai do bolso de quem treina em casa, independente do
 * que a pessoa marcou — não há caixa para "leg press em casa".
 */
const SO_ACADEMIA = [
  'máquina', 'maquina', 'polia', 'cabo', 'pulley', 'smith', 'leg press', 'hack',
  // "puxada alta" são os 5 do puxador alto; a palavra "puxada" sozinha NÃO serve, porque
  // pega puxada escapular na barra fixa, front lever e puxada isométrica, que são corporais.
  'puxada alta',
  // Nome em inglês que escapava do corte: o catálogo mistura idiomas. "cable" e "pulldown"
  // são aparelho; "lever" ficou de fora de propósito, porque Back Lever e Front Lever são
  // calistenia pura, não alavanca de máquina.
  'cable', 'pulldown',
  'cadeira extensora', 'cadeira flexora', 'cadeira adutora', 'cadeira abdutora',
  'mesa flexora', 'mesa extensora', 'voador', 'pec deck', 'graviton', 'alavanca',
  'cross over', 'crossover', 'esteira', 'elíptica', 'eliptica', 'elíptico', 'eliptico', 'ergométrica', 'ergometrica',
  'multi power', 'simulador', 'spinning', 'step mill',
  'plataforma vibratória', 'plataforma vibratoria', 'hands bike', 'bike', 'airbike', 'air bike',
];

/**
 * O exercício cabe no que a pessoa tem em casa?
 *
 * "barra fixa" é testada ANTES de "barra" e removida do texto: sem isso, quem marca só
 * "Barra e anilhas" receberia barra fixa, que é outro aparelho e normalmente não existe na
 * mesma casa.
 */
export function cabeEmCasa(nomeDoExercicio: string, tenho: string[] | null | undefined): boolean {
  let n = nomeDoExercicio.toLowerCase();

  if (SO_ACADEMIA.some(p => n.includes(p))) return false;

  const possui = new Set(tenho ?? []);

  // Barra fixa primeiro, e sai do texto para não ser contada como "barra".
  if (n.includes('barra fixa')) {
    if (!possui.has('barra_fixa')) return false;
    n = n.split('barra fixa').join(' ');
  }

  // O nome que diz "no chão" dispensa o banco, mesmo citando supino: "Supino com kettlebell
  // no chão" é floor press, e era o único falso positivo entre os 25 de "supino".
  const noChao = DIZ_QUE_E_NO_CHAO.some(p => n.includes(p));

  for (const item of EQUIPAMENTOS_CASA) {
    if (item.id === 'barra_fixa') continue; // já tratado acima
    if (item.id === 'banco' && noChao) continue;
    const cita = item.palavras.some(p => n.includes(p));
    if (cita && !possui.has(item.id)) return false;
  }

  return true;
}

/** O exercício declara no próprio nome que é feito no chão. */
const DIZ_QUE_E_NO_CHAO = ['no chão', 'no chao', 'no solo', 'deitado no piso'];

// ---------------------------------------------------------------------------------------
// IMPROVISO EM CASA
//
// Decisão do profissional (CREF, 12/10/2026): banco e step não devem simplesmente sumir do
// treino de quem treina em casa. Quase toda casa tem cadeira, sofá, cama e escada — e para a
// maioria desses exercícios isso resolve. Cortar sem oferecer a alternativa empobrece o
// treino por uma limitação que não existe de verdade.
//
// O que NÃO se improvisa está em `perigosoCom`: supino com BARRA numa cadeira não tem apoio
// para os ombros, não tem suporte para devolver o peso, e a superfície é estreita. São 8 dos
// 66 exercícios de banco do catálogo — os outros 58 voltam, com a dica junto.
// ---------------------------------------------------------------------------------------

export interface Improviso {
  /** O que a pessoa usa no lugar. Vai para a dica do exercício na tela. */
  dica: string;
  /** Palavras no nome que CANCELAM o improviso — com elas o exercício sai mesmo assim. */
  perigosoCom?: string[];
}

/** Para equipamento que É caixa: a pessoa pode ter, e se não tiver, improvisa. */
const IMPROVISO_POR_ITEM: Record<string, Improviso> = {
  banco: {
    dica: 'Sem banco: use uma cadeira firme (sem rodinhas), a beirada da cama ou o sofá. Nos exercícios deitado, o chão também serve — a amplitude diminui um pouco, e tudo bem.',
    perigosoCom: ['barra', 'anilha'],
  },
};

/**
 * Exige improviso, mas NUNCA vira caixa.
 *
 * Ninguém marca "tenho step em casa" — e perguntar aumentaria o formulário para ganhar nada,
 * porque a resposta é sempre a mesma: usa o degrau.
 */
const SO_IMPROVISO: { palavras: string[]; improviso: Improviso }[] = [
  {
    palavras: ['step', 'degrau'],
    improviso: {
      dica: 'Sem step: use o degrau da escada, um caixote firme ou a soleira da porta. Teste o apoio antes de subir com carga.',
    },
  },
];

export interface AvaliacaoCasa {
  cabe: boolean;
  /** Preenchida quando o exercício só cabe porque dá para improvisar. */
  dica?: string;
}

/**
 * Como `cabeEmCasa`, mas devolve a dica de improviso em vez de simplesmente cortar.
 *
 * É esta que o filtro usa. `cabeEmCasa` continua existindo com a semântica estrita, porque
 * "o aluno consegue fazer isto exatamente como está escrito?" é outra pergunta, e há teste
 * que depende dela.
 */
export function avaliarParaCasa(
  nomeDoExercicio: string,
  tenho: string[] | null | undefined
): AvaliacaoCasa {
  let n = nomeDoExercicio.toLowerCase();

  if (SO_ACADEMIA.some(p => n.includes(p))) return { cabe: false };

  const possui = new Set(tenho ?? []);
  const dicas: string[] = [];

  if (n.includes('barra fixa')) {
    if (!possui.has('barra_fixa')) return { cabe: false };
    n = n.split('barra fixa').join(' ');
  }

  const noChao = DIZ_QUE_E_NO_CHAO.some(p => n.includes(p));

  for (const item of EQUIPAMENTOS_CASA) {
    if (item.id === 'barra_fixa') continue;
    if (item.id === 'banco' && noChao) continue;

    const cita = item.palavras.some(p => n.includes(p));
    if (!cita || possui.has(item.id)) continue;

    const improviso = IMPROVISO_POR_ITEM[item.id];
    const perigoso = improviso?.perigosoCom?.some(p => n.includes(p));
    if (!improviso || perigoso) return { cabe: false };

    dicas.push(improviso.dica);
  }

  for (const { palavras, improviso } of SO_IMPROVISO) {
    if (palavras.some(p => n.includes(p))) dicas.push(improviso.dica);
  }

  return dicas.length > 0 ? { cabe: true, dica: dicas.join(' ') } : { cabe: true };
}

/**
 * Filtra o catálogo para quem treina em casa.
 *
 * SEM SALVAGUARDA POR GRUPO MUSCULAR, ao contrário do filtro de academia — e é de propósito.
 * Lá, devolver um exercício de máquina a quem está na academia é no máximo inconveniente.
 * Aqui, devolver um exercício de leg press a quem treina na sala é prescrever o impossível.
 * Peso corporal cobre todos os grupos, então nenhum grupo fica sem opção de verdade.
 */
export function filtrarParaCasa<T extends { name: string }>(
  exercicios: T[],
  tenho: string[] | null | undefined
): T[] {
  return exercicios.filter(ex => avaliarParaCasa(ex.name, tenho).cabe);
}

/**
 * As dicas de improviso dos exercícios que o aluno vai receber, por nome.
 *
 * Quem monta o prompt usa isto para colar a dica no exercício — "sem banco, use uma cadeira
 * firme" só ajuda se aparecer na tela junto do movimento, não num aviso geral que ninguém lê.
 */
export function dicasDeImproviso(
  nomes: string[],
  tenho: string[] | null | undefined
): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const nome of nomes) {
    const { cabe, dica } = avaliarParaCasa(nome, tenho);
    if (cabe && dica) mapa.set(nome, dica);
  }
  return mapa;
}

/**
 * Tiers equivalentes, para as rotas que ainda raciocinam em balde (a troca de exercício).
 * Peso corporal entra sempre; os demais dependem do que a pessoa marcou.
 */
export function tiersDeCasa(tenho: string[] | null | undefined): EquipmentTier[] {
  const possui = new Set(tenho ?? []);
  const tiers: EquipmentTier[] = ['peso_corporal'];
  if (possui.has('halteres') || possui.has('kettlebell') || possui.has('elastico') || possui.has('acessorios')) {
    tiers.push('halteres');
  }
  if (possui.has('barra')) tiers.push('barra');
  return tiers;
}

/** Texto para a tela confirmar o que a escolha significa. */
export function resumirCasa(tenho: string[] | null | undefined): string {
  const nomes = EQUIPAMENTOS_CASA.filter(e => (tenho ?? []).includes(e.id)).map(e => e.rotulo);
  if (nomes.length === 0) {
    return 'Sem equipamento: seus treinos usam só o peso do corpo. São mais de 400 exercícios, cobrindo o corpo inteiro.';
  }
  if (nomes.length === 1) return `Seus treinos vão usar ${nomes[0].toLowerCase()} e o peso do corpo.`;
  return `Seus treinos vão usar ${nomes.slice(0, -1).join(', ').toLowerCase()} e ${nomes[nomes.length - 1].toLowerCase()}, além do peso do corpo.`;
}
