"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Zap, Loader2 } from 'lucide-react';
import { Exercise as DbExercise } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { getExercises } from '@/lib/db/exercises';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getHistorical1RM, calculateTargetWeight } from '@/utils/loadCalculator';

export default function Generator() {
  const { addWorkoutPlan, profile, history } = useAppContext();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Db exercises para cruzar nomes com IDs reais
  const [dbExercises, setDbExercises] = useState<DbExercise[]>([]);

  useEffect(() => {
    getExercises().then(setDbExercises);
  }, []);

  const TRAINING_METHODS = [
    { id: 'tradicional', label: 'Tradicional', icon: '🏋️', desc: 'Séries e repetições padrão com descanso entre séries' },
    { id: 'superset', label: 'Superset', icon: '⚡', desc: 'Dois exercícios alternados sem descanso entre eles' },
    { id: 'drop_set', label: 'Drop Set', icon: '📉', desc: 'Reduz a carga ao falhar para continuar a série' },
    { id: 'piramide', label: 'Pirâmide', icon: '🔺', desc: 'Aumenta a carga e reduz reps a cada série' },
    { id: 'rest_pause', label: 'Rest-Pause', icon: '⏸️', desc: 'Microdescansos dentro da própria série' },
    { id: 'circuito', label: 'Circuito', icon: '🔄', desc: 'Exercícios em sequência com mínimo descanso' },
  ];

  const [form, setForm] = useState({
    goal: profile?.goal || 'Hipertrofia',
    level: profile?.level || 'Intermediário',
    daysPerWeek: 4,
    duration: 60,
    equipment: 'Academia completa',
    priorities: [] as string[],
    limitations: profile?.intent || '',
    trainingMethod: 'tradicional',
  });

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
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/treino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: profile?.geminiApiKey,
          profile,
          config: form
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar treino');

      // BUG FIX: Validação do schema do JSON retornado pela IA
      if (!data.sessions || !Array.isArray(data.sessions) || data.sessions.length === 0) {
        throw new Error('A IA não gerou sessões de treino válidas. Por favor, tente novamente.');
      }

      // BUG FIX: Fallback para exercícios inventados pela IA
      // Se a IA criar um exercício que não existe na biblioteca, buscamos um real do mesmo músculo
      const findFallbackExercise = (muscleGroup: string, excludeName: string): DbExercise | null => {
        const normalize = (s: string) => s ? s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';
        const targetMuscle = normalize(muscleGroup);
        if (!targetMuscle || targetMuscle === 'geral') return null;
        return dbExercises.find(dbEx =>
          normalize(dbEx.muscleGroup) === targetMuscle &&
          dbEx.name.trim().toLowerCase() !== excludeName.trim().toLowerCase()
        ) || null;
      };

      // Cruza os nomes da IA com a biblioteca local para obter os IDs reais
      const plan = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        sessions: data.sessions.map((session: any) => ({
          ...session,
          id: crypto.randomUUID(),
          exercises: session.exercises.map((ex: any) => {
            // Tenta encontrar por nome exato
            const matchedDbEx = dbExercises.find((dbEx: DbExercise) =>
              dbEx.name.trim().toLowerCase() === ex.name.trim().toLowerCase()
            );

            if (matchedDbEx) {
              // Exercício encontrado na biblioteca
              return {
                ...ex,
                id: crypto.randomUUID(),
                exerciseId: matchedDbEx.id,
                muscleGroup: matchedDbEx.muscleGroup
              };
            }

            // BUG FIX: A IA inventou um exercício — tenta substituir por um real do mesmo músculo
            const fallback = findFallbackExercise(ex.muscleGroup || '', ex.name);
            if (fallback) {
              console.warn(`[VegaFit] IA inventou "${ex.name}" (não encontrado na biblioteca). Substituindo por "${fallback.name}" (${fallback.muscleGroup}).`);
              return {
                ...ex,
                id: crypto.randomUUID(),
                exerciseId: fallback.id,
                name: fallback.name,
                muscleGroup: fallback.muscleGroup
              };
            }

            // Ültimo recurso: exerce o plano sem ID válido (custom)
            console.warn(`[VegaFit] Não foi possível encontrar substituto para "${ex.name}" (músculo: ${ex.muscleGroup}).`);
            return {
              ...ex,
              id: crypto.randomUUID(),
              exerciseId: 'custom-' + crypto.randomUUID(),
              muscleGroup: ex.muscleGroup || 'Desconhecido'
            };
          }).map((ex: any) => {
            // BUG FIX / FEATURE: Calcular a carga exata baseada nos protocolos científicos
            // Pega o nome do exercício (pode ter vindo da IA ou do fallback)
            const resolvedName = ex.name;
            
            // Procura o 1RM histórico
            const oneRM = getHistorical1RM(history || [], resolvedName);
            
            if (oneRM > 0) {
              const setsCount = typeof ex.sets === 'number' ? ex.sets : 3;
              // A IA retorna a string `reps` (ex: "10-12"). Pegamos o maior número
              const maxRepsStr = ex.reps?.toString().split('-').pop();
              const targetReps = parseInt(maxRepsStr) || 10;
              
              const calculatedWeight = calculateTargetWeight(oneRM, form.goal, targetReps);
              
              // Preenche targetWeights se já houver um RM calculado
              if (calculatedWeight > 0) {
                ex.targetWeights = Array(setsCount).fill(calculatedWeight);
              }
            }

            return ex;
          })
        }))
      };

      // Salva e vai direto para treinar — sem prévia desnecessária
      addWorkoutPlan(plan);
      router.push('/active');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-fade-in pb-32">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-outfit font-bold flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl backdrop-blur-md border border-border">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          Gerador de Treino IA
        </h1>
        <p className="text-foreground-muted mt-2">
          Configure e gere seu treino. Após gerar, você irá direto para treinar!
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
                <label className="text-sm text-foreground-muted font-medium">Equipamentos</label>
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
                <label className="text-sm text-foreground-muted font-medium">Limitações, Foco ou Intenção</label>
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
              {loading ? 'Gerando e salvando treino...' : 'Gerar Treino com IA'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
