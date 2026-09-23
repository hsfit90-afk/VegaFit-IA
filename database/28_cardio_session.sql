/*
  Sessão de aeróbico do plano, guardada FORA do array `sessions`.

  Por que uma coluna separada e não mais um item em sessions[]:

  O rodízio de treinos é aritmética de módulo sobre sessions.length, em quatro lugares
  independentes (app/active/page.tsx:39 e :665, app/context/AppContext.tsx:331,
  app/page.tsx:121). Um quarto item no array entraria no rodízio por padrão, e tirá-lo de
  lá exigiria acertar os quatro cálculos — justo a classe de bug que já nos custou três
  correções neste projeto. Fora do array, o rodízio A/B/C continua intocado e o aeróbico
  fica avulso, que é o comportamento pedido: o aluno faz quando quiser, em dia livre ou
  depois do treino.

  Formato (jsonb):
    {
      "name": "Aeróbico",
      "durationMinutes": 30,
      "intensity": "Moderada — consegue conversar, mas não cantar",
      "options": ["Esteira", "Bicicleta ergométrica", "Elíptico"],
      "notes": "Comece com 5 minutos leves antes de subir o ritmo."
    }

  NULL = plano gerado antes desta migração, ou aluno que optou por não ter aeróbico.

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

ALTER TABLE public.workout_plans
ADD COLUMN IF NOT EXISTS cardio_session JSONB;
