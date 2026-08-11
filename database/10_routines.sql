-- Adicionar campos para suportar Rotinas de Treino no painel do treinador
-- Esses campos complementam a tabela workout_plans existente

ALTER TABLE public.workout_plans
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS routine_type TEXT DEFAULT 'Hipertrofia',
ADD COLUMN IF NOT EXISTS difficulty_level TEXT DEFAULT 'Intermediário',
ADD COLUMN IF NOT EXISTS workout_type TEXT DEFAULT 'Numérico',
ADD COLUMN IF NOT EXISTS show_to_student BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_archive BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS general_guidelines TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Índice para buscar rotinas por aluno e status
CREATE INDEX IF NOT EXISTS idx_workout_plans_user_status 
ON public.workout_plans(user_id, status);

-- Índice para buscar rotinas criadas por treinador
CREATE INDEX IF NOT EXISTS idx_workout_plans_trainer 
ON public.workout_plans(trainer_id);
