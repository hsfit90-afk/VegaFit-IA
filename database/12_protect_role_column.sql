-- Impede que qualquer usuário altere a própria coluna 'role' via client-side.
-- Apenas service_role (backend/admin) pode promover ou rebaixar papéis.
-- 
-- COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.

-- 1. Função que bloqueia a auto-promoção
CREATE OR REPLACE FUNCTION prevent_role_self_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o role está sendo alterado E o usuário é ele mesmo (não é service_role)
  IF NEW.role IS DISTINCT FROM OLD.role 
     AND NEW.id = auth.uid() 
     AND current_setting('request.jwt.claim.role', true) != 'service_role' THEN
    RAISE EXCEPTION 'Não é permitido alterar seu próprio papel (role).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger que executa a verificação antes de cada UPDATE na tabela profiles
DROP TRIGGER IF EXISTS protect_role_update ON public.profiles;
CREATE TRIGGER protect_role_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_self_update();
