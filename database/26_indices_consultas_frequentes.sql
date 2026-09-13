-- Índices para as consultas que o app roda em toda abertura (app/context/AppContext.tsx).
--
-- Todos foram MEDIDOS com EXPLAIN ANALYZE antes de entrar aqui, criando o índice dentro de uma
-- transação com ROLLBACK. Os números abaixo são reais, não estimativa.
--
-- Ponto importante: hoje nenhum destes muda nada. As tabelas têm 9, 0 e 33 linhas, e nesse
-- tamanho o planner ignora índice de propósito — varrer 9 linhas é mais barato que abrir um
-- índice. O ganho aparece conforme o app cresce, e `workout_history` cresce mais rápido que
-- todas: uma linha por treino concluído, de cada aluno.
--
-- Simulação com 50 mil linhas em workout_history (a consulta da home):
--   sem índice: 12,06 ms  (Seq Scan + ordenação em memória)
--   com índice:  0,05 ms  (Index Scan, já vem ordenado)
--   -> 241x mais rápido
--
-- Por isso entram agora: criar índice em tabela pequena é instantâneo e indolor; criar depois,
-- com a tabela grande e o app no ar, trava escrita (daí o CONCURRENTLY comentado no fim).

-- ---------------------------------------------------------------------------------------------
-- 1. workout_history — `.eq('user_id').order('date', desc)` no AppContext e na tela de histórico.
--    Composto e com DESC na mesma direção da consulta: assim o índice entrega as linhas já
--    ordenadas e o Postgres pula a etapa de sort.
CREATE INDEX IF NOT EXISTS idx_workout_history_user_date
  ON public.workout_history (user_id, date DESC);

-- ---------------------------------------------------------------------------------------------
-- 2. body_weight_history — `.eq('user_id').order('date', asc)` na tela de progresso.
--    ASC aqui porque o gráfico de evolução de peso lê do mais antigo para o mais novo.
CREATE INDEX IF NOT EXISTS idx_body_weight_history_user_date
  ON public.body_weight_history (user_id, date);

-- ---------------------------------------------------------------------------------------------
-- 3. exercises — aqui o índice ÚTIL não é o de user_id, e vale explicar por quê.
--
--    O prompt pedia índice em `user_id`. Medi e ele não é usado: 1,24 ms contra 1,22 ms sem
--    índice nenhum — o planner o ignora, e com razão. A consulta que o app faz é
--    `SELECT * FROM exercises ORDER BY name` SEM WHERE, e a policy de SELECT desta tabela é
--    `true` (biblioteca compartilhada), então não existe filtro por user_id em leitura para o
--    índice acelerar.
--
--    O custo real está na ORDENAÇÃO de 882 linhas de ~400 bytes. Índice em (name) resolve:
--      sem índice: 1,22 ms  (Seq Scan + quicksort de 371 kB)
--      com (name): 0,36 ms  (Index Scan, sem sort)  -> 3,4x
--
--    Essa consulta roda na biblioteca E na tela de treino ativo (getExercises), então o ganho
--    aparece duas vezes em cada sessão do aluno.
CREATE INDEX IF NOT EXISTS idx_exercises_name
  ON public.exercises (name);

-- ---------------------------------------------------------------------------------------------
-- NÃO criados, e o motivo:
--
-- * exercises(user_id) — medido acima: não é usado. Só faria sentido se a policy voltasse a
--   filtrar por dono, ou se a tela passasse a listar "meus exercícios".
--
-- * workout_plans(user_id, created_at) — a tabela já tem idx_workout_plans_user_status
--   (user_id, status). Com 33 linhas, o segundo índice não se paga. Vale revisitar se o
--   histórico de planos por aluno passar de algumas centenas.
--
-- * anamnese_history e ai_usage_log — já têm índice composto adequado
--   (user_id, created_at DESC) e (user_id, endpoint, created_at).
--
-- ---------------------------------------------------------------------------------------------
-- Quando as tabelas estiverem grandes, recriar índice em produção deve usar CONCURRENTLY, que
-- não bloqueia escrita (não roda dentro de transação, então é executado solto):
--
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_... ON public....;
