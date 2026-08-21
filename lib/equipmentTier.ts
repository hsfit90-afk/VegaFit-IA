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
  'cadeira', 'mesa flexora', 'mesa extensora', 'voador', 'pec deck', 'alavanca', 'multi power',
  'graviton', 'simulador', 'elíptica', 'eliptica', 'esteira', 'ergométrica', 'ergometrica', 'assistid',
];

export function classifyEquipmentTier(name: string): EquipmentTier {
  const n = name.toLowerCase();
  if (MACHINE_KEYWORDS.some(k => n.includes(k))) return 'maquina';
  if (n.includes('barra') && !n.includes('barra fixa')) return 'barra';
  if (n.includes('haltere') || n.includes('halter') || n.includes('kettlebell') || n.includes('anilha')) return 'halteres';
  if (n.includes('elástico') || n.includes('elastico') || n.includes('banda') || n.includes('faixa')) return 'halteres';
  return 'peso_corporal';
}

export const EQUIPMENT_ALLOWED_TIERS: Record<string, EquipmentTier[]> = {
  'Academia completa': ['maquina', 'barra', 'halteres', 'peso_corporal'],
  'Halteres em casa': ['halteres', 'peso_corporal'],
  'Barra e anilhas': ['barra', 'peso_corporal'],
  'Sem equipamento (calistenia)': ['peso_corporal'],
};
