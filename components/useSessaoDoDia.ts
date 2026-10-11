"use client";

import { useMemo } from 'react';
import { useAppContext } from '@/app/context/AppContext';

/**
 * Qual é o treino de força do dia, e quais grupos ele carrega.
 *
 * POR QUE EXISTE
 *
 * Mobilidade e alongamento deixaram de ser listas genéricas: a prescrição do profissional
 * (CREF, 11/10/2026) é que as duas telas sugiram o que serve PARA O TREINO DE HOJE —
 * mobilidade nas articulações que vão ser usadas, alongamento nos grupos que vão ser
 * treinados. As duas telas precisam da mesma resposta, então ela mora num lugar só.
 *
 * A sessão é a mesma que o dashboard oferece: `currentSessionIndex` do AppContext, que anda
 * sozinho conforme o aluno completa treino. Se ele trocar de dia manualmente no dashboard,
 * aqui continua mostrando o da rotação — a alternativa seria sincronizar um estado de tela
 * com outro, e o ganho não paga a complexidade.
 *
 * Devolve `null` quando não há plano ativo. Nesse caso as telas voltam a ser a lista inteira,
 * que é o comportamento certo: sem treino marcado, não existe "o treino de hoje".
 */
export interface SessaoDoDia {
  nome: string;
  /** Grupos musculares da sessão, sem repetição, na ordem em que aparecem. */
  grupos: string[];
}

export function useSessaoDoDia(): SessaoDoDia | null {
  const { workoutPlans, activePlanId, currentSessionIndex } = useAppContext();

  return useMemo(() => {
    const plano = workoutPlans.find(p => p.id === activePlanId) ?? workoutPlans[0];
    if (!plano?.sessions?.length) return null;

    const sessao = plano.sessions[currentSessionIndex % plano.sessions.length];
    if (!sessao) return null;

    const grupos: string[] = [];
    for (const ex of sessao.exercises ?? []) {
      const g = (ex.muscleGroup || '').trim();
      // Comparação sem caixa: o catálogo tem "PEITO" em plano antigo e "Peito" em plano novo,
      // e listar os dois mostraria o mesmo grupo duas vezes na tela.
      if (g && !grupos.some(j => j.toLowerCase() === g.toLowerCase())) grupos.push(g);
    }

    return { nome: sessao.name, grupos };
  }, [workoutPlans, activePlanId, currentSessionIndex]);
}
