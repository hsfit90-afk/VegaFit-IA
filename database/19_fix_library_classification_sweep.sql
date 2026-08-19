-- CORREÇÃO DE DADOS (não é policy/schema): varredura completa dos 504 exercícios da biblioteca,
-- feita manualmente (nome por nome) depois de constatar que o bug do fallback "Peito" (ver
-- 18_fix_cardio_mislabeled_as_peito.sql) também escondia exercícios de ombro, perna, glúteo,
-- lombar e antebraço — categorias que ou não existiam ainda, ou cujo nome de pasta na importação
-- não bateu com nenhuma palavra-chave reconhecida.
--
-- Duas categorias novas foram criadas no app pra isso: "Lombar" e "Antebraço".
--
-- Rode o SELECT de preview primeiro pra conferir. Depois rode os UPDATEs, um bloco por vez ou
-- todos juntos — cada um já filtra pelo muscle_group ATUAL errado, então é seguro rodar mais
-- de uma vez sem duplicar efeito.
--
-- COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.

-- ============================================================
-- 1. PREVIEW — só leitura, confere o estado atual antes de mudar nada
-- ============================================================
SELECT id, name, muscle_group
FROM public.exercises
WHERE name IN (
  'Máquina Elíptica', 'Máquina de Caminhada Ondulatório',
  'Elevação de Deltoide em Y com Halteres Inclinado', 'Elevação de Deltoide Posterior com Halteres Inclinado',
  'Elevação de T com Halteres Inclinada', 'Elevação lateral cruzada no crossover',
  'Elevações de ombros na paralela', 'Face Pull', 'Dumbbell-Raise',
  'Voador de Deltoides Posterior com Cabo', 'Voador na Máquina para Deltoides Posteriores',
  'Voador para deltoides posterior com cabo', 'Voador invertido',
  'Extensão de Perna na Máquina Smith Reversa',
  'Ponte com Halteres',
  'Antebraços', 'Flexão de Pulso Neutra Sentado com Halteres', 'Flexão de Punho com Cabo em um Braço no Chão',
  'Flexão de Punho com Halteres', 'Flexão de Punho Reversa com Anilha', 'Flexão de Punho Reversa com Barra Sobre um Banco',
  'Hand Grip', 'Rolinho de antebraço',
  'Extensão Lombar com Peso', 'Extensão lombar sentada', 'Hiperextensão', 'Hiperextensão com Torção',
  'Hiperextensão de Lombar no Banco Plano', 'Hiperextensão Invertida de Sapo', 'Hiperextensão no Chão', 'Superman',
  'Glúteo Coice Na Alavanca', 'Glúteo Coice Na Máquina', 'Glúteo Coice Na Máquina De Extensão De Pernas',
  'Glúteo Coice No Smith', 'Gluteos Coice nilateral Polia Baixa',
  'Bom dia', 'Bom dia (1)', 'Flexão de Pernas com Alavanca', 'Flexão de Pernas com Halteres Declinado',
  'Flexão de Pernas na Bola de Estabilidade', 'Flexão Nórdica', 'Flexão Nórdica (2)', 'Peso muerto piernas rígidas con barra',
  'Elevação de Panturrilha com Uma Perna na Máquina Hack', 'Elevação de Panturrilha no Leg Press',
  'Elevação de Panturrilha no Leg Press horizontal', 'Elevação de Panturrilhas no Hack',
  'Elevação Unilateral de Panturrilha no Leg Press'
)
ORDER BY muscle_group, name;

-- ============================================================
-- 2. CORREÇÕES — rode depois de conferir o preview acima
-- ============================================================

-- Cardio (hoje em Peito)
UPDATE public.exercises SET muscle_group = 'Cardio'
WHERE muscle_group = 'Peito' AND name IN (
  'Máquina Elíptica', 'Máquina de Caminhada Ondulatório'
);

-- Ombro (hoje em Peito)
UPDATE public.exercises SET muscle_group = 'Ombro'
WHERE muscle_group = 'Peito' AND name IN (
  'Elevação de Deltoide em Y com Halteres Inclinado', 'Elevação de Deltoide Posterior com Halteres Inclinado',
  'Elevação de T com Halteres Inclinada', 'Elevação lateral cruzada no crossover',
  'Elevações de ombros na paralela', 'Face Pull', 'Dumbbell-Raise',
  'Voador de Deltoides Posterior com Cabo', 'Voador na Máquina para Deltoides Posteriores',
  'Voador para deltoides posterior com cabo', 'Voador invertido'
);

