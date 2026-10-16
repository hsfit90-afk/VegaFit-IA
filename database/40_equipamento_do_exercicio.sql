/*
  O EQUIPAMENTO DE CADA EXERCÍCIO, guardado em vez de deduzido.

  O PROBLEMA QUE ISTO ENCERRA

  O filtro de equipamento lê o NOME do exercício e tenta adivinhar de que aparelho ele
  precisa. Funciona na maioria, e falha de dois jeitos que já custaram caro:

    "Levantamento Terra"            não cita barra, e passava como peso corporal
    "Puxada para o Rosto de Joelhos" não cita polia, e passava como peso corporal
    "Rolando como uma Bola"          cita bola, e era cortado sem precisar de nenhuma

  Medido em 12/10/2026: dos 882 exercícios, 368 passam pelo filtro como se não precisassem de
  nada — e ninguém nunca verificou um por um. Cada vazamento foi encontrado por um aluno
  recebendo exercício que não tem como fazer.

  Não há outra fonte de verdade no banco: `equipment` é "Haltere" nas 882 linhas, `difficulty`
  é 1 em todas e `youtube_id` está vazio. O nome era o único dado existente. Esta coluna passa
  a ser o dado que faltava.

  O FORMATO

  Lista de ids, os mesmos de lib/equipamentoCasa.ts, mais 'maquina' para o que só existe em
  academia:

    halteres  barra  elastico  banco  barra_fixa  kettlebell  acessorios  maquina

  LISTA VAZIA significa peso corporal — faz em qualquer lugar. NULL significa "ainda não
  classificado", e é diferente: enquanto for NULL, o filtro continua caindo na regra por nome.
  Assim a classificação pode ser feita aos poucos, sem o app quebrar no meio.

  Um exercício pode precisar de mais de um: "Supino inclinado com halteres" precisa de banco E
  halteres, e só serve para quem tem os dois.

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS equipamento_necessario TEXT[];

/*
  Quem classificou e quando. Serve para saber no que confiar: o que a IA sugeriu e ninguém
  olhou vale menos que o que o profissional confirmou.

    'ia'          sugerido pela classificação automática, ainda não revisado
    'profissional' confirmado ou corrigido por quem tem CREF
*/
ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS equipamento_origem TEXT,
  ADD COLUMN IF NOT EXISTS equipamento_revisado_em TIMESTAMPTZ;

-- A consulta do filtro pede os não classificados e os revisados; o índice cobre os dois casos.
CREATE INDEX IF NOT EXISTS idx_exercises_equipamento_origem
  ON public.exercises (equipamento_origem);

COMMENT ON COLUMN public.exercises.equipamento_necessario IS
  'Ids de equipamento que o exercicio exige (ver lib/equipamentoCasa.ts) mais "maquina". Lista vazia = peso corporal. NULL = nao classificado, cai na regra por nome.';

COMMENT ON COLUMN public.exercises.equipamento_origem IS
  'ia = sugerido pela classificacao automatica; profissional = confirmado por quem tem CREF.';
