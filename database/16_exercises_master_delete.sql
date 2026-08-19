-- Restringe a exclusão de exercícios da biblioteca apenas para contas MASTER.
--
-- Antes, a policy "Users can delete own exercises" só permitia apagar exercícios onde
-- user_id = auth.uid() — ou seja, exercícios GLOBAIS (user_id IS NULL, a maioria do catálogo
-- inicial) nunca podiam ser apagados por ninguém, nem pelo Master. Como RLS filtra a linha
-- ANTES do DELETE rodar, o Supabase não retorna erro nesse caso: o delete "roda com sucesso"
-- mas apaga 0 linhas, então a UI achava que tinha excluído e o exercício continuava no banco.
--
-- COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.

DROP POLICY IF EXISTS "Users can delete own exercises" ON public.exercises;
DROP POLICY IF EXISTS "Only master can delete exercises" ON public.exercises;

CREATE POLICY "Only master can delete exercises"
ON public.exercises FOR DELETE
USING (
  auth.role() = 'service_role'
  OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'master'
);