-- Pernas (quadríceps) (hoje em Peito)
UPDATE public.exercises SET muscle_group = 'Pernas (quadríceps)'
WHERE muscle_group = 'Peito' AND name IN (
  'Extensão de Perna na Máquina Smith Reversa'
);

-- Glúteos (hoje em Peito)
UPDATE public.exercises SET muscle_group = 'Glúteos'
WHERE muscle_group = 'Peito' AND name IN (
  'Ponte com Halteres'
);

-- Antebraço (hoje em Peito)
UPDATE public.exercises SET muscle_group = 'Antebraço'
WHERE muscle_group = 'Peito' AND name IN (
  'Antebraços', 'Flexão de Pulso Neutra Sentado com Halteres', 'Flexão de Punho com Cabo em um Braço no Chão',
  'Flexão de Punho com Halteres', 'Flexão de Punho Reversa com Anilha', 'Flexão de Punho Reversa com Barra Sobre um Banco',
  'Hand Grip', 'Rolinho de antebraço'
);

-- Lombar (hoje em Peito)
UPDATE public.exercises SET muscle_group = 'Lombar'
WHERE muscle_group = 'Peito' AND name IN (
  'Extensão Lombar com Peso', 'Extensão lombar sentada', 'Hiperextensão', 'Hiperextensão com Torção',
  'Hiperextensão de Lombar no Banco Plano', 'Hiperextensão Invertida de Sapo', 'Hiperextensão no Chão', 'Superman'
);

-- Glúteos (hoje em Tríceps — "coice de glúteo" acabou classificado como tríceps)
UPDATE public.exercises SET muscle_group = 'Glúteos'
WHERE muscle_group = 'Tríceps' AND name IN (
  'Glúteo Coice Na Alavanca', 'Glúteo Coice Na Máquina', 'Glúteo Coice Na Máquina De Extensão De Pernas',
  'Glúteo Coice No Smith', 'Gluteos Coice nilateral Polia Baixa'
);

-- Posterior de coxa (hoje em Pernas/quadríceps — são exercícios de posterior, não quadríceps)
UPDATE public.exercises SET muscle_group = 'Posterior de coxa'
WHERE muscle_group = 'Pernas (quadríceps)' AND name IN (
  'Bom dia', 'Bom dia (1)', 'Flexão de Pernas com Alavanca', 'Flexão de Pernas com Halteres Declinado',
  'Flexão de Pernas na Bola de Estabilidade', 'Flexão Nórdica', 'Flexão Nórdica (2)', 'Peso muerto piernas rígidas con barra'
);

-- Panturrilhas (hoje em Pernas/quadríceps)
UPDATE public.exercises SET muscle_group = 'Panturrilhas'
WHERE muscle_group = 'Pernas (quadríceps)' AND name IN (
  'Elevação de Panturrilha com Uma Perna na Máquina Hack', 'Elevação de Panturrilha no Leg Press',
  'Elevação de Panturrilha no Leg Press horizontal', 'Elevação de Panturrilhas no Hack',
  'Elevação Unilateral de Panturrilha no Leg Press'
);

-- ============================================================
-- NÃO incluídos aqui (nome ambíguo demais pra reclassificar sem ver o exercício —
-- revise manualmente pela tela "Editar" na Biblioteca):
--   "Quatro Apoios" (Peito)               — parece mais Core/Abdômen, mas não confirmado
--   "Elevação de Perna em Pé com Alavanca" (Pernas)  — pode ser Core/Abdômen
--   "Elevação de Joelho com Halteres" (Pernas)       — pode ser Core/Abdômen
--   "Flexão de apoio com elevação de braço" (Tríceps) — pode ser Peito
--   "Dips de escápula" (Peito)             — defensável como está, deixado de fora
--   "Plataforma Vibratória" (Peito)        — sem grupo muscular claro, avalie se cabe em Cardio ou Outros
--
-- Duplicata encontrada (mesmo nome, categorias diferentes — NÃO é erro de classificação,
-- são duas linhas separadas no banco). Decida se quer mesclar/apagar uma:
--   "Levantamento Terra" existe em Costas E em Pernas (quadríceps)
--   "Levantamento Terra Romeno" existe em Costas E em Pernas (quadríceps)
-- ============================================================
