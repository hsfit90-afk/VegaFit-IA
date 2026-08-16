/*
  Reconstrução de referência da migração original de "workout_plans" e
  "workout_history", ausente do histórico do repositório. Gerada em
  2026-08-16 a partir da introspecção do schema REAL em produção (via
  OpenAPI do PostgREST), não de suposições do código.

  Colunas de rotina adicionadas por 10_routines.sql (start_date, end_date,
  routine_type, etc.) ficam de fora daqui de propósito — ver aquele arquivo.

  USO: documentação/baseline apenas, para recriar o banco do zero em um
  ambiente novo. Seguro rodar contra produção (IF NOT EXISTS), mas as
  tabelas já existem lá.
*/

CREATE TABLE IF NOT EXISTS public.workout_plans (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  split TEXT,
  sessions JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own workout plans" ON public.workout_plans;
CREATE POLICY "Users can manage own workout plans"
ON public.workout_plans FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.workout_history (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_plan_id UUID REFERENCES public.workout_plans(id) ON DELETE SET NULL,
  workout_plan_name TEXT,
  session_id TEXT,
  session_name TEXT,
  duration_seconds INTEGER,
  total_volume NUMERIC,
  exercises JSONB NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.workout_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own workout history" ON public.workout_history;
CREATE POLICY "Users can manage own workout history"
ON public.workout_history FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
