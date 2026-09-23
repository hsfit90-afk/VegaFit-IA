// Classifica a EXIGÊNCIA TÉCNICA de um exercício a partir do nome, para não prescrever
// movimento avançado a quem está começando.
//
// Por que pelo nome, e não pelo campo `difficulty` da tabela: esse campo existe mas é uma
// constante — todos os 882 exercícios do catálogo têm difficulty = 1. Nunca foi preenchido,
// e o formulário da biblioteca não pede esse dado. Mesma situação do campo `equipment`, que
// levou a lib/equipmentTier.ts a classificar por palavra-chave.
//
// Por que filtrar o pool em vez de instruir a IA: enforcement só por prompt já falhou neste
// projeto de forma documentada (ver o comentário do filtro de equipamento em
// app/api/treino/route.ts). Se o exercício nunca entra na lista, a IA não tem como escolhê-lo.
//
// Compartilhado entre a geração e a troca de exercício, pelo mesmo motivo do equipmentTier:
// as duas precisam respeitar o mesmo nível do aluno.

export type ExerciseLevel = 'iniciante' | 'intermediario' | 'avancado';

/**
 * Movimentos avançados pelo PADRÃO em si, não pela carga. Continuam avançados em qualquer
 * contexto — não existe versão guiada de um muscle up.
 */
const SEMPRE_AVANCADO_KEYWORDS = [
  // Pliometria: aterrissagem sob carga, exige controle excêntrico que se constrói com tempo.
  'salto', 'saltos', 'jump', 'pliom', 'explosiv', 'depth',

  // Calistenia de alto nível: exigem força relativa que leva anos.
  'muscle up', 'muscle-up', 'bandeira humana', 'human flag', 'front lever', 'planche',
  'parada de mão', 'parada de mao', 'handstand',

  // Levantamento olímpico e derivados: técnica de anos, executados em velocidade.
  'arranco', 'clean', 'snatch', 'jerk', 'olímpic', 'olimpic',

  // Unilateral de perna com instabilidade. Unilateral de braço (rosca, tríceps) NÃO entra:
  // é isolamento comum, sem risco. O que pesa é sustentar o corpo numa perna sob carga.
  'búlgar', 'bulgar', 'pistol', 'sissy',
];

/**
 * Variações que são exigentes EM PESO LIVRE, porque a margem de erro é pequena e o aluno
 * precisa se estabilizar sozinho. Num equipamento guiado a máquina faz essa estabilização,
 * e o exercício deixa de ser avançado — "Agachamento Frontal com Barra no Smith" não pede a
 * mesma técnica que o agachamento frontal livre.
 */
const TECNICO_EM_PESO_LIVRE_KEYWORDS = [
  'déficit', 'deficit', 'sumô', 'sumo',
  // "frontal" sozinho NÃO serve: no catálogo pega 17 exercícios errados (elevação frontal,
  // alongamento da parte frontal do ombro) contra 6 certos. Elevação frontal é isolamento
  // básico de ombro — classificá-la como avançada tirava do iniciante um dos exercícios mais
  // comuns que existem. Peguei o nome completo do movimento que de fato exige técnica.
  'agachamento frontal', 'front squat',
  'overhead', 'zercher',
];

/**
 * Movimento livre composto: forma importa, mas é o pão com manteiga de quem já treina.
 * Um iniciante chega aqui em semanas, não em anos.
 */
const INTERMEDIARIO_KEYWORDS = [
  'agachamento', 'levantamento terra', 'terra', 'supino', 'remada', 'desenvolvimento',
  'afundo', 'avanço', 'avanco', 'passada', 'stiff', 'barra fixa', 'paralelas', 'dips',
  'clean and press', 'thruster', 'swing', 'turkish',
];

/**
 * Equipamento guiado: a máquina impõe a trajetória, então sobra pouco para errar.
 * É por onde um iniciante deve começar.
 */
const GUIADO_KEYWORDS = [
  'máquina', 'maquina', 'polia', 'cabo', 'leg press', 'hack',
  'cadeira extensora', 'cadeira flexora', 'cadeira adutora', 'cadeira abdutora',
  'mesa flexora', 'mesa extensora', 'voador', 'pec deck', 'graviton', 'cross over', 'crossover',
];

