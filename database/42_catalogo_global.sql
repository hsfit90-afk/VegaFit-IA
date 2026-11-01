-- ============================================================================
-- 42 — O catálogo volta a ser GLOBAL, e deixa de pertencer a uma pessoa.
-- ============================================================================
--
-- COMO APLICAR: cole no SQL Editor do painel do Supabase e execute. Rode os
-- blocos de CONFERÊNCIA antes e depois — eles não alteram nada.
--
-- ----------------------------------------------------------------------------
-- O PROBLEMA, MEDIDO EM 01/11/2026
-- ----------------------------------------------------------------------------
--
-- Medido com a chave anon, somente leitura:
--
--     exercícios com user_id IS NULL (globais) :   0
--     exercícios da conta 8afe95f7-…bb9f       : 882
--
-- O esquema em 03_exercises_library.sql diz, na própria coluna: "Se for NULL,
-- significa que é um exercício Global do Admin". Não havia nenhum. O catálogo
-- inteiro — os 882 exercícios com os vídeos servidos pela Cloudflare, o ativo
-- mais forte do produto — pertencia a UMA conta de pessoa física.
--
-- Três caminhos levavam à destruição total, e os três são de um clique:
--
--   1. O botão "excluir minha conta", na tela de Perfil. A rota
--      app/api/account/delete/route.ts apaga por user_id em nove tabelas, e
--      `exercises` é uma delas.
--   2. Remover a conta pelo painel do Supabase: a coluna é
--      `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`.
--   3. Qualquer limpeza de dados "do master" feita por user_id.
--
-- Em todos, 882 exercícios somem para TODOS os alunos, e os planos de treino
-- ficam apontando para exercícios que não existem mais.
--
-- ----------------------------------------------------------------------------
-- POR QUE user_id = NULL É O CONSERTO CERTO, E NÃO UM REMENDO
-- ----------------------------------------------------------------------------
--
-- NULL já é o significado de "global" neste esquema desde 03. E as policies de
-- 16 e 17 JÁ FORAM ESCRITAS para esse mundo: elas dão UPDATE e DELETE ao master
-- pelo PAPEL dele, não pela posse da linha — exatamente porque exercício global
-- não tem dono. O comentário de 16 diz isso com todas as letras:
--
--     "exercícios GLOBAIS (user_id IS NULL, a maioria do catálogo inicial)
--      nunca podiam ser apagados por ninguém, nem pelo Master"
--
-- Ou seja: o app foi desenhado para o catálogo ser NULL. O estado atual é que
-- é a anomalia. Depois desta migração o master continua podendo editar e
-- apagar qualquer exercício, sem nenhuma mudança nas policies de 16 e 17.
--
-- ----------------------------------------------------------------------------
-- O QUE ESTA MIGRAÇÃO NÃO FAZ, DE PROPÓSITO
-- ----------------------------------------------------------------------------
--
-- NÃO tira `exercises` da rota de exclusão de conta. Seria trocar um defeito
-- por outro: o exercício que um ALUNO cadastrou é dado dele, e tem de sumir
-- quando ele exerce o direito de exclusão (LGPD, Art. 18). Depois desta
-- migração a rota fica correta sozinha — ela apaga `WHERE user_id = <aluno>`, e
-- o catálogo global não casa com user_id nenhum.
--
-- NÃO mexe na policy de SELECT. Nota de campo: o banco em produção já deixa
-- visitante anônimo ler os 882, embora 03 declare
-- `USING (user_id IS NULL OR user_id = auth.uid())`. O banco divergiu do
-- arquivo em algum momento. Não é problema de privacidade — nome de exercício
-- não é dado pessoal, e foi conferido em 01/11/2026 que profiles,
-- anamnese_history, workout_history, body_weight_history, workout_plans e
-- ai_usage_log devolvem ZERO linha para visitante anônimo. Fica registrado
-- aqui porque divergência entre banco e migração é dívida, mesmo quando é
-- inofensiva.
--
-- ============================================================================


-- ----------------------------------------------------------------------------
-- CONFERÊNCIA ANTES — rode isto primeiro e guarde os números.
-- ----------------------------------------------------------------------------
SELECT
  COUNT(*) FILTER (WHERE user_id IS NULL)                      AS globais,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL)                  AS com_dono,
  COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL)   AS quantos_donos,
  COUNT(*)                                                     AS total
FROM public.exercises;

-- Quem são os donos, e quantos exercícios cada um tem.
SELECT
  e.user_id,
  p.role,
  COUNT(*) AS exercicios
FROM public.exercises e
LEFT JOIN public.profiles p ON p.id = e.user_id
WHERE e.user_id IS NOT NULL
GROUP BY e.user_id, p.role
ORDER BY exercicios DESC;


-- ----------------------------------------------------------------------------
-- O CONSERTO — passo 1: soltar o catálogo da conta de master.
-- ----------------------------------------------------------------------------
--
-- Alvo pelo PAPEL, não por um UUID cravado: assim o arquivo continua correto se
-- for rodado noutro ambiente, e não depende de eu ter copiado o id certo.
--
-- Exercício cadastrado por um ALUNO continua com o dono dele, de propósito — é
-- dado pessoal e tem de sair junto com a conta dele.
UPDATE public.exercises
SET user_id = NULL
WHERE user_id IN (SELECT id FROM public.profiles WHERE role = 'master');


-- ----------------------------------------------------------------------------
-- O CONSERTO — passo 2: deixar o master CRIAR exercício já global.
-- ----------------------------------------------------------------------------
--
-- Sem isto, o passo 1 se desfaz sozinho: lib/db/exercises.ts grava
-- `user_id: user.id` em todo insert, então o próximo exercício que o master
-- cadastrasse voltaria a ser dele, e o catálogo se re-armaria com o tempo.
--
-- A policy antiga era `WITH CHECK (user_id = auth.uid() OR service_role)`, que
-- RECUSA um insert com NULL — a tela daria erro ao salvar.
--
-- A nova mantém o aluno podendo criar o exercício DELE (user_id = auth.uid()) e
-- acrescenta: master pode criar exercício global (user_id IS NULL). Ninguém
-- ganha permissão de criar exercício em nome de outra pessoa.
DROP POLICY IF EXISTS "Users can insert own exercises" ON public.exercises;
DROP POLICY IF EXISTS "Insert own or global as master" ON public.exercises;

CREATE POLICY "Insert own or global as master"
ON public.exercises FOR INSERT
WITH CHECK (
  auth.role() = 'service_role'
  OR user_id = auth.uid()
  OR (
    user_id IS NULL
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'master'
  )
);


-- ----------------------------------------------------------------------------
-- CONFERÊNCIA DEPOIS — o esperado está escrito em cada linha.
-- ----------------------------------------------------------------------------

-- Esperado: globais = 882, com_dono = 0, total = 882 (o total NÃO pode mudar).
SELECT
  COUNT(*) FILTER (WHERE user_id IS NULL)     AS globais,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL) AS com_dono,
  COUNT(*)                                    AS total
FROM public.exercises;

-- Esperado: 882 — nenhum exercício pode ter perdido o vídeo no caminho.
SELECT COUNT(*) AS com_video
FROM public.exercises
WHERE media_url IS NOT NULL AND media_url <> '';

-- Esperado: as quatro policies, com "Insert own or global as master" no lugar
-- de "Users can insert own exercises".
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'exercises'
ORDER BY cmd, policyname;
