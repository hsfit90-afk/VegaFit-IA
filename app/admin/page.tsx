"use client";

import { useEffect, useState } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { UserProfile } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { FilaPersonalizado } from '@/components/FilaPersonalizado';

export default function AdminDashboard() {
  const { profile, userId } = useAppContext();
  const toast = useToast();
  const router = useRouter();
  const supabase = createClient();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is master
    if (profile && profile.role !== 'master') {
      router.push('/');
      return;
    }

    async function loadUsers() {
      // D1: era select('*'), que trazia TODA coluna de TODO perfil sem limite — incluindo
      // gemini_api_key (chave de API em texto puro), peso, altura, cintura e quadril. A tela
      // usa cinco campos; pedir o resto é vazamento gratuito, e sem limite é extração em massa
      // numa requisição. O teto de 200 é folgado para o tamanho atual e impede o pior caso.
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role, max_clients, trainer_id, subscription_status, trial_ends_at, subscription_expires_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (data) {
        setUsers(data);
      }
      setLoading(false);
    }

    if (profile?.role === 'master') {
      loadUsers();
    }
  }, [profile, router]);

  /**
   * Muda a assinatura de um aluno na mão.
   *
   * Vai pela rota de servidor, e não direto pelo Supabase, porque o gatilho da migration 34
   * preserva as colunas de assinatura em qualquer escrita vinda do navegador — inclusive a
   * sua. É proposital: o gatilho distingue backend de navegador, não master de aluno.
   */
  const [mudando, setMudando] = useState<string | null>(null);

  const mudarAssinatura = async (alvo: string, acao: string, rotulo: string, dias?: number) => {
    setMudando(alvo);
    try {
      const res = await fetch('/api/admin/assinatura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: alvo, acao, dias }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não consegui alterar.');

      // Atualiza só a linha alterada, em vez de recarregar os 200 perfis.
      setUsers(anteriores => anteriores.map(u => (u.id === alvo ? { ...u, ...data.perfil } : u)));
      toast.sucesso(`${data.perfil?.name || 'Aluno'} agora é ${rotulo}.`);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : 'Não consegui alterar.');
    } finally {
      setMudando(null);
    }
  };

  /** Texto curto do estado da assinatura, com o prazo quando existir. */
  const descreverAssinatura = (u: any): { texto: string; cor: string } => {
    const fmt = (iso?: string | null) =>
      iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';
    switch (u.subscription_status) {
      case 'cortesia':
        return { texto: 'Cortesia (vitalício)', cor: 'bg-purple-500/20 text-purple-400' };
      case 'ativo':
        return { texto: `Pago até ${fmt(u.subscription_expires_at)}`, cor: 'bg-primary/20 text-primary' };
      case 'trial':
        return { texto: `Teste até ${fmt(u.trial_ends_at)}`, cor: 'bg-blue-500/20 text-blue-400' };
      case 'cancelado':
        return { texto: `Cancelado (até ${fmt(u.subscription_expires_at)})`, cor: 'bg-yellow-500/20 text-yellow-400' };
      case 'vencido':
        return { texto: 'Sem acesso', cor: 'bg-red-500/20 text-red-400' };
      default:
        return { texto: u.subscription_status || '-', cor: 'bg-white/10 text-gray-400' };
    }
  };

  const updateLimit = async (userId: string, currentLimit: number) => {
    const newLimit = prompt('Digite o novo limite máximo de alunos para este personal:', currentLimit.toString());
    if (newLimit !== null) {
      const parsed = parseInt(newLimit, 10);
      if (!isNaN(parsed) && parsed > 0) {
        const { error } = await supabase.from('profiles').update({ max_clients: parsed }).eq('id', userId);
        if (error) {
          toast.erro('Erro ao atualizar limite: ' + error.message);
        } else {
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, max_clients: parsed } : u));
          toast.sucesso('Limite atualizado com sucesso!');
        }
      } else {
        toast.aviso('Valor inválido.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const trainers = users.filter(u => u.role === 'trainer');
  const clients = users.filter(u => u.role === 'client' || !u.role);

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-outfit font-bold text-white mb-2">Painel Master</h1>
        <p className="text-gray-400">Visão geral da plataforma VegaFit.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-surface border-white/5">
          <h3 className="text-gray-400 font-medium mb-1">Total de Usuários</h3>
          <p className="text-4xl font-bold text-white">{users.length}</p>
        </Card>
        <Card className="p-6 bg-surface border-white/5">
          <h3 className="text-gray-400 font-medium mb-1">Personal Trainers</h3>
          <p className="text-4xl font-bold text-primary">{trainers.length}</p>
        </Card>
        <Card className="p-6 bg-surface border-white/5">
          <h3 className="text-gray-400 font-medium mb-1">Alunos Ativos</h3>
          <p className="text-4xl font-bold text-blue-400">{clients.length}</p>
        </Card>
      </div>

      {/* O montador e onde o Treino do Personal e entregue; sem atalho daqui ele ficaria
          escondido numa URL que so eu conheco. */}
      <div className="mb-8">
        <a href="/admin/montar" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-outfit font-bold px-5 py-3 rounded-xl hover:bg-primary-hover transition-colors">
          Montar treino para um aluno
        </a>
      </div>

      <FilaPersonalizado />

      <div>
        <h2 className="text-2xl font-outfit font-bold mb-4">Todos os Usuários</h2>
        <div className="bg-surface rounded-xl overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-white/5 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Papel (Role)</th>
                  <th className="px-6 py-4">Assinatura</th>
                  <th className="px-6 py-4">Limite</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-medium text-white">{u.name || 'Sem nome'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold
                        ${u.role === 'master' ? 'bg-purple-500/20 text-purple-400' : 
                          u.role === 'trainer' ? 'bg-primary/20 text-primary' : 
                          'bg-blue-500/20 text-blue-400'}`}>
                        {u.role || 'client'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${descreverAssinatura(u).cor}`}>
                        {descreverAssinatura(u).texto}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-white">
                      {u.role === 'trainer' ? (u.max_clients || 5) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1.5 justify-end flex-wrap">
                        <button
                          onClick={() => mudarAssinatura(u.id, 'cortesia', 'cortesia vitalícia')}
                          disabled={mudando === u.id}
                          title="Acesso liberado para sempre, sem cobrança"
                          className="text-xs bg-surface-light hover:bg-purple-500/20 hover:text-purple-400 disabled:opacity-40 transition-colors px-2.5 py-1.5 rounded-lg border border-white/5"
                        >
                          Cortesia
                        </button>
                        <button
                          onClick={() => mudarAssinatura(u.id, 'ativo', 'pago por 30 dias', 30)}
                          disabled={mudando === u.id}
                          title="Marca como pago por 30 dias — para quem pagou por fora, no Pix"
                          className="text-xs bg-surface-light hover:bg-primary/20 hover:text-primary disabled:opacity-40 transition-colors px-2.5 py-1.5 rounded-lg border border-white/5"
                        >
                          +30 dias
                        </button>
                        <button
                          onClick={() => mudarAssinatura(u.id, 'trial', 'em teste por 7 dias', 7)}
                          disabled={mudando === u.id}
                          title="Reinicia o teste gratuito por 7 dias"
                          className="text-xs bg-surface-light hover:bg-blue-500/20 hover:text-blue-400 disabled:opacity-40 transition-colors px-2.5 py-1.5 rounded-lg border border-white/5"
                        >
                          Teste 7d
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Cortar o acesso de ${u.name || 'este aluno'}? Ele mantém o treino e o histórico, mas para de gerar treino novo.`)) {
                              mudarAssinatura(u.id, 'vencido', 'sem acesso');
                            }
                          }}
                          disabled={mudando === u.id}
                          title="Bloqueia geração de treino novo. O histórico e o plano atual continuam"
                          className="text-xs bg-surface-light hover:bg-red-500/20 hover:text-red-400 disabled:opacity-40 transition-colors px-2.5 py-1.5 rounded-lg border border-white/5"
                        >
                          Cortar
                        </button>
                        {u.role === 'trainer' && (
                          <button
                            onClick={() => updateLimit(u.id, u.max_clients || 5)}
                            className="text-xs bg-surface-light hover:bg-primary/20 hover:text-primary transition-colors px-2.5 py-1.5 rounded-lg border border-white/5"
                          >
                            Limite
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
