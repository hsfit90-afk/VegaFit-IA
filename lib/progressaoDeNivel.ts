// O nível do aluno sobe com a constância, em vez de ficar congelado para sempre.
//
// O QUE ESTAVA ERRADO
//
// O nível era escolhido UMA VEZ, no onboarding, e nunca mais mudava sozinho — só se a pessoa
// fosse ao Perfil e trocasse na mão, o que ninguém faz porque ninguém sabe que precisa.
//
// Isso não é cosmético: o nível corta o catálogo por exigência técnica (lib/exerciseLevel.ts).
// Quem marcou "Iniciante" no primeiro dia recebe movimento guiado PARA SEMPRE, mesmo depois
// de um ano treinando. O app trava a pessoa no degrau em que ela entrou.
//
// POR QUE ESTE DESENHO
//
// A engrenagem já existia, para outra coisa: lib/trainingUnlock.ts libera método avançado por
// meses E número de treinos. O mesmo critério vale aqui, pelo mesmo motivo — tempo sozinho
// não é adaptação, e volume concentrado em duas semanas também não.
//
// NUNCA REBAIXA. Quem se declarou avançado continua avançado, mesmo sem histórico: pode ser
// alguém que treina há dez anos e acabou de instalar o app. O nível efetivo é sempre o MAIOR
// entre o declarado e o conquistado.

export type Nivel = 'Iniciante' | 'Intermediário' | 'Avançado';

const ORDEM: Nivel[] = ['Iniciante', 'Intermediário', 'Avançado'];

const DIA_MS = 24 * 60 * 60 * 1000;
const MES_MS = 30 * DIA_MS;

/**
 * Os degraus. Exigem meses E treinos, como as fases do desbloqueio de método.
 *
 * Os números são conservadores de propósito: subir de nível ABRE exercício mais exigente, e
 * errar para cima machuca alguém. Dois meses com 16 treinos é frequência de 2x por semana
 * mantida — prova de hábito, não de pique de uma semana.
 */
export const DEGRAUS: { nivel: Nivel; meses: number; treinos: number }[] = [
  { nivel: 'Iniciante',     meses: 0, treinos: 0 },
  { nivel: 'Intermediário', meses: 2, treinos: 16 },
  { nivel: 'Avançado',      meses: 6, treinos: 60 },
];

export interface TreinoFeito {
  date: number;
  workoutPlanId?: string | null;
}

/** Normaliza o que vem do perfil: "intermediario", "INTERMEDIÁRIO", "Intermediário". */
export function normalizar(texto: string | null | undefined): Nivel {
  const t = (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  if (t.startsWith('avanc')) return 'Avançado';
  if (t.startsWith('interm')) return 'Intermediário';
  return 'Iniciante';
}

export interface EstadoDoNivel {
  declarado: Nivel;
  conquistado: Nivel;
  /** O que vale na geração: o maior dos dois. */
  efetivo: Nivel;
  /** true quando a constância passou o que a pessoa declarou — vale avisar na tela. */
  subiu: boolean;
  treinosFeitos: number;
  mesesDeApp: number;
  /** Quanto falta para o próximo degrau. null quando já está no topo. */
  proximo: { nivel: Nivel; faltamTreinos: number; faltamMeses: number } | null;
}

/**
 * Calcula o nível a partir do histórico.
 *
 * Conta só treino de força: sessão avulsa (abdominal, mobilidade, alongamento) entra no
 * histórico com o prefixo "avulso-" e NÃO prova constância em treino de força — cinco minutos
 * de abdômen não habilitam ninguém a agachamento búlgaro. Mesma regra de trainingUnlock.ts.
 */
export function calcularNivel(
  declarado: string | null | undefined,
  historico: TreinoFeito[],
  agora: number = Date.now()
): EstadoDoNivel {
  const deForca = (historico ?? []).filter(
    h => !String(h.workoutPlanId ?? '').startsWith('avulso-')
  );

  const treinosFeitos = deForca.length;
  const primeiro = deForca.length > 0 ? Math.min(...deForca.map(h => h.date)) : agora;
  const mesesDeApp = Math.max(0, (agora - primeiro) / MES_MS);

  let conquistado: Nivel = 'Iniciante';
  for (const d of DEGRAUS) {
    if (treinosFeitos >= d.treinos && mesesDeApp >= d.meses) conquistado = d.nivel;
  }

  const nivelDeclarado = normalizar(declarado);
  const efetivo = ORDEM[Math.max(ORDEM.indexOf(nivelDeclarado), ORDEM.indexOf(conquistado))];

  const indiceProximo = ORDEM.indexOf(efetivo) + 1;
  const degrauProximo = indiceProximo < ORDEM.length ? DEGRAUS[indiceProximo] : null;

  return {
    declarado: nivelDeclarado,
    conquistado,
    efetivo,
    subiu: ORDEM.indexOf(conquistado) > ORDEM.indexOf(nivelDeclarado),
    treinosFeitos,
    mesesDeApp,
    proximo: degrauProximo
      ? {
          nivel: degrauProximo.nivel,
          faltamTreinos: Math.max(0, degrauProximo.treinos - treinosFeitos),
          faltamMeses: Math.max(0, Math.ceil(degrauProximo.meses - mesesDeApp)),
        }
      : null,
  };
}

/** Frase curta para a tela, explicando onde a pessoa está e o que falta. */
export function descreverNivel(estado: EstadoDoNivel): string {
  if (!estado.proximo) return `Nível ${estado.efetivo} — você chegou ao topo da escala.`;
  const { nivel, faltamTreinos, faltamMeses } = estado.proximo;
  if (faltamTreinos === 0 && faltamMeses === 0) return `Nível ${estado.efetivo}.`;

  const partes: string[] = [];
  if (faltamTreinos > 0) partes.push(`${faltamTreinos} ${faltamTreinos === 1 ? 'treino' : 'treinos'}`);
  if (faltamMeses > 0) partes.push(`${faltamMeses} ${faltamMeses === 1 ? 'mês' : 'meses'}`);
  return `Nível ${estado.efetivo} — faltam ${partes.join(' e ')} para ${nivel}.`;
}
