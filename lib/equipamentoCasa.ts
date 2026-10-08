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
  { id: 'halteres',   rotulo: 'Halteres',            palavras: ['haltere', 'halter'] },
  { id: 'barra',      rotulo: 'Barra e anilhas',     ajuda: 'barra olímpica ou comum, com peso', palavras: ['barra', 'anilha'] },
  { id: 'elastico',   rotulo: 'Elástico ou faixa',   palavras: ['elástico', 'elastico', 'faixa', 'banda'] },
  { id: 'banco',      rotulo: 'Banco',               ajuda: 'para supino, remada e apoio', palavras: ['banco'] },
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
  'cadeira extensora', 'cadeira flexora', 'cadeira adutora', 'cadeira abdutora',
  'mesa flexora', 'mesa extensora', 'voador', 'pec deck', 'graviton', 'alavanca',
  'cross over', 'crossover', 'esteira', 'elíptica', 'eliptica', 'ergométrica', 'ergometrica',
  'multi power', 'simulador', 'spinning', 'step mill',
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

  for (const item of EQUIPAMENTOS_CASA) {
    if (item.id === 'barra_fixa') continue; // já tratado acima
    const cita = item.palavras.some(p => n.includes(p));
    if (cita && !possui.has(item.id)) return false;
  }

  return true;
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
  return exercicios.filter(ex => cabeEmCasa(ex.name, tenho));
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
