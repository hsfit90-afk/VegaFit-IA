/*
  Registra cada chamada às rotas de IA (Groq) para permitir rate limiting por usuário.
  Sem isso, qualquer usuário autenticado pode chamar as rotas de IA sem limite,
  consumindo a chave do servidor (GROQ_API_KEY) às custas do dono do app.

  Tabela sem políticas de RLS para anon/authenticated: só o client service_role
  (usado no backend via utils/rate-limit.ts) consegue ler/escrever.

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_log_user_endpoint_time_idx
  ON public.ai_usage_log (user_id, endpoint, created_at);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;
