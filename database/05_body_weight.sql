-- Criação da tabela para histórico de peso corporal

CREATE TABLE public.body_weight_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weight NUMERIC NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configura Row Level Security (RLS) para proteger os dados
ALTER TABLE public.body_weight_history ENABLE ROW LEVEL SECURITY;

-- Política: Usuário só pode ler seus próprios registros de peso
CREATE POLICY "Users can view their own body weight history"
ON public.body_weight_history FOR SELECT
USING (auth.uid() = user_id);

-- Política: Usuário só pode inserir seus próprios registros de peso
CREATE POLICY "Users can insert their own body weight history"
ON public.body_weight_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política: Usuário só pode atualizar seus próprios registros
CREATE POLICY "Users can update their own body weight history"
ON public.body_weight_history FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política: Usuário só pode deletar seus próprios registros
CREATE POLICY "Users can delete their own body weight history"
ON public.body_weight_history FOR DELETE
USING (auth.uid() = user_id);
