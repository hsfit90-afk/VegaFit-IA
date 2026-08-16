/*
  Guarda cada anamnese como um snapshot imutável (append-only), em vez de
  sobrescrever só o campo profiles.intent. Permite comparar como as
  respostas (peso, cintura, quadril, etc.) mudaram entre uma anamnese e a
  próxima.

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

CREATE TABLE public.anamnese_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  summary_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_anamnese_history_user_date ON public.anamnese_history(user_id, created_at DESC);

ALTER TABLE public.anamnese_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own anamnese history"
ON public.anamnese_history FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own anamnese history"
ON public.anamnese_history FOR INSERT
WITH CHECK (auth.uid() = user_id);
