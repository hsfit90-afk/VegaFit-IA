-- Permite que o Master edite qualquer exercício da biblioteca (inclusive os globais,
-- user_id IS NULL), não só os que ele mesmo cadastrou.
--
-- Mesmo problema da policy de DELETE (ver 16_exercises_master_delete.sql): a policy
-- "Users can update own exercises" só permitia editar onde user_id = auth.uid(), então
-- corrigir o grupo muscular de um exercício global (ex: um exercício de cardio classificado
-- errado como "Peito") falhava silenciosamente — sem erro, mas sem alterar nada no banco.
--
-- COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.

DROP POLICY IF EXISTS "Users can update own exercises" ON public.exercises;
DROP POLICY IF EXISTS "Only master can update exercises" ON public.exercises;

CREATE POLICY "Only master can update exercises"
ON public.exercises FOR UPDATE
USING (
  auth.role() = 'service_role'
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'master'
);
