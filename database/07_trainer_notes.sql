/*
  Adiciona a coluna trainer_notes usada pelo painel do treinador
  (app/trainer/[clientId]/page.tsx) para guardar anotações sobre o aluno.
  A política de UPDATE já existe em 06_b2b_roles.sql ("Trainer can update
  own clients"), então nenhuma policy nova é necessária aqui.
*/

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS trainer_notes TEXT;
