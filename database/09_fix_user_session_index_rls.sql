-- Corrige as permissoes de seguranca (RLS) para o indice de sessao do usuario
ALTER TABLE public.user_session_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own session index" ON public.user_session_index;
DROP POLICY IF EXISTS "Users can insert their own session index" ON public.user_session_index;
DROP POLICY IF EXISTS "Users can update their own session index" ON public.user_session_index;
DROP POLICY IF EXISTS "Users can manage their own session index" ON public.user_session_index;

CREATE POLICY "Users can manage their own session index"
ON public.user_session_index
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
