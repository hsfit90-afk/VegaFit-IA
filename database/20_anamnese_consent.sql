-- Adiciona registro de consentimento explícito na anamnese (dado sensível de saúde, LGPD Art. 11).
-- Cada submissão de anamnese passa a guardar quando o usuário confirmou o consentimento — serve
-- como prova em caso de auditoria/solicitação do titular dos dados.
--
-- COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.

ALTER TABLE public.anamnese_history
ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.anamnese_history.consent_accepted_at IS
  'Timestamp de quando o usuário marcou o checkbox de consentimento explícito para tratamento de dados de saúde (LGPD Art. 11). NULL = anamnese antiga, anterior à introdução do consentimento explícito.';
