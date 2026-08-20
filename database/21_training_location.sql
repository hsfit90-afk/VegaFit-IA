-- Guarda o "local de treino" respondido na anamnese como coluna própria em profiles,
-- pra poder pré-preencher o equipamento no gerador de IA em vez de sempre cair em
-- "Academia completa" fixo, não importa o que o aluno respondeu na anamnese.
--
-- COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS training_location TEXT;

COMMENT ON COLUMN public.profiles.training_location IS
  'Local de treino respondido na anamnese (Academia completa / Casa com equipamentos / Casa sem equipamentos / Ar livre / parque). Usado pra pré-preencher e restringir o equipamento no gerador de treino IA.';
