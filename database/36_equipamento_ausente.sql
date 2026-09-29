/*
  O QUE A ACADEMIA DO ALUNO NAO TEM.

  Complementa o "local de treino" (academia completa / halteres em casa / barra / peso
  corporal), que decide o TIPO de lugar. Isto e a camada fina: dentro de uma academia
  completa, cada uma tem um conjunto diferente de aparelhos.

  POR QUE GUARDAR O QUE FALTA, E NAO O QUE TEM

  Campo vazio precisa significar "recebe tudo", que e o comportamento de hoje e o certo para
  a maioria. Se a lista fosse do que TEM, o vazio significaria "nao tem nada" e quebraria o
  treino de todo aluno que ignorasse a tela -- e ela e opcional de proposito.

  E OPCIONAL, E FORA DA ANAMNESE

  A anamnese ja tem 48 perguntas. Somar dez caixas ali aumentaria a desistencia no cadastro
  para resolver um problema que nem todo aluno tem. Fica no Perfil, para quem quiser ajustar
  depois de perceber que um aparelho nao existe na academia dele.

  NAO CUSTA IA: o corte acontece no codigo, antes de montar o prompt.

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipamentos_ausentes TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.profiles.equipamentos_ausentes IS
  'Ids dos aparelhos que a academia do aluno NAO tem (ver lib/equipamentoAusente.ts). Vazio = recebe o catalogo completo.';
