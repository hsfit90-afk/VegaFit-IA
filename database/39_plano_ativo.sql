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
  SEM foreign key para workout_plans de propósito.

  A coluna `id` de workout_plans é TEXT e recebe uuid gerado no cliente; já houve plano salvo
  com id vindo de `crypto.randomUUID()` do navegador e plano vindo do servidor. Uma FK aqui
  transformaria qualquer divergência histórica em erro de escrita no perfil — e perfil que não
  salva é o aluno travado.

  A integridade é garantida na leitura: AppContext só aceita o active_plan_id se ele existir
  entre os planos carregados; se não existir, cai no mais recente.
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
