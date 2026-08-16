/*
  Reconstrução de referência da migração original de "user_session_index",
  ausente do histórico do repositório. Gerada em 2026-08-16 a partir da
  introspecção do schema REAL em produção (via OpenAPI do PostgREST).
  A correção de RLS desta tabela está em 09_fix_user_session_index_rls.sql.

  USO: documentação/baseline apenas, para recriar o banco do zero em um
  ambiente novo. Seguro rodar contra produção (IF NOT EXISTS), mas a
  tabela já existe lá.
*/

CREATE TABLE IF NOT EXISTS public.user_session_index (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_session_index INTEGER DEFAULT 0
);

ALTER TABLE public.user_session_index ENABLE ROW LEVEL SECURITY;
