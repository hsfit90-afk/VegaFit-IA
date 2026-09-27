/*
  ASSINATURA: status, plano e vínculo com o gateway (Mercado Pago).

  ─────────────────────────────────────────────────────────────────────────────
  A ORDEM DOS COMANDOS É O QUE PROTEGE QUEM JÁ USA O APP. NÃO REORDENE.
  ─────────────────────────────────────────────────────────────────────────────

  No Postgres, `ADD COLUMN ... DEFAULT x` aplica o valor às linhas QUE JÁ EXISTEM.
  Então:

    1. A coluna nasce com DEFAULT 'cortesia'  -> todo mundo que já tem conta vira cortesia.
    2. Só DEPOIS o padrão muda para 'trial'   -> só quem se cadastrar daqui pra frente
                                                 entra no teste de 7 dias.

  Se a coluna nascesse com DEFAULT 'trial', seus testadores atuais virariam trial e seriam
  cortados em 7 dias — exatamente o que não pode acontecer.

  POR QUE ISSO BASTA PARA PROTEGÊ-LOS

  O perfil não é criado por trigger: nasce do upsert do cliente em
  app/context/AppContext.tsx:193, que envia uma LISTA EXPLÍCITA de colunas e não inclui
  nenhuma das colunas abaixo. No PostgREST, um upsert com lista explícita gera
  `ON CONFLICT DO UPDATE SET` apenas para as colunas enviadas — as omitidas mantêm o valor
  no caminho de UPDATE, e recebem o DEFAULT no caminho de INSERT. É o comportamento que
  queremos nos dois casos:

    aluno que já existe salva o perfil  -> subscription_status continua 'cortesia'
    aluno novo termina o onboarding    -> subscription_status nasce 'trial'

  A proteção contra o aluno alterar a própria assinatura por PATCH direto na API do
  Supabase está na migration 34 — o RLS sozinho não resolve, porque ele legitimamente
  permite que a pessoa atualize a própria linha.

  ESTADOS

    cortesia   acesso permanente, nunca vê paywall. Os testadores atuais, e o valor que
               você usa para liberar alguém manualmente (cortesia, parceria, suporte).
    trial      teste gratuito. Tem acesso até trial_ends_at.
    ativo      assinatura paga. Tem acesso até subscription_expires_at.
    cancelado  pediu cancelamento. Mantém acesso até o fim do período já pago.
    vencido    pagamento falhou ou período acabou. Sem geração nova de IA.

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

-- PASSO 1 — nasce cortesia. Isto backfilla TODAS as contas existentes.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'cortesia';

-- Demais colunas nascem nulas para quem já existe: quem é cortesia não usa nenhuma delas.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT,
  ADD COLUMN IF NOT EXISTS gateway TEXT,
  ADD COLUMN IF NOT EXISTS gateway_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS gateway_subscription_id TEXT;

-- PASSO 2 — a partir daqui, conta nova entra em teste de 7 dias.
ALTER TABLE public.profiles ALTER COLUMN subscription_status SET DEFAULT 'trial';
ALTER TABLE public.profiles ALTER COLUMN trial_ends_at
  SET DEFAULT (timezone('utc'::text, now()) + interval '7 days');

-- Estados válidos. Sem isto, um typo no webhook grava lixo e o aluno perde acesso sem motivo.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('cortesia', 'trial', 'ativo', 'vencido', 'cancelado'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_plan_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_plan_check
  CHECK (subscription_plan IS NULL OR subscription_plan IN ('mensal', 'anual'));

-- O webhook chega com o id da assinatura do gateway e precisa achar o perfil por ele.
CREATE INDEX IF NOT EXISTS idx_profiles_gateway_subscription
  ON public.profiles (gateway_subscription_id)
  WHERE gateway_subscription_id IS NOT NULL;

COMMENT ON COLUMN public.profiles.subscription_status IS
  'cortesia (acesso permanente) | trial | ativo | cancelado | vencido. Só o backend com service_role escreve — ver migration 34.';

-- CONFERÊNCIA: rode e confirme que TODAS as contas atuais estão em cortesia e que
-- nenhuma tem trial_ends_at preenchido.
--
--   SELECT subscription_status, COUNT(*), COUNT(trial_ends_at) AS com_trial
--   FROM public.profiles GROUP BY 1;
--
-- Esperado: uma única linha, cortesia, com_trial = 0.
