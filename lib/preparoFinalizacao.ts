// Mobilidade, alongamento e aeróbico: o que vem ANTES, DEPOIS e QUANDO O ALUNO QUISER.
//
// A prescrição, definida pelo profissional (CREF) em 08/10/2026:
//
//   MOBILIDADE    antes do treino. Prepara a articulação que vai ser carregada, então faz
//                 sentido estar amarrada à sessão do dia — mobilidade de quadril e tornozelo
//                 no dia de perna, de ombro no dia de empurrar.
//   AERÓBICO      sempre DEPOIS da força. Fazer antes compromete a carga do treino principal.
//   ALONGAMENTO   em qualquer momento do dia. Não precisa estar colado ao treino, então tem
//                 tela própria em vez de bloco dentro da sessão.
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
 * Escolhe a mobilidade do aquecimento, preferindo os grupos que a sessão vai treinar.
 *
 * "Preferindo", não "exigindo": o catálogo tem 20 exercícios de mobilidade no total, e alguns
 * grupos não têm nenhum. Melhor aquecer com algo genérico do que não aquecer. Quando faltar,
 * completa com mobilidade de qualquer grupo.
 */
export function selecionarMobilidade(
  catalogo: ExercicioSimples[],
  gruposDaSessao: string[],
  quantidade = 3
): ExercicioSimples[] {
  const todas = catalogo.filter(e => classificarTipo(e.name, e.muscle_group) === 'mobilidade');
  const alvo = new Set(gruposDaSessao.map(normalizarGrupo));

  const doDia = todas.filter(e => alvo.has(normalizarGrupo(e.muscle_group || '')));
  const resto = todas.filter(e => !alvo.has(normalizarGrupo(e.muscle_group || '')));

  return [...embaralhar(doDia), ...embaralhar(resto)].slice(0, quantidade);
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

function embaralhar<T>(lista: T[]): T[] {
  return [...lista].sort(() => Math.random() - 0.5);
}
