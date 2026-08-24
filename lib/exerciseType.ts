// Classifica se um exercício é só mobilidade/alongamento/liberação miofascial (sem carga
// progressiva) — esses não fazem sentido dentro do gerador de treino de força, que sempre
// prescreve séries/reps/periodização de 4 semanas. Uma "Rotação Externa do Ombro com Cabo" ou
// "Elevação lateral de deltoide posterior com halteres" continuam sendo exercícios de força de
// verdade (têm carga/resistência real) e ficam de fora dessa lista mesmo citando uma articulação
// em rotação — por isso o RESISTANCE_OVERRIDE roda antes e vence qualquer palavra-chave abaixo.
//
// Best-effort por nome, mesma abordagem de lib/equipmentTier.ts — não existe campo no banco pra
// isso (ver comentário lá sobre o campo "equipment" estar inutilizável).
const MOBILITY_KEYWORDS = [
  'alongamento',
  'postura de', 'postura do', 'postura da',
  'rolo de espuma', 'rolamento de espuma', 'rolagem de espuma',
  'pêndulo', 'pendulo',
  'dorsiflexão', 'dorsiflexao',
  'catavento',
  'joelho alternado',
  'toque lateral dos dedos', 'toque nos dedos', 'toques de dedos',
  'abraços nos joelhos', 'abraco nos joelhos',
  'levantamento de braço apoiado na parede', 'levantamento de braco apoiado na parede',
  'bailarina',
  'inclinação lateral', 'inclinacao lateral',
  'rotação da coluna', 'rotacao da coluna',
  'rotação de pé e tornozelo', 'rotacao de pe e tornozelo',
  'rotação do corpo superior', 'rotacao do corpo superior',
  'rotação espinhal', 'rotacao espinhal',
  'rotação para trás de joelhos', 'rotacao para tras de joelhos',
  'rotação externa do ombro', 'rotacao externa do ombro',
  'rotação interna do ombro', 'rotacao interna do ombro',
  'círculos com', 'circulos com',
];

const RESISTANCE_OVERRIDE_KEYWORDS = ['cabo', 'faixa elástica', 'faixa elastica', 'haltere', 'halteres'];

export function isMobilityOnly(name: string): boolean {
  const n = name.toLowerCase();
  if (RESISTANCE_OVERRIDE_KEYWORDS.some(k => n.includes(k))) return false;
  return MOBILITY_KEYWORDS.some(k => n.includes(k));
}
