-- Adicionar colunas para cálculo do RCQ (Relação Cintura-Quadril) e saúde geral
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS waist NUMERIC,
ADD COLUMN IF NOT EXISTS hip NUMERIC;
