/*
  Estende a proteção da migration 29 para as colunas de assinatura.

  POR QUE PRECISA

  O RLS de profiles permite — corretamente — que a pessoa atualize a própria linha: é assim
  que ela salva nome, peso e preferências. Sem este gatilho, qualquer aluno autenticado se
  daria assinatura vitalícia com um único PATCH na API do Supabase, usando só a chave
  pública que o navegador dele já tem:

      PATCH /rest/v1/profiles?id=eq.<seu-id>
      {"subscription_status": "cortesia"}

  É exatamente a mesma falha de escalada de privilégio que a coluna `role` tinha e que a
  migration 29 corrigiu (confirmada em teste contra este banco em 23/09/2026).

  POR QUE PRESERVAR E NÃO LANÇAR EXCEÇÃO

  Mesmo motivo da migration 29: app/context/AppContext.tsx:193 grava o perfil inteiro em
  toda alteração. Uma exceção quebraria a tela de configurações para consertar um problema
  de segurança. Preservar o valor antigo bloqueia a escalada do mesmo jeito — o cliente
  recebe 200 e o valor simplesmente não muda.

  Hoje o cliente nem envia essas colunas, então o gatilho nunca dispara no uso normal. Ele
  existe para o dia em que alguém tentar de propósito, e para o dia em que uma refatoração
  do AppContext passar a enviar a linha inteira sem ninguém perceber.

  QUEM ESCREVE DE VERDADE

  Só o backend com service_role: o webhook do Mercado Pago e a rota de checkout. Nessas
  conexões auth.uid() é NULL, e o gatilho não interfere.

  A função troca de nome porque não protege mais só o papel. O gatilho antigo é removido
  junto, senão os dois rodariam.

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard, DEPOIS da migration 33.
*/

CREATE OR REPLACE FUNCTION protect_privileged_profile_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- auth.uid() é NULL quando a conexão usa service_role: é assim que o backend legítimo se
  -- distingue, sem depender do nome de nenhum setting do PostgREST.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE WARNING 'Tentativa de alterar role de % (de % para %) pelo usuario %; ignorada.',
      NEW.id, OLD.role, NEW.role, auth.uid();
    NEW.role := OLD.role;
  END IF;

  IF NEW.subscription_status      IS DISTINCT FROM OLD.subscription_status
  OR NEW.trial_ends_at            IS DISTINCT FROM OLD.trial_ends_at
  OR NEW.subscription_expires_at  IS DISTINCT FROM OLD.subscription_expires_at
  OR NEW.subscription_plan        IS DISTINCT FROM OLD.subscription_plan
  OR NEW.gateway                  IS DISTINCT FROM OLD.gateway
  OR NEW.gateway_customer_id      IS DISTINCT FROM OLD.gateway_customer_id
  OR NEW.gateway_subscription_id  IS DISTINCT FROM OLD.gateway_subscription_id
  THEN
    RAISE WARNING 'Tentativa de alterar assinatura de % (de % para %) pelo usuario %; ignorada.',
      NEW.id, OLD.subscription_status, NEW.subscription_status, auth.uid();
    NEW.subscription_status     := OLD.subscription_status;
    NEW.trial_ends_at           := OLD.trial_ends_at;
    NEW.subscription_expires_at := OLD.subscription_expires_at;
    NEW.subscription_plan       := OLD.subscription_plan;
    NEW.gateway                 := OLD.gateway;
    NEW.gateway_customer_id     := OLD.gateway_customer_id;
    NEW.gateway_subscription_id := OLD.gateway_subscription_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove o gatilho antigo (migration 29) para não rodarem os dois.
DROP TRIGGER IF EXISTS protect_role_update ON public.profiles;

DROP TRIGGER IF EXISTS protect_privileged_columns ON public.profiles;
CREATE TRIGGER protect_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION protect_privileged_profile_columns();

DROP FUNCTION IF EXISTS prevent_role_self_update();

-- CONFERÊNCIA: logado como aluno comum no app, tente pelo console do navegador
--
--   await supabase.from('profiles').update({subscription_status:'cortesia'}).eq('id', SEU_ID)
--
-- Deve retornar sucesso E o valor deve continuar o que era. Se mudou, o gatilho não subiu.
