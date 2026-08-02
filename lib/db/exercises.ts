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

export const deleteExercise = async (id: string): Promise<boolean> => {
  const supabase = createClient();
  const { error } = await supabase.from('exercises').delete().eq('id', id);
  if (error) {
    console.error('Error deleting exercise:', error);
    return false;
  }
  return true;
};
