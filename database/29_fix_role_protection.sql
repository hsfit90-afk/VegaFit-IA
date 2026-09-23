/*
  CORRIGE a proteção da coluna `role`, que não protegia nada.

  O QUE ESTAVA ERRADO (database/12_protect_role_column.sql:11-13)

      IF NEW.role IS DISTINCT FROM OLD.role
         AND NEW.id = auth.uid()
         AND current_setting('request.jwt.claim.role', true) != 'service_role' THEN

  Duas falhas independentes, e bastava uma para anular o trigger:

  1. `current_setting('request.jwt.claim.role', true)` é o nome ANTIGO do setting. O PostgREST
     atual publica `request.jwt.claims` (plural, JSON). Com o nome antigo e o segundo argumento
     `true`, a função devolve NULL em vez de erro. E `NULL != 'service_role'` avalia para NULL,
     não para true — então `A AND B AND NULL` é NULL, o IF nunca dispara e a exceção nunca sai.

  2. `NEW.id = auth.uid()` limitava a proteção à própria linha. Mesmo com o item 1 corrigido,
     um trainer continuaria podendo alterar o `role` dos alunos dele (achado A5 da auditoria).

  CONFIRMADO EM TESTE, contra este banco, em 23/09/2026: autenticado como um usuário comum, um
  PATCH em profiles com {"role":"master"} retornou HTTP 200 e promoveu a conta. Depois disso a
  RLS liberava os 9 perfis (contra 1 antes) e os 34 planos de treino (contra 1). O papel foi
  revertido na mesma execução.

  POR QUE PRESERVAR E NÃO LANÇAR EXCEÇÃO

  app/context/AppContext.tsx:194 envia `role` em TODA gravação de perfil, com fallback para
  'client'. Uma exceção faria a gravação inteira falhar para um master cujo papel ainda não
  tivesse carregado no contexto — quebraríamos a tela de configurações para consertar um
  problema de segurança. Preservar o valor antigo bloqueia a escalada do mesmo jeito e mantém
  a gravação funcionando: o cliente recebe 200, e o papel simplesmente não muda.

  O RAISE WARNING existe para a tentativa aparecer nos logs do Postgres, já que ela deixa de
  gerar erro.

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

CREATE OR REPLACE FUNCTION prevent_role_self_update()
RETURNS TRIGGER AS $$
BEGIN
  -- auth.uid() é NULL quando a conexão usa service_role: é assim que o backend legítimo se
  -- distingue, sem depender do nome de nenhum setting do PostgREST. Qualquer requisição com
  -- usuário autenticado — o dono da linha ou um trainer mexendo no aluno — cai aqui.
  IF NEW.role IS DISTINCT FROM OLD.role AND auth.uid() IS NOT NULL THEN
    RAISE WARNING 'Tentativa de alterar role de % (de % para %) pelo usuario %; ignorada.',
      NEW.id, OLD.role, NEW.role, auth.uid();
    NEW.role := OLD.role;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recria o trigger para garantir que ele existe mesmo que a migration 12 nunca tenha rodado
-- neste banco — cenário em que o sintoma seria exatamente o mesmo.
DROP TRIGGER IF EXISTS protect_role_update ON public.profiles;
CREATE TRIGGER protect_role_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_self_update();

/*
  DEPOIS DE APLICAR, audite os papéis que já existem — a falha esteve aberta até agora:

      SELECT id, name, role FROM public.profiles WHERE role <> 'client';

  Confirme que cada master e cada trainer da lista é legítimo.
*/
