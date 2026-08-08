"use client";

import { useEffect, useState } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { UserProfile } from '@/lib/types';
import { Card } from '@/components/ui/Card';

export default function AdminDashboard() {
  const { profile, userId } = useAppContext();
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
      const { data, error } = await supabase.from('profiles').select('*');
      if (data) {
        setUsers(data);
      }
      setLoading(false);
    }

    if (profile?.role === 'master') {
      loadUsers();
    }
  }, [profile, router]);

  const updateLimit = async (userId: string, currentLimit: number) => {
    const newLimit = prompt('Digite o novo limite máximo de alunos para este personal:', currentLimit.toString());
    if (newLimit !== null) {
      const parsed = parseInt(newLimit, 10);
      if (!isNaN(parsed) && parsed > 0) {
        const { error } = await supabase.from('profiles').update({ max_clients: parsed }).eq('id', userId);
        if (error) {
          alert('Erro ao atualizar limite: ' + error.message);
        } else {
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, max_clients: parsed } : u));
          alert('Limite atualizado com sucesso!');
        }
      } else {
        alert('Valor inválido.');
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
    <div className="p-6 max-w-7xl mx-auto space-y-8">
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

      <div>
        <h2 className="text-2xl font-outfit font-bold mb-4">Todos os Usuários</h2>
        <div className="bg-surface rounded-xl overflow-hidden border border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-white/5 text-gray-400 uppercase text-xs">
                <tr>
                  <th className="px-6 py-4">Nome</th>
                  <th className="px-6 py-4">Papel (Role)</th>
                  <th className="px-6 py-4">Trainer ID</th>
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
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{u.trainer_id || '-'}</td>
                    <td className="px-6 py-4 font-bold text-white">
                      {u.role === 'trainer' ? (u.max_clients || 5) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u.role === 'trainer' && (
                        <button 
                          onClick={() => updateLimit(u.id, u.max_clients || 5)}
                          className="text-xs bg-surface-light hover:bg-primary/20 hover:text-primary transition-colors px-3 py-1.5 rounded-lg border border-white/5"
                        >
                          Editar Limite
                        </button>
                      )}
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
