"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { 
  ArrowLeft, Plus, MoreVertical, Calendar, Dumbbell,
  Eye, EyeOff, BarChart3, MessageSquare, GripVertical,
  Trash2, X, ArrowUpDown
} from 'lucide-react';
import { WorkoutSession } from '@/lib/types';
import { useAppContext } from '@/app/context/AppContext';
import { v4 as uuidv4 } from 'uuid';

interface RoutineData {
  id: string;
  name: string;
  split: string;
  sessions: WorkoutSession[];
  start_date: string | null;
  end_date: string | null;
  routine_type: string;
  difficulty_level: string;
  workout_type: string;
  show_to_student: boolean;
  auto_archive: boolean;
  general_guidelines: string | null;
  status: string;
}

export default function RoutineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const routineId = params.routineId as string;
  const supabase = createClient();
  const { profile: viewerProfile } = useAppContext();

  const [clientProfile, setClientProfile] = useState<any>(null);
  const [routine, setRoutine] = useState<RoutineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // ── Form State (Adicionar Treino) ──
  const [formTrainingNumber, setFormTrainingNumber] = useState(1);
  const [formTrainingName, setFormTrainingName] = useState('');
  const [formTrainingGuidelines, setFormTrainingGuidelines] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!clientId || !routineId) return;

      // ── DEMO: Dados fictícios para preview ──
      if (clientId === 'demo-client-001') {
        setClientProfile({ name: 'Seliane Bezerra da Silva' });
        setRoutine({
          id: 'demo-routine-001',
          name: 'Hipertrofia 1',
          split: 'ABC',
          start_date: '2026-08-12',
          end_date: '2026-09-20',
          routine_type: 'Hipertrofia',
          difficulty_level: 'Intermediário',
          workout_type: 'Numérico',
          show_to_student: true,
          auto_archive: false,
          general_guidelines: 'Manter cadência 3-1-2 em todos os exercícios. Descanso de 60-90s entre séries.',
          status: 'active',
          sessions: [
            { id: 'demo-s1', name: 'MMII', exercises: [] },
            { id: 'demo-s2', name: 'MMSS', exercises: [] },
            { id: 'demo-s3', name: 'MMSS + Glúteos', exercises: [] },
          ],
        });
        setFormTrainingNumber(4);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', clientId)
        .single();
      
      if (profile) setClientProfile(profile);

      const { data: routineData } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('id', routineId)
        .single();

      if (routineData) {
        setRoutine(routineData as RoutineData);
        const sessions = routineData.sessions || [];
        setFormTrainingNumber(sessions.length + 1);
      } else {
        alert('Rotina não encontrada.');
        router.push(`/trainer/${clientId}/routines`);
      }

      setLoading(false);
    }

    loadData();
  }, [clientId, routineId, supabase, router]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  };

  const getSessionLabel = (index: number) => {
    if (!routine) return `Treino ${index + 1}`;
    if (routine.workout_type === 'Alfabético') {
      return `Treino ${String.fromCharCode(65 + index)}`;
    }
    return `Treino ${index + 1}`;
  };

  // ── Adicionar Treino ──
  const handleAddTraining = async () => {
    if (!routine) return;

    setIsSaving(true);

    const newSession: WorkoutSession = {
      id: uuidv4(),
      name: formTrainingName || `Treino ${formTrainingNumber}`,
      exercises: [],
    };

    const updatedSessions = [...(routine.sessions || [])];
    // Inserir na posição correta
    const insertIndex = Math.min(formTrainingNumber - 1, updatedSessions.length);
    updatedSessions.splice(insertIndex, 0, newSession);

    const { error } = await supabase
      .from('workout_plans')
      .update({ sessions: updatedSessions })
      .eq('id', routineId);

    setIsSaving(false);

    if (error) {
      alert('Erro ao adicionar treino: ' + error.message);
      return;
    }

    setRoutine({ ...routine, sessions: updatedSessions });
    setShowAddModal(false);
    setFormTrainingName('');
    setFormTrainingGuidelines('');
    setFormTrainingNumber(updatedSessions.length + 1);
  };

  // ── Remover Treino ──
  const handleRemoveTraining = async (sessionId: string) => {
    if (!routine) return;
    if (!confirm('Tem certeza que deseja remover este treino?')) return;

    const updatedSessions = routine.sessions.filter(s => s.id !== sessionId);

    const { error } = await supabase
      .from('workout_plans')
      .update({ sessions: updatedSessions })
      .eq('id', routineId);

    if (!error) {
      setRoutine({ ...routine, sessions: updatedSessions });
    }
    setMenuOpenId(null);
  };

  // ── Reordenar Treinos ──
  const moveSession = async (fromIndex: number, toIndex: number) => {
    if (!routine) return;
    const sessions = [...routine.sessions];
    const [moved] = sessions.splice(fromIndex, 1);
    sessions.splice(toIndex, 0, moved);

    setRoutine({ ...routine, sessions });

    await supabase
      .from('workout_plans')
      .update({ sessions })
      .eq('id', routineId);
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } }
  };

  if (loading || !routine) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <motion.div 
      className="p-5 md:p-8 max-w-4xl mx-auto min-h-screen pb-32"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* ── Back ── */}
      <motion.div variants={itemVariants}>
        <button 
          onClick={() => router.push(`/trainer/${clientId}/routines`)}
          className="flex items-center text-foreground-muted hover:text-primary transition-colors mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-xl font-bold text-white shadow-inner">
            {(clientProfile?.name || 'A').charAt(0).toUpperCase()}
          </div>
          <h1 className="text-xl md:text-2xl font-outfit font-bold text-white">
            {clientProfile?.name || 'Aluno'}
          </h1>
        </div>
      </motion.div>

      {/* ── Routine Header Card ── */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="bg-surface rounded-2xl border border-border p-5">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center shrink-0 border border-primary/10">
              <Dumbbell className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">{routine.name}</h2>
                  {(routine.start_date || routine.end_date) && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Calendar className="w-3 h-3 text-foreground-muted" />
                      <span className="text-xs text-foreground-muted">
                        {formatDate(routine.start_date)} — {formatDate(routine.end_date)}
                      </span>
                    </div>
                  )}
                  <div className="flex gap-1.5 mt-1.5">
                    {routine.routine_type && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-primary/10 text-primary rounded-md border border-primary/20">
                        {routine.routine_type}
                      </span>
                    )}
                    {routine.difficulty_level && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-surface-light text-foreground-muted rounded-md border border-white/5">
                        {routine.difficulty_level}
                      </span>
                    )}
                  </div>
                </div>
                <button className="p-1.5 text-foreground-muted hover:text-white transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Info Fields */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-foreground-muted">Tipo de treino:</span>
              <span className="text-sm text-white">{routine.workout_type || 'Numérico'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-foreground-muted">Mostrar para o aluno:</span>
              <span className="text-sm text-white">{routine.show_to_student ? 'Sim' : 'Não'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-foreground-muted">Arquivar automaticamente:</span>
              <span className="text-sm text-white">{routine.auto_archive ? 'Sim' : 'Não'}</span>
            </div>
          </div>

          {/* Orientações Gerais */}
          <button
            onClick={() => setShowGuidelines(!showGuidelines)}
            className="w-full flex items-center justify-between p-3 bg-background rounded-xl border border-border hover:border-white/10 transition-all"
          >
            <span className="text-sm font-medium text-white">Orientações gerais</span>
            {showGuidelines ? (
              <EyeOff className="w-4 h-4 text-foreground-muted" />
            ) : (
              <Eye className="w-4 h-4 text-foreground-muted" />
            )}
          </button>
          <AnimatePresence>
            {showGuidelines && routine.general_guidelines && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <p className="p-3 text-sm text-foreground-muted leading-relaxed">
                  {routine.general_guidelines}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Action Buttons ── */}
      <motion.div variants={itemVariants} className="flex gap-3 mb-6">
        <button
          onClick={() => setIsReordering(!isReordering)}
          className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border ${
            isReordering 
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-surface border-border text-foreground-muted hover:text-white hover:border-white/10'
          }`}
        >
          <ArrowUpDown className="w-4 h-4" /> Reordenar treinos
        </button>
        <button
          onClick={() => {
            setFormTrainingNumber((routine.sessions || []).length + 1);
            setFormTrainingName('');
            setFormTrainingGuidelines('');
            setShowAddModal(true);
          }}
          className="flex-1 bg-gradient-to-r from-[#0a84ff] to-[#0070e0] hover:from-[#0070e0] hover:to-[#005bbf] rounded-xl py-3 text-sm font-bold text-white transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Adicionar treino
        </button>
      </motion.div>

      {/* ── Lista de Treinos ── */}
      {(!routine.sessions || routine.sessions.length === 0) ? (
        <motion.div variants={itemVariants} className="text-center py-12 bg-surface rounded-2xl border border-border">
          <Dumbbell className="w-10 h-10 text-foreground-muted/30 mx-auto mb-3" />
          <p className="text-foreground-muted text-sm">Nenhum treino adicionado.</p>
          <p className="text-foreground-muted/50 text-xs mt-1">Clique em &quot;+ Adicionar treino&quot; para começar.</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {routine.sessions.map((session, index) => (
            <motion.div
              key={session.id}
              variants={itemVariants}
              className="bg-surface rounded-2xl border border-border p-5 transition-all"
            >
              {/* Session Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  {isReordering && (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => index > 0 && moveSession(index, index - 1)}
                        disabled={index === 0}
                        className="p-0.5 text-foreground-muted hover:text-primary disabled:opacity-30 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <button
                        onClick={() => index < routine.sessions.length - 1 && moveSession(index, index + 1)}
                        disabled={index === routine.sessions.length - 1}
                        className="p-0.5 text-foreground-muted hover:text-primary disabled:opacity-30 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {getSessionLabel(index)}
                    </h3>
                    <p className="text-xs text-foreground-muted mt-0.5">
                      {session.name}
                    </p>
                  </div>
                </div>
                
                <div className="relative">
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === session.id ? null : session.id)}
                    className="p-1.5 text-foreground-muted hover:text-white transition-colors"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>

                  <AnimatePresence>
                    {menuOpenId === session.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute top-8 right-0 z-20 bg-surface-light border border-border rounded-xl shadow-xl overflow-hidden min-w-[150px]"
                      >
                        {viewerProfile?.role === 'master' && (
                          <button
                            onClick={() => {
                              router.push(`/trainer/${clientId}/manual-builder?routineId=${routineId}&sessionId=${session.id}`);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground-muted hover:bg-surface-hover hover:text-white transition-colors"
                          >
                            <Dumbbell className="w-4 h-4" /> Editar exercícios
                          </button>
                        )}
                        <button
                          onClick={() => handleRemoveTraining(session.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" /> Remover
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Status */}
              <p className="text-xs text-foreground-muted/60 italic mb-4">
                {session.exercises.length === 0
                  ? 'Nenhum exercício adicionado ainda'
                  : `${session.exercises.length} exercício${session.exercises.length > 1 ? 's' : ''} • Seu aluno ainda não executou esse treino`
                }
              </p>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  className="flex-1 bg-gradient-to-r from-[#0a84ff] to-[#0070e0] hover:from-[#0070e0] hover:to-[#005bbf] rounded-xl py-2.5 text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <BarChart3 className="w-3.5 h-3.5" /> Evolução
                </button>
                <button
                  className="flex-1 border border-border hover:border-white/20 rounded-xl py-2.5 text-xs font-bold text-foreground-muted hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Feedbacks
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════ */}
      {/*       MODAL ADICIONAR TREINO           */}
      {/* ══════════════════════════════════════ */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-5 border-b border-border">
                <h2 className="text-lg font-bold text-white">Treino</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 text-foreground-muted hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4">
                {/* Treino Number */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-1.5">Treino</label>
                  <input
                    type="number"
                    min={1}
                    value={formTrainingNumber}
                    onChange={(e) => setFormTrainingNumber(parseInt(e.target.value) || 1)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-colors"
                  />
                </div>

                {/* Nome */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-1.5">Nome</label>
                  <input
                    type="text"
                    value={formTrainingName}
                    onChange={(e) => setFormTrainingName(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-colors"
                    placeholder="Ex: MMII, MMSS, Push..."
                  />
                </div>

                {/* Orientações gerais */}
                <div>
                  <label className="block text-sm font-semibold text-white mb-1.5">
                    Orientações gerais <span className="text-foreground-muted/50 font-normal">(Opcional)</span>
                  </label>
                  <textarea
                    value={formTrainingGuidelines}
                    onChange={(e) => setFormTrainingGuidelines(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-colors resize-y min-h-[80px]"
                    placeholder="Instruções específicas para este treino..."
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 pt-0 space-y-2">
                <button
                  onClick={handleAddTraining}
                  disabled={isSaving}
                  className="w-full bg-gradient-to-r from-[#0a84ff] to-[#0070e0] hover:from-[#0070e0] hover:to-[#005bbf] rounded-xl py-3.5 text-sm font-bold text-white transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-full border border-border rounded-xl py-3 text-sm font-semibold text-foreground-muted hover:text-white hover:border-white/20 transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
