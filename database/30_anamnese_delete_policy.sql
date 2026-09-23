/*
  Achado A3 da auditoria: o titular não consegue apagar os próprios dados de saúde.

  `anamnese_history` tinha apenas políticas de SELECT e INSERT (database/14_anamnese_history.sql).
  Na prática, o usuário só conseguia EMPILHAR uma anamnese nova — a antiga, com a condição
  médica que ele quer remover, ficava no banco para sempre. A única saída era apagar a conta
  inteira.

  Isso toca dois direitos do art. 18 da LGPD:
    - inciso III, correção de dado incompleto ou desatualizado
    - inciso VI, eliminação de dado tratado com base em consentimento

  E a anamnese é justamente dado tratado por consentimento (art. 11, I), como a própria
  política de privacidade do app declara.

  Só DELETE, sem UPDATE, de propósito: a anamnese é um histórico datado, e reescrever uma
  entrada passada falsearia o registro. Corrigir = preencher uma nova; remover = apagar a
  antiga. O app já sabe ler sempre a mais recente (lib/aiHealthContext.ts).

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

CREATE POLICY "Users can delete their own anamnese history"
ON public.anamnese_history FOR DELETE
USING (auth.uid() = user_id);

/*
  Falta a TELA para o usuário exercer isso — a política sozinha não aparece para ele.
  O lugar natural é app/anamnese/history/page.tsx, com confirmação (ConfirmDialog já existe).
  Enquanto a tela não existe, o direito fica exercível apenas por solicitação manual.
*/
