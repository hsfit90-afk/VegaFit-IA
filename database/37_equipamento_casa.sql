/*
  O QUE O ALUNO TEM EM CASA.

  Espelho invertido da migration 36 (equipamentos_ausentes), e a inversao e proposital:

    ACADEMIA  marca o que FALTA. Vazio = recebe tudo, que e o caso da maioria. Opcional.
    CASA      marca o que TEM.   Vazio = so peso corporal, que e o caso da maioria.
              OBRIGATORIO: sem isso a IA nao sabe se a pessoa tem dois halteres ou uma
              academia na garagem, e chuta.

  SUBSTITUI UM CAMPO QUE NINGUEM LIA

  A anamnese ja perguntava "Equipamentos disponiveis (se treina em casa)" como TEXTO LIVRE,
  com placeholder "Ex: Halteres ate 20kg, elastico". O aluno respondia e aquilo nunca saia do
  banco -- nenhuma rota lia o campo. Texto livre nao vira filtro; caixa marcada vira.

  NAO CUSTA IA: o corte acontece no servidor, antes de montar o prompt.

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipamentos_casa TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.profiles.equipamentos_casa IS
  'Ids do que o aluno TEM em casa (ver lib/equipamentoCasa.ts). Vazio = so peso corporal.';
