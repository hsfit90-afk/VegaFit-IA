-- Exercícios favoritos do aluno — espelho de banned_exercises (01_profiles_baseline.sql).
--
-- Usado em três lugares:
--   1. Coração nos cards (biblioteca e treino ativo) — vínculo do aluno com o app.
--   2. Geração de treino (app/api/treino): a IA é instruída a priorizar favoritos quando couber.
--   3. Troca de exercício (app/active): se há favorito do mesmo grupo muscular fora do treino de
--      hoje, oferece direto — sem chamada de IA, resposta instantânea.
--
-- Guarda IDs da tabela exercises, como banned_exercises. Mesma política de RLS: a coluna vive
-- em profiles, que já só permite ao dono ler/escrever a própria linha.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS favorite_exercises TEXT[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.profiles.favorite_exercises IS
  'IDs de exercises favoritados pelo aluno. Priorizados na geração de treino e usados como primeira opção na troca de exercício (sem IA).';
