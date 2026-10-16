/*
  ONDE O EXERCÍCIO DEVE SER PRESCRITO: casa, academia, ou os dois.

  POR QUE ISTO NÃO É A MESMA COISA QUE equipamento_necessario

  A coluna de equipamento responde "o aluno CONSEGUE fazer?". Esta responde "o profissional
  QUER prescrever aqui?". São perguntas diferentes, e só a segunda é opinião dele.

  Flexão de braço é o exemplo: cabe nos dois lugares pelo equipamento (não precisa de nada),
  mas na academia existe supino, e um profissional pode preferir não prescrever flexão para
  quem tem a academia inteira à disposição. Pelo equipamento isso é indistinguível; pelo
  contexto, não.

  OS TRÊS VALORES

    'casa'      só para quem treina em casa
    'academia'  só para quem treina na academia
    'ambos'     serve nos dois

  NULL significa "não definido", e aí o contexto é DEDUZIDO do equipamento: exercício que
  exige 'maquina' é de academia, o resto é ambos. É o comportamento que já existia antes
  desta coluna, então nada muda até alguém marcar — e exercício novo continua funcionando no
  dia em que entra no catálogo.

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS contexto TEXT;

/*
  Sem CHECK constraint de propósito.

  Um valor fora da lista não pode travar a escrita no catálogo — e não trava nada mesmo: quem
  lê (lib/equipamentoCasa.ts) só reconhece os três valores e trata qualquer outra coisa como
  NULL, caindo na dedução pelo equipamento. Errar para o comportamento antigo é mais seguro
  que errar para uma escrita recusada.
*/

CREATE INDEX IF NOT EXISTS idx_exercises_contexto
  ON public.exercises (contexto);

COMMENT ON COLUMN public.exercises.contexto IS
  'Onde o exercicio deve ser prescrito: casa, academia ou ambos. NULL = deduz do equipamento (maquina -> academia, resto -> ambos). Diferente de equipamento_necessario, que diz o que ele EXIGE.';
