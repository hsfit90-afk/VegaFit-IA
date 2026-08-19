-- CORREÇÃO DE DADOS (não é policy/schema): o importador em massa da biblioteca de exercícios
-- (app/library/page.tsx, função mapMuscleGroup) tinha um fallback que classificava qualquer
-- exercício cuja pasta não batesse com nenhuma palavra-chave de grupo muscular como "Peito" —
-- isso incluía todo exercício de cardio (bike, esteira, corrida etc.), que nunca teve categoria
-- própria. O bug já foi corrigido no código (agora existe a categoria "Cardio" e o fallback
-- virou "Outros"), mas os exercícios que já estavam no banco continuam classificados errado.
--
-- Rode primeiro o SELECT abaixo pra conferir quais linhas seriam afetadas.
-- Se a lista bater com o que você espera, rode o UPDATE em seguida.
--
-- COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.

-- 1. PREVIEW — só leitura, não altera nada:
SELECT id, name, muscle_group
FROM public.exercises
WHERE muscle_group = 'Peito'
  AND (
    name ILIKE '%bicicleta%' OR name ILIKE '%bike%' OR name ILIKE '%esteira%' OR
    name ILIKE '%corrida%' OR name ILIKE '%elíptico%' OR name ILIKE '%eliptico%' OR
    name ILIKE '%remo%' OR name ILIKE '%escada%' OR name ILIKE '%step%' OR
    name ILIKE '%spinning%' OR name ILIKE '%aeróbic%' OR name ILIKE '%aerobic%' OR
    name ILIKE '%cardio%'
  );

-- 2. CORREÇÃO — só rode depois de conferir o preview acima:
-- UPDATE public.exercises
-- SET muscle_group = 'Cardio'
-- WHERE muscle_group = 'Peito'
--   AND (
--     name ILIKE '%bicicleta%' OR name ILIKE '%bike%' OR name ILIKE '%esteira%' OR
--     name ILIKE '%corrida%' OR name ILIKE '%elíptico%' OR name ILIKE '%eliptico%' OR
--     name ILIKE '%remo%' OR name ILIKE '%escada%' OR name ILIKE '%step%' OR
--     name ILIKE '%spinning%' OR name ILIKE '%aeróbic%' OR name ILIKE '%aerobic%' OR
--     name ILIKE '%cardio%'
--   );
