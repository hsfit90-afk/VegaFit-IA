/*
  Reconstrução de referência da migração original de "profiles", ausente do
  histórico do repositório. Gerada em 2026-08-16 a partir da introspecção do
  schema REAL em produção (via OpenAPI do PostgREST), não de suposições do
  código — reflete exatamente o que já existe hoje.

  Colunas adicionadas por migrações posteriores (role/trainer_id em
  06_b2b_roles.sql, max_clients em 08_max_clients.sql, gender/waist/hip em
  11_rcq_metrics.sql, trainer_notes em 07_trainer_notes.sql) ficam de fora
  daqui de propósito, para não duplicar o que já está documentado nelas.

  USO: documentação/baseline apenas. CREATE TABLE IF NOT EXISTS é seguro
  rodar contra o banco atual (a tabela já existe, isso não fará nada), mas
  o objetivo deste arquivo é permitir recriar o banco do zero em um
  ambiente novo (staging, disaster recovery), não ser reexecutado em produção.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  age INTEGER,
  weight NUMERIC,
  height NUMERIC,
  goal TEXT,
  level TEXT,
  intent TEXT,
  gemini_api_key TEXT,
  sound_enabled BOOLEAN DEFAULT true,
  default_rest_timer INTEGER DEFAULT 60,
  banned_exercises TEXT[],
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);
