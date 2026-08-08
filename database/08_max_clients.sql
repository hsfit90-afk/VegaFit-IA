-- Adicionar limite de alunos para o personal trainer
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_clients INT DEFAULT 5;
