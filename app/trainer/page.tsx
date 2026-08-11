"use client";

import { useEffect, useState } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { motion } from 'motion/react';
import { 
  UserPlus, Link2, Dumbbell, Zap, BookOpen, BarChart3, 
  ChevronRight, Settings, Bell, Search, MessageCircle
} from 'lucide-react';

export default function TrainerDashboard() {
  const { profile, userId } = useAppContext();
  const router = useRouter();
  const supabase = createClient();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (profile && profile.role !== 'trainer' && profile.role !== 'master') {
      router.push('/');
      return;
    }

    async function loadClients() {
      if (!userId) return;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('trainer_id', userId);
        
      if (data && data.length > 0) {
        setClients(data);
      } else {
        // ── DEMO: Aluno fictício para preview ──
        setClients([{
          id: 'demo-client-001',
          name: 'Seliane Bezerra da Silva',
          age: 28,
          weight: 65,
          height: 165,
          goal: 'Hipertrofia',
          level: 'Intermediário',
          phone: '11999999999',
          trainer_notes: '',
        }]);
      }
      setLoading(false);
    }

    if (profile && (profile.role === 'trainer' || profile.role === 'master')) {
      loadClients();
    }
  }, [profile, userId, router]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const maxClients = profile?.maxClients || 5;
  const isAtLimit = clients.length >= maxClients;

  const handleCopyInviteLink = () => {
    if (isAtLimit) {
      alert("Você atingiu o limite máximo de alunos. Contate o administrador para aumentar o seu plano.");
      return;
    }
    const link = `${window.location.origin}/register?trainer=${profile?.id}`;
    navigator.clipboard.writeText(link).then(() => {
      alert(`Link copiado!\n\nEnvie para o seu aluno se cadastrar:\n\n${link}`);
    }).catch(() => {
      alert(`Copie o link abaixo e envie para o aluno:\n\n${link}`);
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
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
      {/* ── Header: Saudação ── */}
      <motion.header variants={itemVariants} className="mb-8 mt-2">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">👋</span>
          <h1 className="text-2xl md:text-3xl font-outfit font-bold tracking-tight text-white">
            {greeting()}, <span className="text-primary">{profile?.name || 'Treinador'}</span>
          </h1>
        </div>
        <p className="text-foreground-muted text-sm ml-11">
          {clients.length} {clients.length === 1 ? 'aluno ativo' : 'alunos ativos'}
        </p>
      </motion.header>

      {/* ── Quick Actions (4 ícones) ── */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: Bell, label: 'Notificações', color: 'text-blue-400', bg: 'bg-blue-400/10', action: () => {} },
            { icon: Link2, label: 'Link Convite', color: 'text-primary', bg: 'bg-primary/10', action: handleCopyInviteLink },
            { icon: Dumbbell, label: 'Exercícios', color: 'text-secondary', bg: 'bg-secondary/10', action: () => router.push('/library') },
            { icon: Settings, label: 'Config', color: 'text-orange-400', bg: 'bg-orange-400/10', action: () => router.push('/settings') },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl bg-surface border border-border hover:border-white/10 hover:bg-surface-hover transition-all group"
            >
              <div className={`w-11 h-11 rounded-xl ${item.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <span className="text-[11px] font-medium text-foreground-muted group-hover:text-foreground transition-colors">{item.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Seção: Seus Alunos ── */}
      <motion.div variants={itemVariants} className="mb-8">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" /> Seus alunos
        </h2>

        {/* Cards de Ação */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button 
            onClick={handleCopyInviteLink}
            disabled={isAtLimit}
            className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all group ${
              isAtLimit 
                ? 'bg-surface-light/50 opacity-50 cursor-not-allowed' 
                : 'bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 hover:border-primary/40 hover:shadow-[0_0_20px_rgba(0,255,136,0.1)]'
            }`}
          >
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-20 h-20 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
            <UserPlus className={`w-6 h-6 mb-3 ${isAtLimit ? 'text-foreground-muted' : 'text-primary'}`} />
            <p className={`font-semibold text-sm ${isAtLimit ? 'text-foreground-muted' : 'text-white'}`}>
              {isAtLimit ? 'Limite atingido' : 'Adicionar aluno'}
            </p>
          </button>

          <button 
            onClick={handleCopyInviteLink}
            disabled={isAtLimit}
            className={`relative overflow-hidden rounded-2xl p-4 text-left transition-all group ${
              isAtLimit
                ? 'bg-surface-light/50 opacity-50 cursor-not-allowed'
                : 'bg-gradient-to-br from-secondary/20 to-secondary/5 border border-secondary/20 hover:border-secondary/40 hover:shadow-[0_0_20px_rgba(124,58,237,0.1)]'
            }`}
          >
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-20 h-20 bg-secondary/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative">
              <Link2 className={`w-6 h-6 mb-3 ${isAtLimit ? 'text-foreground-muted' : 'text-secondary'}`} />
              {!isAtLimit && (
                <span className="absolute -top-1 left-5 w-5 h-5 bg-destructive rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg">
                  !
                </span>
              )}
            </div>
            <p className={`font-semibold text-sm ${isAtLimit ? 'text-foreground-muted' : 'text-white'}`}>
              Link de cadastro
            </p>
          </button>
        </div>

        {/* Barra de Capacidade */}
        <div className="bg-surface rounded-2xl border border-border p-4 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">Capacidade</span>
            <span className="text-xs font-bold text-white">{clients.length} / {maxClients}</span>
          </div>
          <div className="w-full h-2 bg-surface-light rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                isAtLimit ? 'bg-destructive' : clients.length / maxClients > 0.8 ? 'bg-warning' : 'bg-primary'
              }`}
              style={{ width: `${Math.min((clients.length / maxClients) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Barra de Pesquisa */}
        {clients.length > 0 && (
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por nome..."
                className="w-full bg-surface border border-border rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-foreground-muted/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 outline-none transition-all"
              />
            </div>

            {/* Badges de Filtro */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 bg-primary/10 text-primary rounded-full border border-primary/20">
                Ativos {clients.length}
              </span>
            </div>
          </div>
        )}

        {/* Lista de Alunos */}
        {clients.length === 0 ? (
          <div className="bg-surface/50 border border-border border-dashed rounded-2xl p-8 text-center">
            <UserPlus className="w-10 h-10 text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-foreground-muted text-sm">Você ainda não tem alunos cadastrados.</p>
            <p className="text-foreground-muted/60 text-xs mt-1">Envie seu link de convite para começar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clients
              .filter(c => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                return (c.name || '').toLowerCase().includes(term) || (c.goal || '').toLowerCase().includes(term);
              })
              .map((client, index) => (
              <motion.div
                key={client.id}
                className="w-full bg-surface border border-border hover:border-primary/30 rounded-2xl p-4 flex items-center gap-4 transition-all group hover:bg-surface-hover"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {/* Avatar — clicável */}
                <button
                  onClick={() => router.push(`/trainer/${client.id}`)}
                  className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center text-lg font-bold text-white shrink-0 shadow-inner hover:scale-105 transition-transform"
                >
                  {(client.name || 'A').charAt(0).toUpperCase()}
                </button>

                {/* Info — clicável */}
                <button
                  onClick={() => router.push(`/trainer/${client.id}`)}
                  className="flex-1 min-w-0 text-left"
                >
                  <h3 className="font-bold text-white text-base truncate group-hover:text-primary transition-colors">
                    {client.name || 'Aluno Sem Nome'}
                  </h3>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {client.level && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-surface-light rounded-md text-foreground-muted border border-white/5">
                        {client.level}
                      </span>
                    )}
                    {client.goal && (
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-primary/10 text-primary rounded-md border border-primary/20">
                        {client.goal}
                      </span>
                    )}
                  </div>
                </button>

                {/* WhatsApp Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (client.phone) {
                      const phone = client.phone.replace(/\D/g, '');
                      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(`Olá ${client.name || ''}, tudo bem?`)}`, '_blank');
                    } else {
                      const msg = encodeURIComponent(`Olá ${client.name || ''}, tudo bem? Aqui é o seu personal trainer no VegaFit!`);
                      window.open(`https://wa.me/?text=${msg}`, '_blank');
                    }
                  }}
                  className="w-10 h-10 rounded-xl bg-green-500/10 hover:bg-green-500/20 flex items-center justify-center shrink-0 transition-all hover:scale-110 group/wa"
                  title="Enviar mensagem no WhatsApp"
                >
                  <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </button>

                {/* Chevron */}
                <button
                  onClick={() => router.push(`/trainer/${client.id}`)}
                  className="shrink-0"
                >
                  <ChevronRight className="w-5 h-5 text-foreground-muted group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </button>
              </motion.div>
            ))}
            {clients.length > 0 && searchTerm && clients.filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
              <div className="text-center py-6 text-foreground-muted text-sm">
                Nenhum aluno encontrado para "{searchTerm}"
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Seção: Treinos (Grid 2x2) ── */}
      <motion.div variants={itemVariants}>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" /> Treinos
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {[
            { 
              icon: Zap, 
              label: 'AI Builder', 
              desc: 'Gerar treinos com IA',
              color: 'text-primary', 
              bg: 'bg-primary/10',
              action: () => {
                if (clients.length > 0) {
                  router.push(`/trainer/${clients[0].id}/ai-builder`);
                } else {
                  alert('Adicione um aluno primeiro para gerar treinos.');
                }
              }
            },
            { 
              icon: Dumbbell, 
              label: 'Criar Manual', 
              desc: 'Monte treino personalizado',
              color: 'text-secondary', 
              bg: 'bg-secondary/10',
              action: () => {
                if (clients.length > 0) {
                  router.push(`/trainer/${clients[0].id}/manual-builder`);
                } else {
                  alert('Adicione um aluno primeiro para criar treinos.');
                }
              }
            },
            { 
              icon: BarChart3, 
              label: 'Frequência', 
              desc: 'Acompanhe seus alunos',
              color: 'text-blue-400', 
              bg: 'bg-blue-400/10',
              action: () => {}
            },
            { 
              icon: BookOpen, 
              label: 'Exercícios', 
              desc: 'Biblioteca completa',
              color: 'text-orange-400', 
              bg: 'bg-orange-400/10',
              action: () => router.push('/library')
            },
          ].map((item, i) => (
            <button
              key={i}
              onClick={item.action}
              className="bg-surface border border-border rounded-2xl p-5 text-left hover:border-white/15 hover:bg-surface-hover transition-all group"
            >
              <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <p className="font-semibold text-sm text-white mb-0.5">{item.label}</p>
              <p className="text-[11px] text-foreground-muted">{item.desc}</p>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
