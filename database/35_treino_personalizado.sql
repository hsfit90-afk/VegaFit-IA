/*
  TREINO PERSONALIZADO: pedidos de treino montado à mão pelo profissional.

  É o produto de maior margem do app — não consome IA, e usa o único ativo que concorrente
  não copia: um profissional registrado no CREF montando o treino. Em troca, consome HORAS,
  e por isso tem vagas limitadas por mês.

  POR QUE UMA TABELA E NÃO COLUNAS EM profiles

  Um aluno pode pedir mais de um ao longo do tempo, e o histórico importa: para ele (o que já
  recebeu) e para você (quantas vagas restam neste mês). Colunas em profiles guardariam só o
  último e apagariam o resto.

  FLUXO

    aguardando_pagamento  aluno pediu, ainda não pagou
    pago                  você confirmou o pagamento no painel — a vaga passa a contar
    em_producao           você começou a montar
    entregue              o plano foi para a conta do aluno
    cancelado             desistência ou pagamento não confirmado

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

CREATE TABLE IF NOT EXISTS public.treino_personalizado_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'aguardando_pagamento',
  valor NUMERIC NOT NULL,

  -- O que o aluno pediu. A anamnese dele já está no perfil; aqui fica só o que é específico
  -- deste pedido, para você não precisar perguntar por fora.
  objetivo TEXT,
  observacoes TEXT,

  -- Preenchido quando o plano fica pronto, para o aluno achar o que comprou.
  workout_plan_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  pago_em TIMESTAMPTZ,
  entregue_em TIMESTAMPTZ,

  CONSTRAINT pedido_status_valido CHECK (
    status IN ('aguardando_pagamento', 'pago', 'em_producao', 'entregue', 'cancelado')
  )
);

-- A contagem de vagas do mês roda a cada abertura da tela: precisa ser barata.
CREATE INDEX IF NOT EXISTS idx_pedidos_mes
  ON public.treino_personalizado_pedidos (created_at DESC)
  WHERE status IN ('pago', 'em_producao', 'entregue');

CREATE INDEX IF NOT EXISTS idx_pedidos_usuario
  ON public.treino_personalizado_pedidos (user_id, created_at DESC);

ALTER TABLE public.treino_personalizado_pedidos ENABLE ROW LEVEL SECURITY;

-- O aluno enxerga e cria apenas os próprios pedidos.
DROP POLICY IF EXISTS "aluno le os proprios pedidos" ON public.treino_personalizado_pedidos;
CREATE POLICY "aluno le os proprios pedidos"
  ON public.treino_personalizado_pedidos FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "aluno cria o proprio pedido" ON public.treino_personalizado_pedidos;
CREATE POLICY "aluno cria o proprio pedido"
  ON public.treino_personalizado_pedidos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

/*
  NÃO existe policy de UPDATE para o aluno, de propósito. Mudar status é ato do profissional:
  sem isto, qualquer aluno marcaria o próprio pedido como 'pago' e receberia um treino de
  R$ 147 de graça. Quem muda status é a rota de admin, com service_role.

  Também não existe policy de DELETE: pedido pago é registro financeiro, e apagar histórico
  de quem pagou é o tipo de coisa que você só descobre que precisava quando já foi.
*/

COMMENT ON TABLE public.treino_personalizado_pedidos IS
  'Pedidos de treino montado a mao. Status so muda pelo backend (service_role) - ver comentario na migration 35.';
