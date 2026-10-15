// Classifica um exercício em qual equipamento ele exige, a partir do NOME — o campo "equipment"
// da tabela exercises está inutilizável (todo exercício cadastrado pela UI grava "Haltere" fixo,
// sem exceção, não existe campo de equipamento no formulário). Best-effort por palavra-chave,
// mesma abordagem usada pra composto/isolado no repair de contagem de exercícios.
//
// Compartilhado entre app/api/treino/route.ts (geração) e app/api/swap/route.ts (troca de
// exercício) — os dois precisam respeitar o mesmo local de treino.

export type EquipmentTier = 'maquina' | 'barra' | 'halteres' | 'peso_corporal';

const MACHINE_KEYWORDS = [
  'máquina', 'maquina', 'polia', 'cabo', 'smith', 'cross over', 'crossover', 'leg press', 'hack',
  // "cadeira" sozinho foi trocado pelos nomes compostos: o import de Calistenia trouxe "Dips na
  // cadeira" e "Paralelas entre Cadeiras" (cadeira de casa, não máquina de academia) — a palavra
  // solta classificava esses exercícios de peso corporal como "só academia completa" por engano.
  'cadeira extensora', 'cadeira flexora', 'cadeira adutora', 'cadeira abdutora',
  'mesa flexora', 'mesa extensora', 'voador', 'pec deck', 'alavanca', 'multi power',
  'graviton', 'simulador', 'elíptica', 'eliptica', 'elíptico', 'eliptico', 'esteira', 'ergométrica', 'ergometrica',
  // "assistid" sozinho foi removido pelo mesmo motivo: "Barra fixa Assistida com Faixa Elástica"
  // é assistida por elástico (peso corporal), não pela máquina graviton — que já é pega por
  // 'graviton' acima sem precisar da palavra solta.
  'bike', 'airbike', 'air bike', 'remo', 'rowing', 'escada', 'step mill', 'spinning',
  'plataforma vibratória', 'plataforma vibratoria', 'corda naval', 'battle rope',
];

// Itens que exigem um acessório específico mas são portáteis o bastante pra ter em casa — mesmo
// balde de "Halteres em casa" (nem academia completa, nem 100% peso corporal). Import de
// Calistenia/Mobilidade trouxe TRX, bola medicinal/de estabilidade, PVC, argolas, caixa de salto
// e corda, nenhum coberto antes — caíam todos em "peso_corporal" por padrão e vazavam pra quem
// escolheu treinar sem nenhum equipamento.
const PORTABLE_EQUIPMENT_KEYWORDS = [
  'trx', 'bola medicinal', 'bola de estabilidade', 'bola suíça', 'bola suica', 'pvc',
  'argola', 'caixa', 'corda',
];

export function classifyEquipmentTier(name: string): EquipmentTier {
  const n = name.toLowerCase();
  if (MACHINE_KEYWORDS.some(k => n.includes(k))) return 'maquina';
  if (n.includes('barra') && !n.includes('barra fixa')) return 'barra';
  if (n.includes('haltere') || n.includes('halter') || n.includes('kettlebell') || n.includes('anilha')) return 'halteres';
  if (n.includes('elástico') || n.includes('elastico') || n.includes('banda') || n.includes('faixa')) return 'halteres';
  if (PORTABLE_EQUIPMENT_KEYWORDS.some(k => n.includes(k))) return 'halteres';
  return 'peso_corporal';
}

/**
 * ATENÇÃO AO LER ESTE MAPA: ele NÃO cobre "Em casa".
 *
 * As chaves abaixo são do dropdown ANTIGO, de quatro opções. Em 08/10/2026 ele virou duas —
 * "Academia completa" e "Em casa" — e ninguém atualizou este mapa. Resultado: em
 * app/api/swap/route.ts, `EQUIPMENT_ALLOWED_TIERS['Em casa']` dava undefined, o filtro não
 * rodava e a troca ofereceu máquina a quem treina em casa por seis dias.
 *
 * "Em casa" NÃO entra aqui de propósito. Tier é um balde grosso e não sabe distinguir quem
 * tem halteres de quem tem só o peso do corpo — para isso existe filtrarParaCasa, que lê o
 * inventário real do aluno. As duas rotas que importam usam ele.
 *
 * Este mapa fica para os valores legados, que ainda aparecem em planos antigos.
 */
export const EQUIPMENT_ALLOWED_TIERS: Record<string, EquipmentTier[]> = {
  'Academia completa': ['maquina', 'barra', 'halteres', 'peso_corporal'],
  'Halteres em casa': ['halteres', 'peso_corporal'],
  'Barra e anilhas': ['barra', 'peso_corporal'],
  'Sem equipamento (calistenia)': ['peso_corporal'],
};
