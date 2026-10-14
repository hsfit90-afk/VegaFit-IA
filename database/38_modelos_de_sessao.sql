/*
  MODELOS DE SESSÃO: o profissional salva um dia de treino e reusa nos próximos alunos.

  POR QUE EXISTE

  O Treino do Personal é montado à mão, e dez alunos com perfis parecidos recebem treinos
  parecidos. Hoje cada um é digitado do zero — mesmos exercícios, mesmas séries, mesmas
  observações. Salvar o dia uma vez e carregar depois é o que faz dez treinos por mês caberem
  numa agenda que também atende aluno presencial.

  ORGANIZADO POR OBJETIVO, por decisão do profissional (CREF, 14/10/2026). É a primeira
  pergunta que ele se faz ao abrir o montador — "este aluno é de hipertrofia ou
  emagrecimento?" —, e é o que mais muda séries, repetições e descanso.

  POR QUE NÃO TEM user_id DE ALUNO

  O modelo é do PROFISSIONAL, não de um aluno. Pertence a quem criou (master_id) e é aplicado
  a quem ele quiser. Guardar por aluno faria cada modelo nascer preso ao primeiro que o
  recebeu, que é o contrário da ideia.

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

CREATE TABLE IF NOT EXISTS public.modelos_de_sessao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  nome TEXT NOT NULL,
  objetivo TEXT NOT NULL,

  -- Observação opcional do próprio profissional, para ele lembrar quando usar este modelo.
  -- Não vai para o aluno.
  nota TEXT,

  /*
    Os exercícios do dia, no mesmo formato que o montador usa: name, muscleGroup, sets, reps,
    restSeconds, tips. Fica em JSONB e não em tabela filha porque é lido e gravado sempre
    inteiro, nunca por exercício — e uma tabela filha custaria join e ordem explícita para
    ganhar nada.

    SEM exerciseId de propósito: o modelo guarda o NOME, e o montador reencontra o id no
    catálogo ao carregar. Assim um exercício recadastrado não transforma o modelo em linha
    vazia, e o modelo sobrevive a mudanças no catálogo.
  */
  exercicios JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- A consulta que a tela faz: os modelos deste profissional, do objetivo escolhido, recentes
-- primeiro.
CREATE INDEX IF NOT EXISTS idx_modelos_master_objetivo
  ON public.modelos_de_sessao (master_id, objetivo, created_at DESC);

ALTER TABLE public.modelos_de_sessao ENABLE ROW LEVEL SECURITY;

/*
  Só o dono enxerga e mexe. Não há policy para aluno nenhum: modelo é material de trabalho do
  profissional, e nada no app do aluno precisa ler isto.

  A checagem de que o dono é master acontece na rota de admin, como nas outras — aqui a RLS
  garante o isolamento entre contas, que é o que a RLS sabe fazer bem.
*/
DROP POLICY IF EXISTS "dono le os proprios modelos" ON public.modelos_de_sessao;
CREATE POLICY "dono le os proprios modelos"
  ON public.modelos_de_sessao FOR SELECT
  USING (auth.uid() = master_id);

DROP POLICY IF EXISTS "dono cria os proprios modelos" ON public.modelos_de_sessao;
CREATE POLICY "dono cria os proprios modelos"
  ON public.modelos_de_sessao FOR INSERT
  WITH CHECK (auth.uid() = master_id);

DROP POLICY IF EXISTS "dono edita os proprios modelos" ON public.modelos_de_sessao;
CREATE POLICY "dono edita os proprios modelos"
  ON public.modelos_de_sessao FOR UPDATE
  USING (auth.uid() = master_id)
  WITH CHECK (auth.uid() = master_id);

/*
  DELETE existe aqui, ao contrário da tabela de pedidos: modelo não é registro financeiro nem
  histórico de ninguém. É rascunho de trabalho, e rascunho ruim tem que poder ir embora.
*/
DROP POLICY IF EXISTS "dono apaga os proprios modelos" ON public.modelos_de_sessao;
CREATE POLICY "dono apaga os proprios modelos"
  ON public.modelos_de_sessao FOR DELETE
  USING (auth.uid() = master_id);

COMMENT ON TABLE public.modelos_de_sessao IS
  'Modelos de dia de treino do profissional, organizados por objetivo. Material de trabalho do master - nenhum aluno le.';
