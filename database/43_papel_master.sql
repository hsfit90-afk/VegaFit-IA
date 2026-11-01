-- ============================================================================
-- 43 — Dar o papel de master a uma conta, pelo e-mail.
-- ============================================================================
--
-- COMO APLICAR: cole no SQL Editor do painel do Supabase. Rode a CONFERÊNCIA
-- ANTES primeiro e leia o resultado — ele responde uma pergunta que ficou em
-- aberto (ver abaixo) antes de você alterar qualquer coisa.
--
-- ----------------------------------------------------------------------------
-- POR QUE ESTE ARQUIVO EXISTE
-- ----------------------------------------------------------------------------
--
-- Pedido em 01/11/2026: pôr `souza.higor@gmail.com` como master.
--
-- O que o papel muda: libera as cinco telas marcadas `somenteMaster` (Admin,
-- Treinos dos alunos, Exercícios, Nutrição IA, AI Coach) e, desde a migração
-- 42, é o papel que autoriza criar exercício GLOBAL. Também é o que as policies
-- de 16 e 17 consultam para permitir editar e apagar qualquer exercício.
--
-- Não há tela para isso de propósito: um botão "virar master" na interface é
-- escalada de privilégio esperando acontecer. A troca é manual, no banco.
--
-- ----------------------------------------------------------------------------
-- UMA PERGUNTA EM ABERTO, QUE A CONFERÊNCIA RESPONDE
-- ----------------------------------------------------------------------------
--
-- A barra lateral do print de 01/11/2026 mostra a visão de ALUNO — sem a seção
-- Master. Mas a migração 42, rodada no mesmo dia, moveu 882 exercícios com
-- `WHERE user_id IN (SELECT id FROM profiles WHERE role = 'master')`, e ela
-- funcionou. Logo, existia uma conta master naquele momento.
--
-- Ou são duas contas diferentes, ou o papel mudou entre uma coisa e outra. A
-- primeira consulta abaixo mostra TODAS as contas e seus papéis — leia antes de
-- alterar. Se houver outra conta master que você não reconhece, pare e
-- investigue em vez de seguir.
--
-- ============================================================================


-- ----------------------------------------------------------------------------
-- CONFERÊNCIA ANTES — leia o resultado antes de rodar o UPDATE.
-- ----------------------------------------------------------------------------
SELECT
  u.email,
  p.role,
  p.id,
  u.created_at::date AS criada_em,
  u.last_sign_in_at::date AS ultimo_acesso
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.created_at;


-- ----------------------------------------------------------------------------
-- O UPDATE
-- ----------------------------------------------------------------------------
--
-- `lower()` nos dois lados porque e-mail não diferencia maiúscula de minúscula,
-- e um `Souza.Higor@` digitado no cadastro não casaria com a comparação crua.
--
-- Se o e-mail não existir, o UPDATE afeta 0 linhas e não dá erro — por isso a
-- conferência de depois importa.
UPDATE public.profiles
SET role = 'master'
WHERE id = (
  SELECT id FROM auth.users
  WHERE lower(email) = lower('souza.higor@gmail.com')
);


-- ----------------------------------------------------------------------------
-- CONFERÊNCIA DEPOIS
-- ----------------------------------------------------------------------------

-- Esperado: uma linha, com role = 'master'.
SELECT u.email, p.role
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) = lower('souza.higor@gmail.com');

-- Quantas contas master existem agora. Mais de uma não é erro por si só, mas
-- vale saber: toda conta master pode apagar qualquer exercício do catálogo.
SELECT COUNT(*) AS quantos_master
FROM public.profiles
WHERE role = 'master';


-- ----------------------------------------------------------------------------
-- DEPOIS DE RODAR: saia da conta e entre de novo.
-- ----------------------------------------------------------------------------
-- O papel é lido no carregamento do perfil (app/context/AppContext.tsx) e fica
-- em memória durante a sessão. Sem sair e entrar, a barra lateral continua
-- mostrando a visão de aluno mesmo com o banco já atualizado.
