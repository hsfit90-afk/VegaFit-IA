import type { SupabaseClient } from '@supabase/supabase-js';

export interface AnamneseAnswers {
  lesoes?: string;
  condicoes?: string;
  medicamentos?: string;
  liberacao?: string;
  restricoes?: string;
  [key: string]: any;
}

// Busca a anamnese mais recente do usuário — centraliza aqui o fetch que toda rota de IA que
// gera conteúdo pro aluno (treino, coach, troca de exercício, nutrição, progressão) precisa fazer
// antes de responder, pra não esquecer de novo. Isso já aconteceu 2x nesta sessão: /api/swap e
// /api/nutrition foram ao ar sem nenhuma checagem de lesão/condição médica/restrição alimentar,
// e só foram corrigidos numa varredura manual depois. Centralizar não impede 100% que aconteça de
// novo numa rota futura, mas torna óbvio e fácil de achar o jeito certo de buscar esse dado.
export async function fetchLatestAnamneseAnswers(
  supabase: SupabaseClient,
  userId: string
): Promise<AnamneseAnswers | undefined> {
  const { data } = await supabase
    .from('anamnese_history')
    .select('answers')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);

  return data?.[0]?.answers as AnamneseAnswers | undefined;
}