/**
 * O Smith tem tratamento próprio — não é máquina nem peso livre.
 *
 * A primeira versão o colocava junto com as máquinas, e o resultado apareceu no uso: um aluno
 * iniciante recebeu "supino no Smith". A diferença que faltava: numa cadeira extensora o aluno
 * senta e empurra, e o equipamento dita o movimento inteiro. No Smith ele destrava uma barra
 * carregada e executa o mesmo padrão do supino livre — o que muda é a trajetória ser fixa.
 *
 * Então o Smith ESTABILIZA (reduz a exigência de uma variação técnica difícil) mas não
 * SIMPLIFICA o padrão: supino no Smith continua sendo supino. Na prática:
 *
 *   composto no Smith (supino, agachamento, remada, desenvolvimento) -> intermediário
 *   isolado no Smith (encolhimento, panturrilha, elevação pélvica)   -> iniciante
 *
 * São 18 exercícios no catálogo, 11 compostos e 7 isolados.
 */
const SMITH = 'smith';

export function classifyExerciseLevel(name: string): ExerciseLevel {
  const n = name.toLowerCase();
  const guiado = GUIADO_KEYWORDS.some(k => n.includes(k));
  const noSmith = n.includes(SMITH);
  const composto = INTERMEDIARIO_KEYWORDS.some(k => n.includes(k));

  // Tanto a máquina quanto o Smith tiram do aluno o trabalho de estabilizar — é isso que
  // torna uma variação técnica menos exigente. Os dois contam aqui.
  const estabilizado = guiado || noSmith;

  // Padrão avançado em si: vence tudo. "Agachamento búlgaro com salto" é avançado mesmo
  // contendo "agachamento", e não existe muscle up guiado.
  if (SEMPRE_AVANCADO_KEYWORDS.some(k => n.includes(k))) return 'avancado';

  // Variação técnica: avançada em peso livre, intermediária quando algo estabiliza.
  if (TECNICO_EM_PESO_LIVRE_KEYWORDS.some(k => n.includes(k))) {
    return estabilizado ? 'intermediario' : 'avancado';
  }

  // Smith vem ANTES do guiado porque muitos desses exercícios se chamam "máquina Smith" e
  // cairiam na regra de máquina por engano. Ver o comentário de SMITH: ele estabiliza, mas
  // não simplifica o padrão — supino no Smith continua sendo supino.
  if (noSmith) return composto ? 'intermediario' : 'iniciante';

  // Máquina de verdade vence composto: o equipamento impõe a trajetória e o aluno só empurra.
  if (guiado) return 'iniciante';

  if (composto) return 'intermediario';

  // O resto é isolamento simples (rosca, elevação, extensão) ou peso corporal básico
  // (flexão, prancha, ponte): seguro para quem está começando.
  return 'iniciante';
}

/**
 * Quais níveis de exercício um aluno pode receber. É CUMULATIVO: quem é avançado continua
 * podendo fazer cadeira extensora, e deve — o catálogo de um avançado é o maior, não o mais
 * exótico. O inverso é que não vale.
 */
export const NIVEIS_PERMITIDOS: Record<ExerciseLevel, ExerciseLevel[]> = {
  iniciante: ['iniciante'],
  intermediario: ['iniciante', 'intermediario'],
  avancado: ['iniciante', 'intermediario', 'avancado'],
};

/**
 * Grupos musculares que NÃO passam pelo filtro de nível — todo aluno recebe o catálogo inteiro
 * desses grupos, independentemente do nível.
 *
 * Ombro entrou a pedido do dono do produto (23/09/2026). O filtro estava barrando 29 dos 126
 * exercícios de ombro, e a maior parte era trabalho padrão que qualquer aluno faz: remada alta,
 * desenvolvimento Arnold, desenvolvimento cubano, desenvolvimento com barra. Restringir isso
 * empobrecia o treino de ombro sem ganho de segurança real.
 *
 * A ressalva registrada na época: 3 dos 29 são calistenia de alto nível — "Flexão com parada de
 * mãos", "Caminhada na Parada de Mão" e "Planche com Flexão de Braço". Um iniciante não executa
 * esses movimentos, e tentar parada de mão sem base é risco de queda sobre a cabeça. Ficaram
 * liberados por decisão explícita; se aparecerem em treino de iniciante e incomodarem, o
 * caminho é mover esses três para uma lista de exceção em vez de refiltrar o grupo inteiro.
 */
export const GRUPOS_SEM_FILTRO_DE_NIVEL = ['Ombro'];

/**
 * Normaliza o texto de nível que vem do perfil ou do formulário ("Iniciante", "intermediário",
 * "Avançado") para a chave interna. Desconhecido cai em iniciante: na dúvida, prescrever a
 * opção mais segura.
 */
export function normalizarNivel(texto: string | undefined | null): ExerciseLevel {
  const t = (texto || '').toLowerCase();
  if (t.includes('avanc') || t.includes('avanç')) return 'avancado';
  if (t.includes('interm')) return 'intermediario';
  return 'iniciante';
}
