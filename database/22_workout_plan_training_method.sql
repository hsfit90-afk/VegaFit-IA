-- Guarda o método de treino (tradicional/superset/drop_set/piramide/rest_pause/circuito)
-- escolhido na geração, junto com o plano salvo.
--
-- Antes, esse dado era descartado logo depois da geração — a tela de treino ativo nunca
-- sabia qual método foi escolhido, então Superset/Rest-Pause/Circuito não tinham nenhuma
-- mecânica real no app (só apareciam como texto na dica do exercício).
--
-- COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.

ALTER TABLE public.workout_plans
ADD COLUMN IF NOT EXISTS training_method TEXT;

COMMENT ON COLUMN public.workout_plans.training_method IS
  'Método de treino do plano (tradicional/superset/drop_set/piramide/rest_pause/circuito). Usado pela tela de treino ativo pra aplicar a mecânica certa (ex: suprimir descanso entre exercícios pareados no superset).';
