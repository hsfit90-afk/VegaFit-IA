-- Guarda o equipamento/local de treino escolhido na geração, junto com o plano salvo — mesmo
-- padrão de 22_workout_plan_training_method.sql, mas pra equipamento.
--
-- Sem isso, o endpoint de troca de exercício (/api/swap) não tem como saber se o aluno treina
-- em casa ou na academia, e pode sugerir um exercício de máquina pra quem não tem máquina.
--
-- COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.

ALTER TABLE public.workout_plans
ADD COLUMN IF NOT EXISTS equipment TEXT;

COMMENT ON COLUMN public.workout_plans.equipment IS
  'Equipamento/local de treino do plano (Academia completa / Halteres em casa / Barra e anilhas / Sem equipamento). Usado pelo endpoint de troca de exercício pra não sugerir substituto incompatível com o local de treino.';
