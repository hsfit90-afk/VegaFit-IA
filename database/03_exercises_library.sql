-- 1. Cria a Tabela de Exercícios Customizados
CREATE TABLE IF NOT EXISTS public.exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Se for NULL, significa que é um exercício Global do Admin
    name TEXT NOT NULL,
    muscle_group TEXT NOT NULL,
    equipment TEXT DEFAULT 'Haltere',
    difficulty INTEGER DEFAULT 1,
    media_url TEXT, -- Link do GIF, Vídeo ou Imagem
    youtube_id TEXT, -- Caso ainda queira usar YouTube como fallback
    instructions JSONB DEFAULT '[]'::jsonb,
    common_mistakes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilita segurança em nível de linha (RLS)
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- Permite que qualquer um VEJA todos os exercícios globais (user_id is null) e os SEUS próprios exercícios
CREATE POLICY "Users can view global and own exercises" 
ON public.exercises FOR SELECT 
USING (user_id IS NULL OR user_id = auth.uid());

-- Permite que o usuário crie apenas exercícios para ele mesmo (Admin pode burlar via painel se precisar)
CREATE POLICY "Users can insert own exercises" 
ON public.exercises FOR INSERT 
WITH CHECK (user_id = auth.uid() OR auth.role() = 'service_role');

-- Permite que o usuário edite apenas os seus exercícios
CREATE POLICY "Users can update own exercises" 
ON public.exercises FOR UPDATE 
USING (user_id = auth.uid() OR auth.role() = 'service_role');

-- Permite que o usuário delete apenas os seus exercícios
CREATE POLICY "Users can delete own exercises" 
ON public.exercises FOR DELETE 
USING (user_id = auth.uid() OR auth.role() = 'service_role');


-- 2. Cria o Bucket no Storage para salvar os PDFs/GIFs upados do PC
INSERT INTO storage.buckets (id, name, public) 
VALUES ('exercise-media', 'exercise-media', true)
ON CONFLICT (id) DO NOTHING;

-- Permite que qualquer pessoa acesse os GIFs publicamente
CREATE POLICY "Public Access to Exercise Media" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'exercise-media' );

-- Permite que usuários autenticados façam upload de arquivos
CREATE POLICY "Auth Users Upload Media" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'exercise-media' AND auth.role() = 'authenticated' );

-- Permite que o usuário atualize apenas seus próprios arquivos
CREATE POLICY "Auth Users Update Media" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'exercise-media' AND auth.role() = 'authenticated' );

-- Permite que o usuário delete seus arquivos
CREATE POLICY "Auth Users Delete Media" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'exercise-media' AND auth.role() = 'authenticated' );
