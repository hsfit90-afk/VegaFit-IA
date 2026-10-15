/*
  PLANO ATIVO NO BANCO.

  O PROBLEMA

  Até aqui o plano ativo vivia SÓ no localStorage do aparelho do aluno
  (`vegafit_active_plan_<id>`). Três consequências, todas reais:

  1. O profissional entrega um Treino do Personal e NÃO consegue deixá-lo ativo. Se o aluno
     já trocou de plano alguma vez, o localStorage dele aponta para o antigo — e ele abre o
     app no treino velho, sem entender por que o novo não apareceu.
  2. Trocar de aparelho ou limpar o navegador zera a escolha.
  3. O profissional não tem como nem CONFERIR qual plano o aluno está usando.

  A SOLUÇÃO

  O banco passa a ser a fonte da verdade, e o localStorage vira só um cache para a abertura
  ser instantânea. Quem escreve: o aluno ao trocar de plano, e o profissional ao entregar.

  ON DELETE SET NULL, e não CASCADE: apagar um plano não pode apagar o perfil do aluno. Com
  NULL, o app cai no plano mais recente, que é o comportamento que já existia.

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_plan_id TEXT;

/*
  SEM foreign key para workout_plans.

  CORREÇÃO (15/10/2026): a justificativa original dizia que `workout_plans.id` era TEXT. Não
  é — é UUID (ver database/02). O motivo real de a coluna aqui ser TEXT e não ter FK é outro,
  e mais simples: ela foi criada assim, e trocar o tipo de uma coluna já populada em produção
  para ganhar uma FK não paga o risco.

  O que garante a integridade é a LEITURA: AppContext só aceita o active_plan_id se ele
  existir entre os planos carregados; se não existir, cai no mais recente. Plano apagado,
  portanto, nunca deixa o aluno com a tela vazia — que é o que uma FK com ON DELETE SET NULL
  daria, e já temos sem ela.
*/

COMMENT ON COLUMN public.profiles.active_plan_id IS
  'Plano de treino ativo do aluno. Fonte da verdade (o localStorage e so cache). Escrito pelo aluno ao trocar e pelo profissional ao entregar um treino.';

-- Semeia com o plano mais recente de cada aluno que ainda não tem nenhum marcado, para que o
-- estado no banco nasça igual ao que o app já mostrava.
UPDATE public.profiles p
SET active_plan_id = recente.id
FROM (
  SELECT DISTINCT ON (user_id) user_id, id
  FROM public.workout_plans
  ORDER BY user_id, created_at DESC
) AS recente
WHERE p.id = recente.user_id
  AND p.active_plan_id IS NULL;
