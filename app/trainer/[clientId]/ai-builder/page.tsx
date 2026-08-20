"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Zap, Loader2, ArrowLeft } from 'lucide-react';
import { Exercise as DbExercise } from '@/lib/types';
import { getExercises } from '@/lib/db/exercises';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAppContext } from '@/app/context/AppContext';
import { mapAnamneseLocationToEquipment } from '@/lib/trainingLocation';

export default function TrainerAIGenerator() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const supabase = createClient();
  const { profile: trainerProfile } = useAppContext();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [dbExercises, setDbExercises] = useState<DbExercise[]>([]);
  const [form, setForm] = useState({
    goal: 'Hipertrofia',
    level: 'Intermediário',
    daysPerWeek: 4,
    duration: 60,
    equipment: 'Academia completa',
    priorities: [] as string[],
    limitations: '',
    trainingMethod: 'tradicional',
  });

  useEffect(() => {
    async function loadClient() {
      if (!clientId) return;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', clientId)
        .single();
      
      if (data) {
        setClientProfile(data);
        setForm(prev => ({
          ...prev,
          goal: data.goal || 'Hipertrofia',
          level: data.level || 'Intermediário',
          equipment: mapAnamneseLocationToEquipment(data.training_location),
          limitations: data.intent || ''
        }));
      }
    }
    loadClient();
    getExercises().then(setDbExercises);
  }, [clientId, supabase]);

  const TRAINING_METHODS = [
    { id: 'tradicional', label: 'Tradicional', icon: '🏋️', desc: 'Séries e repetições padrão com descanso entre séries' },
    { id: 'superset', label: 'Superset', icon: '⚡', desc: 'Dois exercícios alternados sem descanso entre eles' },
    { id: 'drop_set', label: 'Drop Set', icon: '📉', desc: 'Reduz a carga ao falhar para continuar a série' },
    { id: 'piramide', label: 'Pirâmide', icon: '🔺', desc: 'Aumenta a carga e reduz reps a cada série' },
    { id: 'rest_pause', label: 'Rest-Pause', icon: '⏸️', desc: 'Microdescansos dentro da própria série' },
    { id: 'circuito', label: 'Circuito', icon: '🔄', desc: 'Exercícios em sequência com mínimo descanso' },
  ];

  const handlePriorityToggle = (muscle: string) => {
    setForm(prev => {
      if (prev.priorities.includes(muscle)) {
        return { ...prev, priorities: prev.priorities.filter(p => p !== muscle) };
      }
      return { ...prev, priorities: [...prev.priorities, muscle] };
    });
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientProfile) return;
    
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/treino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: trainerProfile?.geminiApiKey,
          profile: clientProfile,
          config: form
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar treino');

      // Cruza os nomes da IA com a biblioteca local para obter os IDs reais
      const plan = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        sessions: data.sessions.map((session: any) => ({
          ...session,
          id: crypto.randomUUID(),
          exercises: session.exercises.map((ex: any) => {
            const matchedDbEx = dbExercises.find((dbEx: DbExercise) =>
              dbEx.name.trim().toLowerCase() === ex.name.trim().toLowerCase()
            );
            return {
              ...ex,
              id: crypto.randomUUID(),
              exerciseId: matchedDbEx ? matchedDbEx.id : ('custom-' + crypto.randomUUID()),
              muscleGroup: matchedDbEx ? matchedDbEx.muscleGroup : (ex.muscleGroup || 'Geral')
            };
          })
        }))
      };

      // Salva no Supabase para o ALUNO
      const { error: dbError } = await supabase.from('workout_plans').insert({
        id: plan.id,
        user_id: clientId, // ID DO ALUNO
        name: plan.name,
        split: plan.split,
        sessions: plan.sessions
      });

      if (dbError) throw dbError;

      alert('Treino gerado e enviado com sucesso para o aluno!');
      router.push(`/trainer/${clientId}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (!clientProfile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-fade-in pb-32">
      <button 
        onClick={() => router.push(`/trainer/${clientId}`)}
        className="flex items-center text-foreground-muted hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para Perfil do Aluno
      </button>

      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-outfit font-bold flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl backdrop-blur-md border border-border">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          Gerador de Treino para {clientProfile.name?.split(' ')[0]}
        </h1>
        <p className="text-foreground-muted mt-2">
          Configure a IA para montar o treino ideal para o seu aluno.
        </p>
      </header>

      <Card>
        <CardContent className="p-6 md:p-8">
          <form onSubmit={handleGenerate} className="space-y-8">
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/50 rounded-xl text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm text-foreground-muted font-medium">Objetivo Principal</label>
                <select
                  value={form.goal}
                  onChange={e => setForm({ ...form, goal: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                >
                  <option>Hipertrofia</option>
                  <option>Força</option>
                  <option>Resistência</option>
                  <option>Emagrecimento</option>
                  <option>Misto</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-foreground-muted font-medium">Nível de Experiência</label>
                <select
                  value={form.level}
                  onChange={e => setForm({ ...form, level: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                >
                  <option>Iniciante</option>
                  <option>Intermediário</option>
                  <option>Avançado</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-foreground-muted font-medium">Dias por Semana</label>
                <select
                  value={form.daysPerWeek}
                  onChange={e => setForm({ ...form, daysPerWeek: Number(e.target.value) })}
                  className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                >
                  {[2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>{n} dias</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-foreground-muted font-medium">Duração da Sessão (min)</label>
                <select
                  value={form.duration}
                  onChange={e => setForm({ ...form, duration: Number(e.target.value) })}
                  className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                >
                  <option value="45">45 minutos</option>
                  <option value="60">60 minutos</option>
                  <option value="90">90 minutos</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-foreground-muted font-medium">Equipamentos Disponíveis</label>
                <select
                  value={form.equipment}
                  onChange={e => setForm({ ...form, equipment: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                >
                  <option>Academia completa</option>
                  <option>Halteres em casa</option>
                  <option>Barra e anilhas</option>
                  <option>Sem equipamento (calistenia)</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-foreground-muted font-medium">Músculos Prioritários (Opcional)</label>
                <div className="flex flex-wrap gap-2">
                  {['Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps', 'Pernas', 'Glúteos', 'Abdômen'].map(muscle => (
                    <button
                      type="button"
                      key={muscle}
                      onClick={() => handlePriorityToggle(muscle)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        form.priorities.includes(muscle)
                          ? 'bg-accent text-white'
                          : 'bg-surface border border-border text-foreground-muted hover:bg-white/10'
                      }`}
                    >
                      {muscle}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 md:col-span-2">
                <label className="text-sm text-foreground-muted font-medium">Método de Treino</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {TRAINING_METHODS.map(method => (
                    <button
                      type="button"
                      key={method.id}
                      onClick={() => setForm({ ...form, trainingMethod: method.id })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        form.trainingMethod === method.id
                          ? 'border-primary bg-primary/10 text-white'
                          : 'border-border bg-surface text-foreground-muted hover:bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="text-xl mb-1">{method.icon}</div>
                      <div className="font-semibold text-sm">{method.label}</div>
                      <div className="text-xs text-foreground-muted/70 mt-0.5 leading-tight">{method.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-foreground-muted font-medium">Limitações, Foco ou Observações</label>
                <textarea
                  placeholder="Ex: Dor no joelho esquerdo, evitar agachamento pesado..."
                  value={form.limitations}
                  onChange={e => setForm({ ...form, limitations: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors min-h-[80px]"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              fullWidth
              size="lg"
              className="text-lg font-bold shadow-[0_0_20px_rgba(0,255,136,0.2)]"
            >
              {loading
                ? <Loader2 className="w-6 h-6 animate-spin mr-2" />
                : <Zap className="w-6 h-6 mr-2" />
              }
              {loading ? 'Gerando e enviando treino...' : 'Gerar Treino para o Aluno'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
