"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowLeft, Dumbbell, Save, Plus, Trash2, Import, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { useAppContext } from '@/app/context/AppContext';
import { WorkoutPlan, WorkoutSession, Exercise, WorkoutExercise } from '@/lib/types';
import { getExercises } from '@/lib/db/exercises';
import { v4 as uuidv4 } from 'uuid';

export default function ManualWorkoutCreator() {
  const router = useRouter();
  const { addWorkoutPlan } = useAppContext();
  
  const [planName, setPlanName] = useState('Meu Novo Treino');
  const [split, setSplit] = useState('ABC');
  
  // Basic structure to show the user it's possible to add workouts manually
  const [sessions, setSessions] = useState<WorkoutSession[]>([
    {
      id: uuidv4(),
      name: 'Treino A',
      exercises: []
    }
  ]);

  const [libraryExercises, setLibraryExercises] = useState<Exercise[]>([]);
  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [activeSessionIndex, setActiveSessionIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadExercises = async () => {
      const ex = await getExercises();
      setLibraryExercises(ex);
    };
    loadExercises();
  }, []);

  const openExerciseModal = (sessionIndex: number) => {
    setActiveSessionIndex(sessionIndex);
    setIsExerciseModalOpen(true);
    setSearchTerm('');
  };

  const handleAddExercise = (exercise: Exercise) => {
    if (activeSessionIndex === null) return;
    
    const newWorkoutExercise: WorkoutExercise = {
      id: uuidv4(),
      exerciseId: exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      sets: 3,
      reps: '10-12',
      restSeconds: 60,
      tips: '',
      youtubeSearchTerm: `${exercise.name} exercicio`
    };

    const newSessions = [...sessions];
    newSessions[activeSessionIndex].exercises.push(newWorkoutExercise);
    setSessions(newSessions);
    setIsExerciseModalOpen(false);
  };

  const removeExercise = (sessionIndex: number, exerciseId: string) => {
    const newSessions = [...sessions];
    newSessions[sessionIndex].exercises = newSessions[sessionIndex].exercises.filter(ex => ex.id !== exerciseId);
    setSessions(newSessions);
  };
  
  const updateExercise = (sessionIndex: number, exerciseId: string, field: keyof WorkoutExercise, value: any) => {
    const newSessions = [...sessions];
    const exercise = newSessions[sessionIndex].exercises.find(ex => ex.id === exerciseId);
    if (exercise) {
      // @ts-ignore
      exercise[field] = value;
      setSessions(newSessions);
    }
  };

  const filteredExercises = libraryExercises.filter(ex => 
    ex.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    ex.muscleGroup.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = () => {
    // This is just a basic save logic for the newly created skeleton
    const newPlan: WorkoutPlan = {
      id: uuidv4(),
      name: planName,
      split: split,
      sessions: sessions,
      createdAt: Date.now()
    };
    
    addWorkoutPlan(newPlan);
    router.push('/');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      className="p-5 md:p-8 max-w-4xl mx-auto min-h-screen pb-32"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants} className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => router.back()}
          className="p-2 bg-surface hover:bg-surface-light rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-outfit font-bold tracking-tight">Criar Treino Manual</h1>
          <p className="text-foreground-muted text-sm">Monte seu próprio plano de treino ou importe de alguém.</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes do Plano</CardTitle>
              <CardDescription>Defina o nome e a divisão do seu treino.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground-muted mb-1.5">Nome do Plano</label>
                <input 
                  type="text" 
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:border-primary outline-none transition-colors"
                  placeholder="Ex: Treino de Hipertrofia"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-muted mb-1.5">Divisão (Split)</label>
                <input 
                  type="text" 
                  value={split}
                  onChange={(e) => setSplit(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:border-primary outline-none transition-colors"
                  placeholder="Ex: ABC, AB, Fullbody"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Sessões de Treino</CardTitle>
                <CardDescription>Adicione os exercícios para cada dia.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setSessions([...sessions, { id: uuidv4(), name: `Treino ${String.fromCharCode(65 + sessions.length)}`, exercises: [] }])}>
                <Plus className="w-4 h-4 mr-2" /> Dia de Treino
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {sessions.map((session, index) => (
                <div key={session.id} className="p-4 bg-surface rounded-xl border border-border">
                  <div className="flex justify-between items-center mb-4">
                    <input 
                      type="text" 
                      value={session.name}
                      onChange={(e) => {
                        const newSessions = [...sessions];
                        newSessions[index].name = e.target.value;
                        setSessions(newSessions);
                      }}
                      className="bg-transparent text-lg font-bold outline-none border-b border-transparent focus:border-primary/50 text-white"
                    />
                    <button 
                      onClick={() => setSessions(sessions.filter(s => s.id !== session.id))}
                      className="text-foreground-muted hover:text-destructive p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {session.exercises.length > 0 ? (
                    <div className="space-y-3 mb-4">
                      {session.exercises.map((ex) => (
                        <div key={ex.id} className="flex flex-col gap-2 p-3 bg-background rounded-lg border border-border">
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-white">{ex.name}</span>
                            <button onClick={() => removeExercise(index, ex.id)} className="text-foreground-muted hover:text-destructive p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] text-foreground-muted uppercase tracking-wider">Séries</label>
                              <input 
                                type="number" 
                                value={ex.sets}
                                onChange={(e) => updateExercise(index, ex.id, 'sets', parseInt(e.target.value) || 0)}
                                className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-white focus:border-primary outline-none"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-foreground-muted uppercase tracking-wider">Reps</label>
                              <input 
                                type="text" 
                                value={ex.reps}
                                onChange={(e) => updateExercise(index, ex.id, 'reps', e.target.value)}
                                className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-white focus:border-primary outline-none"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="text-[10px] text-foreground-muted uppercase tracking-wider">Descanso (s)</label>
                              <input 
                                type="number" 
                                value={ex.restSeconds}
                                onChange={(e) => updateExercise(index, ex.id, 'restSeconds', parseInt(e.target.value) || 0)}
                                className="w-full bg-surface border border-border rounded px-2 py-1 text-sm text-white focus:border-primary outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 border-2 border-dashed border-border rounded-xl mb-4">
                      <Dumbbell className="w-8 h-8 text-foreground-muted/50 mx-auto mb-2" />
                      <p className="text-sm text-foreground-muted">Nenhum exercício adicionado</p>
                    </div>
                  )}
                  
                  <Button size="sm" variant="outline" fullWidth className="text-xs" onClick={() => openExerciseModal(index)}>
                    <Plus className="w-4 h-4 mr-1" /> Adicionar Exercício
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-5">
              <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                <Import className="w-4 h-4 text-primary" />
                Importar Treino
              </h3>
              <p className="text-sm text-foreground-muted mb-4">
                Cole o código ou JSON do treino de um amigo para importar diretamente.
              </p>
              <Button variant="outline" fullWidth className="border-primary/30 text-primary hover:bg-primary/10">
                Importar de Código
              </Button>
            </CardContent>
          </Card>

          <Button 
            size="lg" 
            fullWidth 
            onClick={handleSave}
            className="shadow-[0_4px_20px_rgba(0,255,136,0.2)]"
          >
            <Save className="w-5 h-5 mr-2" /> SALVAR PLANO
          </Button>
        </motion.div>
      </div>

      {/* Exercise Library Modal */}
      {isExerciseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsExerciseModalOpen(false)}>
          <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl relative border-primary/30" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <CardHeader className="pb-4 border-b border-border">
              <div className="flex justify-between items-center mb-4">
                <CardTitle>Adicionar Exercício</CardTitle>
                <button onClick={() => setIsExerciseModalOpen(false)} className="p-2 text-foreground-muted hover:text-white transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Buscar por nome ou músculo..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-surface border border-border rounded-xl py-2.5 pl-9 pr-4 text-sm text-white focus:border-primary outline-none"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredExercises.length > 0 ? (
                filteredExercises.map(ex => (
                  <div 
                    key={ex.id}
                    onClick={() => handleAddExercise(ex)}
                    className="flex justify-between items-center p-3 bg-surface hover:bg-surface-light rounded-xl border border-transparent hover:border-primary/50 cursor-pointer transition-all group gap-4"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-background overflow-hidden shrink-0 flex items-center justify-center border border-border">
                        {ex.mediaUrl ? (
                          ex.mediaUrl.endsWith('.mp4') ? (
                            <video src={ex.mediaUrl} className="w-full h-full object-cover" muted playsInline />
                          ) : (
                            <img src={ex.mediaUrl} alt={ex.name} className="w-full h-full object-cover" />
                          )
                        ) : ex.youtubeId ? (
                          <img src={`https://img.youtube.com/vi/${ex.youtubeId}/default.jpg`} alt={ex.name} className="w-full h-full object-cover" />
                        ) : (
                          <Dumbbell className="w-5 h-5 text-foreground-muted/50" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-white group-hover:text-primary transition-colors line-clamp-1">{ex.name}</h4>
                        <span className="text-xs text-foreground-muted">{ex.muscleGroup}</span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                      <Plus className="w-4 h-4 text-foreground-muted group-hover:text-primary" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-foreground-muted">
                  Nenhum exercício encontrado.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
