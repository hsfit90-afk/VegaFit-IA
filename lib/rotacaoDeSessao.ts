// Em que dia do plano o aluno parou.
//
// O BUG QUE ISTO CORRIGE
//
// Trocar de plano zerava a rotação (`setCurrentSessionIndex(0)` em AppContext). O índice é
// guardado por USUÁRIO, não por plano — `user_session_index` tem `user_id` como chave
// primária —, então não havia onde lembrar o ponto de cada um.
//
// Na prática, quem tem dois planos fazia Treino A, trocava, Treino A de novo, trocava de
// volta, Treino A outra vez. Peito a vida inteira, e o dia de perna nunca chegava.
//
// POR QUE DERIVAR EM VEZ DE GUARDAR
//
// O dado já existe: o histórico registra qual sessão foi feita em qual plano. Guardar um
// índice por plano exigiria migration, uma coluna nova e mais um estado para ficar
// dessincronizado. Derivar do histórico não pode divergir da realidade, porque É a realidade.
//
// E se auto-corrige: um plano editado, com dias a mais ou a menos, continua retomando no
// lugar certo, porque a conta é feita sobre as sessões que o plano tem AGORA.

export interface SessaoDoPlano {
  id?: string;
  name?: string;
}

export interface TreinoNoHistorico {
  workoutPlanId?: string | null;
  sessionId?: string | null;
  sessionName?: string | null;
  date: number;
}

/**
 * O índice da PRÓXIMA sessão de um plano, a partir do que já foi feito nele.
 *
 * Plano nunca treinado começa no 0. Sessão que não existe mais no plano (porque ele foi
 * editado) também cai no 0, que é o único palpite honesto.
 */
export function proximaSessaoDoPlano(
  planoId: string,
  sessoes: SessaoDoPlano[],
  historico: TreinoNoHistorico[]
): number {
  if (!sessoes?.length) return 0;

  const doPlano = (historico ?? [])
    .filter(h => h.workoutPlanId === planoId && Number.isFinite(h.date))
    .sort((a, b) => b.date - a.date);

  if (doPlano.length === 0) return 0;

  const ultima = doPlano[0];

  // Por id primeiro; por nome como rede, porque histórico antigo pode ter gravado a sessão
  // sem id — o mesmo cuidado que o bloco de aquecimento já toma com a mídia.
  let indice = ultima.sessionId
    ? sessoes.findIndex(s => s.id === ultima.sessionId)
    : -1;

  if (indice < 0 && ultima.sessionName) {
    indice = sessoes.findIndex(
      s => (s.name ?? '').trim().toLowerCase() === ultima.sessionName!.trim().toLowerCase()
    );
  }

  if (indice < 0) return 0;

  return (indice + 1) % sessoes.length;
}
