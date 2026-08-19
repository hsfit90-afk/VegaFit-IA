import { createClient } from '@/utils/supabase/client';
import { Exercise } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

export const getExercises = async (): Promise<Exercise[]> => {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching exercises:', error);
    return [];
  }

  return data.map(ex => ({
    id: ex.id,
    name: ex.name,
    muscleGroup: ex.muscle_group,
    secondaryMuscles: [],
    equipment: ex.equipment || 'Haltere',
    difficulty: ex.difficulty || 1,
    youtubeId: ex.youtube_id,
    mediaUrl: ex.media_url,
    instructions: ex.instructions || [],
    commonMistakes: ex.common_mistakes || [],
    userId: ex.user_id,
  }));
};

export const addExercise = async (
  exercise: Omit<Exercise, 'id'>, 
  file: File | null
): Promise<Exercise | null> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  let mediaUrl = exercise.mediaUrl;

  // Upload file if provided
  if (file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('exercise-media')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading media:', uploadError);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('exercise-media')
      .getPublicUrl(filePath);

    mediaUrl = publicUrlData.publicUrl;
  }

  const { data, error } = await supabase
    .from('exercises')
    .insert({
      user_id: user.id,
      name: exercise.name,
      muscle_group: exercise.muscleGroup,
      equipment: exercise.equipment,
      difficulty: exercise.difficulty,
      media_url: mediaUrl,
      youtube_id: exercise.youtubeId,
      instructions: exercise.instructions,
      common_mistakes: exercise.commonMistakes
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding exercise:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    muscleGroup: data.muscle_group,
    secondaryMuscles: [],
    equipment: data.equipment,
    difficulty: data.difficulty,
    youtubeId: data.youtube_id,
    mediaUrl: data.media_url,
    instructions: data.instructions,
    commonMistakes: data.common_mistakes,
    userId: data.user_id,
  };
};

export const updateExerciseMuscleGroup = async (id: string, muscleGroup: string): Promise<boolean> => {
  const supabase = createClient();
  // Mesmo cuidado do delete: .select() confirma que a linha foi realmente alterada — sem isso,
  // um UPDATE bloqueado pelo RLS "sucede" com 0 linhas afetadas e nenhum erro.
  const { data, error } = await supabase
    .from('exercises')
    .update({ muscle_group: muscleGroup })
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('Error updating exercise:', error);
    return false;
  }
  if (!data || data.length === 0) {
    console.error('Exercise update blocked (0 rows affected) — provavelmente falta de permissão (RLS).');
    return false;
  }
  return true;
};

export const deleteExercise = async (id: string): Promise<boolean> => {
  const supabase = createClient();
  // .select() força o Supabase a retornar as linhas realmente apagadas — sem isso, um DELETE
  // bloqueado pelo RLS "sucede" com 0 linhas afetadas e nenhum erro, fazendo a UI achar que
  // apagou quando na verdade nada saiu do banco.
  const { data, error } = await supabase.from('exercises').delete().eq('id', id).select('id');
  if (error) {
    console.error('Error deleting exercise:', error);
    return false;
  }
  if (!data || data.length === 0) {
    console.error('Exercise delete blocked (0 rows affected) — provavelmente falta de permissão (RLS).');
    return false;
  }
  return true;
};
