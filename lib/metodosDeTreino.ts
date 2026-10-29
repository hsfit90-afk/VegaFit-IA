import type { MethodId } from './trainingUnlock';

/**
 * Os nomes dos seis métodos, em um lugar só.
 *
 * NÃO SÃO NOMES NOVOS. Esta lista estava escrita dentro de `app/generator/page.tsx`, como
 * constante local da tela, desde que o seletor de método existe. O texto é do profissional —
 * eu só tirei de lá para cá, sem mudar uma palavra.
 *
 * O motivo é que em 29/10/2026 o painel passou a precisar do mesmo nome, para dizer qual é a
 * estrutura do treino de hoje. Copiar a lista para a segunda tela criaria dois lugares para
 * errar: trocar "Rest-Pause" por "Rest Pause" numa delas e não na outra é exatamente como um
 * app começa a parecer desorganizado.
 *
 * O `id` é a chave gravada em `workout_plans.training_method`. O `label` é o que o aluno lê.
 * Os dois NÃO se misturam: a chave nunca aparece em tela, e o nome nunca vai ao banco.
 *
 * Isto é vocabulário, não regra: nada aqui decide prescrição, carga ou desbloqueio. Quem
 * decide o que o aluno pode usar é `lib/trainingUnlock.ts`, e `MethodId` vem de lá de
 * propósito, para que acrescentar método sem passar pelo desbloqueio não compile.
 */
export const METODOS_DE_TREINO: ReadonlyArray<{
  id: MethodId;
  label: string;
  icon: string;
  desc: string;
}> = [
  { id: 'tradicional', label: 'Tradicional', icon: '🏋️', desc: 'Séries e repetições padrão com descanso entre séries' },
  { id: 'superset', label: 'Superset', icon: '⚡', desc: 'Dois exercícios alternados sem descanso entre eles' },
  { id: 'drop_set', label: 'Drop Set', icon: '📉', desc: 'Reduz a carga ao falhar para continuar a série' },
  { id: 'piramide', label: 'Pirâmide', icon: '🔺', desc: 'Aumenta a carga e reduz reps a cada série' },
  { id: 'rest_pause', label: 'Rest-Pause', icon: '⏸️', desc: 'Microdescansos dentro da própria série' },
  { id: 'circuito', label: 'Circuito', icon: '🔄', desc: 'Exercícios em sequência com mínimo descanso' },
];

/**
 * O nome que o aluno lê, a partir da chave gravada no plano.
 *
 * Devolve `null` quando não dá para responder — plano antigo sem método, ou chave que não
 * existe mais. `null` em vez de "Tradicional" porque chutar o método seria descrever ao aluno
 * um treino que ele não recebeu; a tela que chama decide se omite a informação ou não.
 */
export function nomeDoMetodo(id: string | null | undefined): string | null {
  if (!id) return null;
  return METODOS_DE_TREINO.find(m => m.id === id)?.label ?? null;
}
