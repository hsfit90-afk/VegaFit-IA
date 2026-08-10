"use client";

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion } from 'motion/react';
import { 
  ArrowLeft, Dumbbell, Zap, Calendar, TrendingUp, 
  ChevronRight, MessageCircle, Edit3, UserX, Trash2,
  CheckCircle2, XCircle, AlertCircle, FileText, FolderOpen
} from 'lucide-react';
import Link from 'next/link';
import { WorkoutHistoryEntry } from '@/lib/types';

export default function ClientDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;
  const supabase = createClient();
  
  const [clientProfile, setClientProfile] = useState<any>(null);
  const [history, setHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inicio' | 'opcoes'>('inicio');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!clientId) return;
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', clientId)
        .single();
        
      if (profileData) {
        setClientProfile(profileData);
        setNotes(profileData.trainer_notes || '');
      } else {
        alert('Aluno não encontrado.');
        router.push('/trainer');
        return;
      }

      const { data: historyData } = await supabase
        .from('workout_history')
        .select('data, created_at')
        .eq('user_id', clientId)
        .order('created_at', { ascending: false });

      if (historyData) {
        const parsedHistory = historyData.map(h => h.data as WorkoutHistoryEntry);
        setHistory(parsedHistory);
      }
      
      setLoading(false);
    }

    loadData();
  }, [clientId, router, supabase]);

  // ── Frequência Semanal ──
  const weeklyFrequency = useMemo(() => {
    const days = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Domingo
    startOfWeek.setHours(0, 0, 0, 0);

    return days.map((label, i) => {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + i);
      const dayStart = dayDate.getTime();
      const dayEnd = dayStart + 86400000;
      
      const trained = history.some(h => h.date >= dayStart && h.date < dayEnd);
      const isToday = i === today.getDay();
      const isPast = dayDate < today && !isToday;
      
      return { label, trained, isToday, isPast };
    });
  }, [history]);

  // ── Engajamento ──
  const engajamento = useMemo(() => {
    if (history.length === 0) return { status: 'Novo', color: 'text-blue-400', bg: 'bg-blue-400/10', lastDays: null, avgPerWeek: 0 };

    const sorted = [...history].sort((a, b) => b.date - a.date);
    const lastWorkout = sorted[0];
    const daysSinceLast = Math.floor((Date.now() - lastWorkout.date) / 86400000);

    // Frequência média (treinos nos últimos 30 dias / 4 semanas)
    const thirtyDaysAgo = Date.now() - (30 * 86400000);
    const recentCount = history.filter(h => h.date >= thirtyDaysAgo).length;
    const avgPerWeek = Math.round((recentCount / 4) * 10) / 10;

    let status = 'Ativo';
    let color = 'text-primary';
    let bg = 'bg-primary/10';
    
    if (daysSinceLast > 14) {
      status = 'Declinante';
      color = 'text-destructive';
      bg = 'bg-destructive/10';
    } else if (daysSinceLast > 7) {
      status = 'Irregular';
      color = 'text-warning';
      bg = 'bg-warning/10';
    }

    return { status, color, bg, lastDays: daysSinceLast, avgPerWeek };
  }, [history]);

  // ── Salvar Anotações ──
  const handleSaveNotes = async () => {
    setSavingNotes(true);
    await supabase
      .from('profiles')
      .update({ trainer_notes: notes })
      .eq('id', clientId);
    setSavingNotes(false);
  };

  // ── Excluir Aluno ──
  const handleDeleteClient = async () => {
    if (!confirm(`Tem certeza que deseja EXCLUIR o aluno ${clientProfile?.name}? Esta ação não pode ser desfeita.`)) return;
    
    await supabase
      .from('profiles')
      .update({ trainer_id: null })
      .eq('id', clientId);
    
    router.push('/trainer');
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
          onClick={() => router.push('/trainer')}
          className="flex items-center text-foreground-muted hover:text-primary transition-colors mb-4 text-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
        </button>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-xl font-bold text-white shadow-inner">
            {(clientProfile?.name || 'A').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-outfit font-bold text-white">
              {clientProfile?.name || 'Aluno'}
            </h1>
            <p className="text-xs text-foreground-muted mt-0.5">
              {clientProfile?.age} anos • {clientProfile?.weight}kg • {clientProfile?.height}cm
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Tabs ── */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="flex bg-surface rounded-xl border border-border p-1">
          <button
            onClick={() => setActiveTab('inicio')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'inicio'
                ? 'bg-gradient-to-r from-primary/20 to-secondary/20 text-white shadow-sm'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            Início
          </button>
          <button
            onClick={() => setActiveTab('opcoes')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'opcoes'
                ? 'bg-gradient-to-r from-primary/20 to-secondary/20 text-white shadow-sm'
                : 'text-foreground-muted hover:text-foreground'
            }`}
          >
            Opções
          </button>
        </div>
      </motion.div>

      {/* ══════════════════════════════════════ */}
      {/*              TAB INÍCIO               */}
      {/* ══════════════════════════════════════ */}
      {activeTab === 'inicio' && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {/* Quick Actions */}
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
            <Link href={`/trainer/${clientId}/ai-builder`}>
              <div className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-surface border border-border hover:border-primary/30 transition-all group">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <span className="text-[11px] font-medium text-foreground-muted">Treinos</span>
              </div>
            </Link>
            <Link href={`/trainer/${clientId}/manual-builder`}>
              <div className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-surface border border-border hover:border-secondary/30 transition-all group">
                <div className="w-11 h-11 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Dumbbell className="w-5 h-5 text-secondary" />
                </div>
                <span className="text-[11px] font-medium text-foreground-muted">Criar Manual</span>
              </div>
            </Link>
            <div className="flex flex-col items-center gap-2 py-4 rounded-2xl bg-surface border border-border hover:border-blue-400/30 transition-all group cursor-pointer">
              <div className="w-11 h-11 rounded-xl bg-blue-400/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-[11px] font-medium text-foreground-muted">Avaliações</span>
            </div>
          </motion.div>

          {/* Frequência de Treinos (Semanal) */}
          <motion.div variants={itemVariants}>
            <h3 className="text-sm font-bold text-white mb-3">Frequência de Treinos</h3>
            <div className="grid grid-cols-7 gap-2">
              {weeklyFrequency.map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
                    day.trained 
                      ? 'bg-primary/20 border-primary text-primary' 
                      : day.isToday
                      ? 'bg-warning/10 border-warning/50 text-warning'
                      : day.isPast
                      ? 'bg-surface-light border-border text-foreground-muted'
                      : 'bg-surface border-border text-foreground-muted/40'
                  }`}>
                    {day.trained ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : day.isToday ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : day.isPast ? (
                      <XCircle className="w-4 h-4 opacity-50" />
                    ) : (
                      <span className="text-xs">—</span>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${
                    day.isToday ? 'text-warning' : day.trained ? 'text-primary' : 'text-foreground-muted'
                  }`}>{day.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Engajamento do Aluno */}
          <motion.div variants={itemVariants}>
            <div className="bg-surface rounded-2xl border border-border p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-white">Engajamento do aluno</h3>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${engajamento.bg} ${engajamento.color} border ${
                  engajamento.color === 'text-destructive' ? 'border-destructive/20' : 
                  engajamento.color === 'text-warning' ? 'border-warning/20' : 
                  engajamento.color === 'text-primary' ? 'border-primary/20' : 'border-blue-400/20'
                }`}>
                  {engajamento.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-foreground-muted mb-0.5">Último treino há</p>
                  <p className="text-lg font-bold text-white">
                    {engajamento.lastDays !== null ? `${engajamento.lastDays} dias` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-foreground-muted mb-0.5">Frequência média</p>
                  <p className="text-lg font-bold text-white">{engajamento.avgPerWeek}x semana</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Links de Navegação */}
          <motion.div variants={itemVariants}>
            <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
              {[
                { icon: TrendingUp, label: 'Progresso do aluno', color: 'text-primary', bg: 'bg-primary/10' },
                { icon: Dumbbell, label: 'Treinos extras', color: 'text-secondary', bg: 'bg-secondary/10' },
                { icon: FolderOpen, label: 'Arquivos', color: 'text-orange-400', bg: 'bg-orange-400/10' },
              ].map((item, i) => (
                <button key={i} className="w-full flex items-center gap-4 p-4 hover:bg-surface-hover transition-colors text-left group">
                  <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center`}>
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                  </div>
                  <span className="flex-1 text-sm font-medium text-white">{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-foreground-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </motion.div>

          {/* Anotações */}
          <motion.div variants={itemVariants}>
            <h3 className="text-sm font-bold text-white mb-3">Anotações</h3>
            <div className="bg-surface rounded-2xl border border-border overflow-hidden">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="Digite suas anotações aqui..."
                className="w-full bg-transparent p-4 text-sm text-foreground placeholder-foreground-muted/40 resize-none outline-none min-h-[120px]"
              />
              {savingNotes && (
                <div className="px-4 pb-3">
                  <span className="text-[10px] text-primary font-medium uppercase tracking-wider">Salvando...</span>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ══════════════════════════════════════ */}
      {/*              TAB OPÇÕES               */}
      {/* ══════════════════════════════════════ */}
      {activeTab === 'opcoes' && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-4"
        >
          {/* Menu de Opções */}
          <motion.div variants={itemVariants}>
            <div className="bg-surface rounded-2xl border border-border divide-y divide-border overflow-hidden">
              {/* Conversar (WhatsApp) */}
              <button
                onClick={() => {
                  const phone = clientProfile?.phone?.replace(/\D/g, '') || '';
                  const msg = encodeURIComponent(`Olá ${clientProfile?.name || ''}, tudo bem? Aqui é o seu personal trainer no VegaFit!`);
                  window.open(phone ? `https://wa.me/55${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank');
                }}
                className="w-full flex items-center gap-4 p-4 hover:bg-surface-hover transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-full bg-green-500/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <span className="flex-1 text-sm font-medium text-white">Conversar</span>
              </button>

              {/* Editar informações */}
              <button className="w-full flex items-center gap-4 p-4 hover:bg-surface-hover transition-colors text-left group">
                <div className="w-9 h-9 rounded-full bg-blue-400/10 flex items-center justify-center">
                  <Edit3 className="w-4 h-4 text-blue-400" />
                </div>
                <span className="flex-1 text-sm font-medium text-white">Editar informações do aluno</span>
              </button>
            </div>
          </motion.div>

          {/* Ações Perigosas */}
          <motion.div variants={itemVariants} className="pt-4 space-y-3">
            <button
              onClick={handleDeleteClient}
              className="w-full bg-surface border border-border hover:border-destructive/30 hover:bg-destructive/5 rounded-2xl py-3.5 text-sm font-semibold text-foreground-muted hover:text-destructive transition-all flex items-center justify-center gap-2"
            >
              <UserX className="w-4 h-4" />
              Desvincular aluno
            </button>
            <button className="w-full text-center text-sm text-destructive/60 hover:text-destructive transition-colors py-2 font-medium">
              Excluir aluno
            </button>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
