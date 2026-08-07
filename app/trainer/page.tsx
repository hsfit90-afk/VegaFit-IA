"use client";

import { useEffect, useState } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';

export default function TrainerDashboard() {
  const { profile, userId } = useAppContext();
  const router = useRouter();
  const supabase = createClient();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is trainer or master
    if (profile && profile.role !== 'trainer' && profile.role !== 'master') {
      router.push('/');
      return;
    }

    async function loadClients() {
      if (!userId) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('trainer_id', userId);
        
      if (data) {
        setClients(data);
      }
      setLoading(false);
    }

    if (profile && (profile.role === 'trainer' || profile.role === 'master')) {
      loadClients();
    }
  }, [profile, userId, router, supabase]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-outfit font-bold text-white mb-2">Painel do Treinador</h1>
          <p className="text-gray-400">Gerencie seus alunos e acompanhe o progresso.</p>
        </div>
        <button 
          onClick={() => alert(`Seu link de convite: ${window.location.origin}/register?trainer=${userId}`)}
          className="bg-primary text-black font-semibold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
        >
          + Convidar Aluno
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 bg-surface border-white/5">
          <h3 className="text-gray-400 font-medium mb-1">Total de Alunos</h3>
          <p className="text-4xl font-bold text-white">{clients.length}</p>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-outfit font-bold mb-4">Meus Alunos</h2>
        {clients.length === 0 ? (
          <div className="bg-surface border border-white/5 rounded-xl p-8 text-center text-gray-400">
            Você ainda não tem alunos cadastrados.
            <br />
            Envie seu link de convite para começar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map(client => (
              <Card key={client.id} className="p-6 bg-surface border-white/5 hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => alert('Em breve: Ver progresso e montar treino para ' + client.name)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-white">{client.name || 'Aluno Sem Nome'}</h3>
                    <p className="text-sm text-gray-400">{client.goal || 'Sem objetivo definido'}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                    {(client.name || 'A').charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="text-sm text-gray-500 mb-4">
                  Criado em {new Date(client.created_at || Date.now()).toLocaleDateString('pt-BR')}
                </div>
                <button className="w-full py-2 border border-white/10 rounded-lg hover:bg-white/5 transition-colors text-sm">
                  Ver Perfil e Treinos
                </button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
