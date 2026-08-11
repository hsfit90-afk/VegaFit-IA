"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Plus, MoreVertical, Calendar, Dumbbell,
  Archive, Trash2, X, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { v4 as uuidv4 } from 'uuid';

interface Routine {
  id: string;
  name: string;
  split: string;
  start_date: string | null;
  end_date: string | null;
  routine_type: string;
  difficulty_level: string;
  status: string;
  created_at: string;
  sessions: any[];
}

export default function RoutinesPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const supabase = createClient();

  const [clientProfile, setClientProfile] = useState<any>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rotinas' | 'aerobico'>('rotinas');
  const [filter, setFilter] = useState<'active' | 'archived' | 'deleted'>('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // ── Form State (Criar Rotina) ──
  const [formName, setFormName] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formType, setFormType] = useState('Hipertrofia');
  const [formLevel, setFormLevel] = useState('Intermediário');
  const [formWorkoutType, setFormWorkoutType] = useState('Numérico');
  const [formShowStudent, setFormShowStudent] = useState(true);
  const [formAutoArchive, setFormAutoArchive] = useState(false);
  const [formGuidelines, setFormGuidelines] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!clientId) return;

      // ── DEMO: Dados fictícios para preview ──
      if (clientId === 'demo-client-001') {
        setClientProfile({ name: 'Seliane Bezerra da Silva' });
        setRoutines([{
          id: 'demo-routine-001',
          name: 'Hipertrofia 1',
          split: 'ABC',
          start_date: '2026-08-12',
          end_date: '2026-09-20',
          routine_type: 'Hipertrofia',
          difficulty_level: 'Intermediário',
          status: 'active',
          created_at: new Date().toISOString(),
          sessions: [
            { id: 'demo-s1', name: 'MMII', exercises: [] },
            { id: 'demo-s2', name: 'MMSS', exercises: [] },
            { id: 'demo-s3', name: 'MMSS + Glúteos', exercises: [] },
          ],
        }]);
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
        .eq('user_id', clientId)
        .order('created_at', { ascending: false });

      if (routineData) {
        setRoutines(routineData as Routine[]);
      }

      setLoading(false);
    }

    loadData();
  }, [clientId, supabase]);

  const filteredRoutines = routines.filter(r => {
    const status = r.status || 'active';
    return status === filter;
  });

  const handleCreateRoutine = async () => {
    if (!formName.trim()) {
      alert('Por favor, informe o nome da rotina.');
      return;
    }

    setIsSaving(true);

    const newId = uuidv4();
    const { error } = await supabase.from('workout_plans').insert({
      id: newId,
      user_id: clientId,
      name: formName,
      split: '',
      sessions: [],
      start_date: formStartDate || null,
      end_date: formEndDate || null,
      routine_type: formType,
      difficulty_level: formLevel,
      workout_type: formWorkoutType,
      show_to_student: formShowStudent,
      auto_archive: formAutoArchive,
      general_guidelines: formGuidelines || null,
      status: 'active',
    });

    setIsSaving(false);

    if (error) {
      alert('Erro ao criar rotina: ' + error.message);
      return;
    }

    // Refresh
    const { data: updated } = await supabase
      .from('workout_plans')
      .select('*')
      .eq('user_id', clientId)
      .order('created_at', { ascending: false });

    if (updated) setRoutines(updated as Routine[]);

    setShowCreateModal(false);
    resetForm();
  };

  const resetForm = () => {
    setFormName('');
    setFormStartDate('');
    setFormEndDate('');
    setFormType('Hipertrofia');
    setFormLevel('Intermediário');
    setFormWorkoutType('Numérico');
    setFormShowStudent(true);
    setFormAutoArchive(false);
    setFormGuidelines('');
  };

  const handleArchive = async (id: string) => {
    await supabase.from('workout_plans').update({ status: 'archived' }).eq('id', id);
    setRoutines(prev => prev.map(r => r.id === id ? { ...r, status: 'archived' } : r));
    setMenuOpenId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta rotina?')) return;
    await supabase.from('workout_plans').update({ status: 'deleted' }).eq('id', id);
    setRoutines(prev => prev.map(r => r.id === id ? { ...r, status: 'deleted' } : r));
    setMenuOpenId(null);
  };

  const handleRestore = async (id: string) => {
    await supabase.from('workout_plans').update({ status: 'active' }).eq('id', id);
    setRoutines(prev => prev.map(r => r.id === id ? { ...r, status: 'active' } : r));
    setMenuOpenId(null);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } }
  };

  if (loading) {
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
      {/* ── Back + Header ── */}
      <motion.div variants={itemVariants}>
        <button 
          onClick={() => router.push(`/trainer/${clientId}`)}
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

      {/* ── Tabs: Rotinas de treino | Aeróbico ── */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="flex bg-surface rounded-xl border border-border overflow-hidden">
          <button
            onClick={() => setActiveTab('rotinas')}
            className={`flex-1 py-3 text-sm font-bold transition-all ${
              activeTab === 'rotinas'
                ? 'bg-gradient-to-r from-[#0a84ff] to-[#0070e0] text-white shadow-lg'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            Rotinas de treino
          </button>
          <button
            onClick={() => setActiveTab('aerobico')}
            className={`flex-1 py-3 text-sm font-bold transition-all ${
              activeTab === 'aerobico'
                ? 'bg-gradient-to-r from-[#0a84ff] to-[#0070e0] text-white shadow-lg'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            Aeróbico
          </button>
        </div>
      </motion.div>

      {activeTab === 'rotinas' && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-4"
        >
          {/* Botão + Criar rotina */}
          <motion.div variants={itemVariants}>
            <button
              onClick={() => setShowCreateModal(true)}
              className="w-full py-3.5 border-2 border-dashed border-border hover:border-primary/40 rounded-2xl text-sm font-semibold text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Criar rotina
            </button>
          </motion.div>

          {/* Filtros: Arquivadas | Excluídas */}
          <motion.div variants={itemVariants}>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter(filter === 'archived' ? 'active' : 'archived')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  filter === 'archived'
                    ? 'bg-gradient-to-r from-[#0a84ff] to-[#0070e0] text-white shadow-lg'
                    : 'bg-surface border border-border text-foreground-muted hover:text-foreground hover:border-white/10'
                }`}
              >
                Arquivadas
              </button>
              <button
                onClick={() => setFilter(filter === 'deleted' ? 'active' : 'deleted')}
                className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                  filter === 'deleted'
                    ? 'bg-gradient-to-r from-[#0a84ff] to-[#0070e0] text-white shadow-lg'
                    : 'bg-surface border border-border text-foreground-muted hover:text-foreground hover:border-white/10'
                }`}
              >
                Excluídas
              </button>
            </div>
          </motion.div>

          {/* Lista de Rotinas */}
          {filteredRoutines.length === 0 ? (
            <motion.div variants={itemVariants} className="text-center py-12">
              <Dumbbell className="w-10 h-10 text-foreground-muted/30 mx-auto mb-3" />
              <p className="text-foreground-muted text-sm">
                {filter === 'active' ? 'Nenhuma rotina criada.' : filter === 'archived' ? 'Nenhuma rotina arquivada.' : 'Nenhuma rotina excluída.'}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {filteredRoutines.map((routine, index) => (
                <motion.div
                  key={routine.id}
                  variants={itemVariants}
                  className="relative bg-surface rounded-2xl border border-border hover:border-primary/20 p-4 transition-all group cursor-pointer"
                  onClick={() => router.push(`/trainer/${clientId}/routines/${routine.id}`)}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar da rotina */}
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center shrink-0 border border-primary/10">
                      <Dumbbell className="w-5 h-5 text-primary" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-base truncate group-hover:text-primary transition-colors">
                        {routine.name}
                      </h3>
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

                    {/* Menu (⋮) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === routine.id ? null : routine.id);
                      }}
                      className="p-2 text-foreground-muted hover:text-white transition-colors shrink-0"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {menuOpenId === routine.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        className="absolute top-14 right-4 z-20 bg-surface-light border border-border rounded-xl shadow-xl overflow-hidden min-w-[160px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {routine.status === 'active' ? (
                          <>
                            <button
                              onClick={() => handleArchive(routine.id)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground-muted hover:bg-surface-hover hover:text-white transition-colors"
                            >
                              <Archive className="w-4 h-4" /> Arquivar
                            </button>
                            <button
                              onClick={() => handleDelete(routine.id)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" /> Excluir
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleRestore(routine.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Activity className="w-4 h-4" /> Restaurar
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {activeTab === 'aerobico' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <Activity className="w-12 h-12 text-foreground-muted/30 mx-auto mb-3" />
          <p className="text-foreground-muted text-sm">Aeróbico em breve.</p>
        </motion.div>
      )}

      {/* ══════════════════════════════════════ */}
      {/*          MODAL CRIAR ROTINA            */}
      {/* ══════════════════════════════════════ */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center p-5 border-b border-border">
                <h2 className="text-lg font-bold text-white">Criar Rotina</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 text-foreground-muted hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-1.5">Nome da rotina</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-colors"
                    placeholder="Ex: Hipertrofia 1"
                  />
                </div>

                {/* Datas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground-muted mb-1.5">Data início</label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground-muted mb-1.5">Data fim</label>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Tipo e Nível */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground-muted mb-1.5">Tipo</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-colors appearance-none"
                    >
                      <option value="Hipertrofia">Hipertrofia</option>
                      <option value="Emagrecimento">Emagrecimento</option>
                      <option value="Resistência">Resistência</option>
                      <option value="Força">Força</option>
                      <option value="Funcional">Funcional</option>
                      <option value="Reabilitação">Reabilitação</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground-muted mb-1.5">Nível</label>
                    <select
                      value={formLevel}
                      onChange={(e) => setFormLevel(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-colors appearance-none"
                    >
                      <option value="Iniciante">Iniciante</option>
                      <option value="Intermediário">Intermediário</option>
                      <option value="Avançado">Avançado</option>
                    </select>
                  </div>
                </div>

                {/* Tipo de treino */}
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-1.5">Tipo de treino</label>
                  <select
                    value={formWorkoutType}
                    onChange={(e) => setFormWorkoutType(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-colors appearance-none"
                  >
                    <option value="Numérico">Numérico (1, 2, 3...)</option>
                    <option value="Alfabético">Alfabético (A, B, C...)</option>
                  </select>
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                    <span className="text-sm text-white font-medium">Mostrar para o aluno</span>
                    <button
                      onClick={() => setFormShowStudent(!formShowStudent)}
                      className={`w-12 h-7 rounded-full transition-all relative ${formShowStudent ? 'bg-primary' : 'bg-surface-light'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-1 transition-all ${formShowStudent ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-background rounded-xl border border-border">
                    <span className="text-sm text-white font-medium">Arquivar automaticamente</span>
                    <button
                      onClick={() => setFormAutoArchive(!formAutoArchive)}
                      className={`w-12 h-7 rounded-full transition-all relative ${formAutoArchive ? 'bg-primary' : 'bg-surface-light'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-1 transition-all ${formAutoArchive ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

                {/* Orientações gerais */}
                <div>
                  <label className="block text-sm font-medium text-foreground-muted mb-1.5">
                    Orientações gerais <span className="text-foreground-muted/50">(Opcional)</span>
                  </label>
                  <textarea
                    value={formGuidelines}
                    onChange={(e) => setFormGuidelines(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none transition-colors resize-y min-h-[80px]"
                    placeholder="Instruções gerais para o aluno..."
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 pt-0 space-y-2">
                <button
                  onClick={handleCreateRoutine}
                  disabled={isSaving}
                  className="w-full bg-gradient-to-r from-[#0a84ff] to-[#0070e0] hover:from-[#0070e0] hover:to-[#005bbf] rounded-xl py-3.5 text-sm font-bold text-white transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
                <button
                  onClick={() => { setShowCreateModal(false); resetForm(); }}
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
