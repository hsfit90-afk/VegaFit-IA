-- 1. Adicionar colunas de Papel (Role) e Trainer ID
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client',
ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Garanta que o RLS está ativo
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para MASTER (Acesso Total a tudo na tabela de profiles)
-- O Master pode ver todos
CREATE POLICY "Master can view all profiles"
ON public.profiles FOR SELECT
USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'master' );

-- O Master pode atualizar todos
CREATE POLICY "Master can update all profiles"
ON public.profiles FOR UPDATE
USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'master' );

-- O Master pode deletar todos
CREATE POLICY "Master can delete all profiles"
ON public.profiles FOR DELETE
USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'master' );

-- 3. Políticas para TRAINER (Acesso aos seus alunos)
-- O Trainer pode ver os alunos cujo trainer_id seja o dele
CREATE POLICY "Trainer can view own clients"
ON public.profiles FOR SELECT
USING ( trainer_id = auth.uid() );

-- O Trainer pode atualizar os perfis dos seus alunos
CREATE POLICY "Trainer can update own clients"
ON public.profiles FOR UPDATE
USING ( trainer_id = auth.uid() );

-- 4. O mesmo conceito para os Treinos e Histórico (Se quiser que o Master/Trainer veja)
-- (Exemplo para workout_plans)
CREATE POLICY "Master can view all workout_plans"
ON public.workout_plans FOR SELECT
USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'master' );

CREATE POLICY "Trainer can view client workout_plans"
ON public.workout_plans FOR SELECT
USING ( user_id IN (SELECT id FROM public.profiles WHERE trainer_id = auth.uid()) );

CREATE POLICY "Trainer can insert client workout_plans"
ON public.workout_plans FOR INSERT
WITH CHECK ( user_id IN (SELECT id FROM public.profiles WHERE trainer_id = auth.uid()) OR user_id = auth.uid() );

CREATE POLICY "Trainer can update client workout_plans"
ON public.workout_plans FOR UPDATE
USING ( user_id IN (SELECT id FROM public.profiles WHERE trainer_id = auth.uid()) );

CREATE POLICY "Trainer can delete client workout_plans"
ON public.workout_plans FOR DELETE
USING ( user_id IN (SELECT id FROM public.profiles WHERE trainer_id = auth.uid()) );

-- ATENÇÃO: Para se tornar um "master", você precisará rodar este comando manualmente 
-- no SQL Editor do Supabase substituindo 'SEU_USER_ID' pelo ID do seu usuário:
-- UPDATE public.profiles SET role = 'master' WHERE id = 'SEU_USER_ID';
