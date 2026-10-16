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
  { id: 'halteres',   rotulo: 'Halteres',            palavras: ['haltere', 'halter', 'dumbbell', 'arnold'] },
  // OS QUE NÃO DIZEM "BARRA" NO NOME, mas são barra.
  //
  // "Levantamento Terra" e "Agachamento Frontal" apareceram num treino de casa de quem só
  // marcou halteres — e passaram porque o nome não cita aparelho nenhum. O filtro lê o nome,
  // e esses nomes não nomeiam o que usam.
  //
  // Medidos em 12/10/2026 contra os 368 exercícios que o filtro assumia como peso corporal.
  // Cada padrão pega só exercício de barra, zero falso positivo:
  // levantamento terra 7, arnold 3 (esse é haltere), zercher 2, landmine 2, e os demais 1.
  { id: 'barra',      rotulo: 'Barra e anilhas',     ajuda: 'barra olímpica ou comum, com peso',
    palavras: ['barra', 'anilha', 'levantamento terra', 'zercher', 'landmine',
               'remada alta', 'militar', 'remada curvada em t', 'remada t com',
               'agachamento frontal', 'com trava'] },
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
  // "espuma" entrou em 12/10/2026: o aquecimento vinha com três exercícios de rolo de espuma
  // para alguém que declarou não ter equipamento nenhum. A palavra pega 14 exercícios e todos
  // são de rolo — precisa. "ab wheel" e "rolo abdominal" são o mesmo caso, outro aparelho.
  //
  // Entraram nesta caixa em vez de virar caixa nova porque são a mesma família: acessório
  // barato que algumas casas têm e a maioria não. Caixa nova é mais uma pergunta no
  // formulário que já é o maior obstáculo do app.
  { id: 'acessorios', rotulo: 'Bola, rolo de espuma, TRX ou argolas',
    palavras: ['trx', 'bola', 'argola', 'espuma', 'ab wheel', 'rolo abdominal'] },
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
  // Aparelho que o nome nao nomeia: "Levantamento com Suporte" e rack, "no cross" e
  // crossover, "com cinto" e cadeira de cinto. Medidos: 1 cada, sem falso positivo.
  'levantamento com suporte', 'no cross', 'com cinto',
  // Face pull. "Puxada para o Rosto de Joelhos" vazou num treino de casa em 15/10/2026 — eu
  // tinha medido "puxada" em 12/10 e julgado este como corporal, olhando so o nome. O GIF
  // mostra polia. Medido agora: "para o rosto" pega 2, "face pull" 1, todos de cabo.
  'para o rosto', 'face pull',
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

  // Tira do texto a palavra que ali é metáfora, antes de checar equipamento.
  for (const falso of FALSOS_POSITIVOS) n = n.split(falso).join(' ');

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

/**
 * Nomes em que a palavra de equipamento é METÁFORA, não aparelho.
 *
 * "Rolando como uma Bola" é o roll like a ball do Pilates: a pessoa abraça os joelhos e rola
 * nas costas. Não existe bola nenhuma. Medido: dos 16 exercícios com "bola" no catálogo, 15
 * usam bola de verdade e só este não — exceção pequena o bastante para ser escrita à mão, em
 * vez de enfraquecer a palavra "bola" e deixar passar os outros 15.
 */
const FALSOS_POSITIVOS = ['como uma bola'];

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

  // Tira do texto a palavra que ali é metáfora, antes de checar equipamento.
  for (const falso of FALSOS_POSITIVOS) n = n.split(falso).join(' ');

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
/**
 * O exercício cabe, segundo a CLASSIFICAÇÃO guardada no banco.
 *
 * Esta é a regra que substitui o palpite pelo nome, a partir de 16/10/2026. Cada exercício
 * tem uma lista do que exige (exercises.equipamento_necessario), preenchida uma vez e
 * revisada pelo profissional. Aqui só se compara lista com lista.
 *
 * `null` significa NÃO CLASSIFICADO, e devolve null também: quem chama cai na regra por nome.
 * É o que faz exercício novo funcionar no dia em que entra no catálogo, antes de alguém
 * passar na tela de revisão.
 */
export function cabePelaClassificacao(
  exige: string[] | null | undefined,
  tenho: string[] | null | undefined
): boolean | null {
  if (!Array.isArray(exige)) return null;
  if (exige.includes('maquina')) return false;
  const possui = new Set(tenho ?? []);
  return exige.every(id => possui.has(id));
}

/**
 * Filtra o catálogo para quem treina em casa.
 *
 * SEM SALVAGUARDA POR GRUPO MUSCULAR, ao contrário do filtro de academia — e é de propósito.
 * Lá, devolver um exercício de máquina a quem está na academia é no máximo inconveniente.
 * Aqui, devolver leg press a quem treina na sala é prescrever o impossível.
 *
 * PREFERE A CLASSIFICAÇÃO, cai no nome quando ela não existe. A regra por nome continua no
 * código porque continua sendo usada: exercício recém-cadastrado chega sem classificação, e
 * entre errar como antes e não entregar nada, errar como antes é melhor.
 */
export function filtrarParaCasa<T extends { name: string; equipamento_necessario?: string[] | null }>(
  exercicios: T[],
  tenho: string[] | null | undefined
): T[] {
  return exercicios.filter(ex => {
    const pelaColuna = cabePelaClassificacao(ex.equipamento_necessario, tenho);
    return pelaColuna ?? avaliarParaCasa(ex.name, tenho).cabe;
  });
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
