-- Início do ciclo de periodização do plano, ancorado no ALUNO (ver lib/periodization.ts).
--
-- Antes, a semana atual era calculada a partir de created_at do plano, em dias corridos:
--   - personal montava na segunda, aluno começava na quinta -> já perdia 3 dias da semana 1;
--   - aluno sumia 3 semanas e voltava direto na semana 4 (deload) sem ter treinado;
--   - depois da semana 4 o cálculo travava (Math.min) e o aluno ficava em deload pra sempre.
--
-- Agora a tela de treino grava aqui o timestamp do PRIMEIRO treino do plano, e regrava quando o
-- aluno volta depois de 14+ dias parado (reset pra semana 1). NULL em planos antigos: o cálculo
-- cai no primeiro registro de workout_history e persiste a âncora deduzida na primeira abertura.

ALTER TABLE public.workout_plans
ADD COLUMN IF NOT EXISTS cycle_started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.workout_plans.cycle_started_at IS
  'Início do ciclo de periodização atual. Gravado no primeiro treino do plano e regravado em reset por inatividade (14+ dias). NULL = plano ainda não iniciado ou anterior a esta regra.';
