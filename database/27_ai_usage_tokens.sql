/*
  Consumo REAL de tokens por chamada de IA.

  Até aqui o throttle global (utils/rate-limit.ts) somava uma ESTIMATIVA fixa por rota
  (treino = 5000) para decidir se havia capacidade na janela de 60s. Duas consequências
  medidas em produção:

    1. Com orçamento de 6400 tokens e estimativa de 5000, a SEGUNDA geração de treino em
       qualquer janela de 60s era sempre recusada — o teto real do app era 1 treino por
       minuto, somando todos os usuários.
    2. A linha era inserida ANTES da chamada ao Groq, então requisições que falhavam
       (chave ausente, 401, erro de validação) gastavam orçamento sem consumir um único
       token de verdade.

  Com esta coluna a estimativa vira apenas uma RESERVA, reconciliada com
  response.usage.total_tokens quando a chamada dá certo e apagada quando falha.

  NULL = linha antiga, anterior a esta migração: o código cai de volta na estimativa.

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

ALTER TABLE public.ai_usage_log
ADD COLUMN IF NOT EXISTS tokens INTEGER;

-- O throttle global varre TODAS as linhas da última janela de 60s, sem filtrar por usuário.
-- O índice existente começa por user_id e não serve para essa varredura.
CREATE INDEX IF NOT EXISTS ai_usage_log_time_idx
  ON public.ai_usage_log (created_at DESC);
