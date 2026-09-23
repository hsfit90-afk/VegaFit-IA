/*
  Achado D3 da auditoria: a coluna `role` aceita qualquer texto.

  O código assume três valores (lib/types.ts:95), mas o banco não impõe nada. Depois da
  correção do trigger (migration 29) só o service_role escreve ali, então o risco hoje é
  erro de programação, não ataque — um typo grava 'maste' e o usuário perde o acesso em
  silêncio, porque toda checagem compara com 'master'.

  ANTES DE RODAR, confirme que não há valor fora do conjunto (se houver, o ALTER falha):

      SELECT DISTINCT role FROM public.profiles;

  Em 23/09/2026 os valores existentes eram client, trainer e master.

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_valido
CHECK (role IN ('client', 'trainer', 'master'));
