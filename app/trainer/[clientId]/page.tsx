"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Dumbbell, Zap, Calendar, Trophy, Activity, CheckCircle2, History } from 'lucide-react';
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

  useEffect(() => {
    async function loadData() {
      if (!clientId) return;
      
      // Load Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', clientId)
        .single();
        
      if (profileData) {
        setClientProfile(profileData);
      } else {
        alert('Aluno não encontrado.');
        router.push('/trainer');
        return;
      }

      // Load History
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Estatísticas
  const totalWorkouts = history.length;
  const totalVolume = history.reduce((sum, h) => sum + (h.totalVolume || 0), 0);
  const currentWeekWorkouts = history.filter(h => {
    const today = new Date();
    const workoutDate = new Date(h.date);
    const diffDays = Math.ceil(Math.abs(today.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24)); 
    return diffDays <= 7;
  }).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 pb-32">
      <button 
        onClick={() => router.push('/trainer')}
        className="flex items-center text-foreground-muted hover:text-primary transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para o Painel
      </button>

      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold font-outfit shadow-lg shadow-primary/10">
            {(clientProfile?.name || 'A').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-outfit font-bold text-white mb-1">{clientProfile?.name || 'Aluno'}</h1>
            <p className="text-gray-400">
              {clientProfile?.age} anos • {clientProfile?.weight}kg • {clientProfile?.height}cm
            </p>
            <div className="flex gap-2 mt-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-surface-light rounded-md border border-white/5">{clientProfile?.level}</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-primary/10 text-primary rounded-md border border-primary/20">{clientProfile?.goal}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 min-w-[200px]">
          <Link href={`/trainer/${clientId}/ai-builder`}>
            <Button size="lg" fullWidth className="shadow-[0_4px_20px_rgba(0,255,136,0.3)]">
              GERAR COM IA <Zap className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href={`/trainer/${clientId}/manual-builder`}>
            <Button size="lg" variant="outline" fullWidth className="border-primary/50 hover:bg-primary/10">
              MONTAR MANUAL <Dumbbell className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-surface/50 border-white/5">
          <CardContent className="p-5">
            <Calendar className="w-5 h-5 text-blue-400 mb-2" />
            <p className="text-xs text-foreground-muted uppercase tracking-wider font-semibold mb-1">Treinos na Semana</p>
            <h3 className="text-2xl font-bold">{currentWeekWorkouts}</h3>
          </CardContent>
        </Card>
        <Card className="bg-surface/50 border-white/5">
          <CardContent className="p-5">
            <Trophy className="w-5 h-5 text-yellow-400 mb-2" />
            <p className="text-xs text-foreground-muted uppercase tracking-wider font-semibold mb-1">Total de Treinos</p>
            <h3 className="text-2xl font-bold">{totalWorkouts}</h3>
          </CardContent>
        </Card>
        <Card className="bg-surface/50 border-white/5 col-span-2 md:col-span-1">
          <CardContent className="p-5">
            <Activity className="w-5 h-5 text-primary mb-2" />
            <p className="text-xs text-foreground-muted uppercase tracking-wider font-semibold mb-1">Volume Total</p>
            <h3 className="text-2xl font-bold">{totalVolume.toLocaleString()} kg</h3>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-outfit font-bold mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-primary" /> Histórico de Treinos do Aluno
        </h2>
        {history.length > 0 ? (
          <div className="space-y-3">
            {history.slice(0, 5).map((entry, index) => (
              <Card key={entry.id || index} className="bg-surface border-white/5">
                <CardContent className="p-4 flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div>
                    <h3 className="font-bold text-white text-lg">{entry.workoutPlanName}</h3>
                    <p className="text-sm text-primary mb-2">{entry.sessionName}</p>
                    <p className="text-xs text-foreground-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(entry.date).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  
                  <div className="flex gap-4 md:text-right">
                    <div>
                      <p className="text-[10px] text-foreground-muted uppercase tracking-wider font-semibold">Volume</p>
                      <p className="font-mono text-white">{entry.totalVolume} kg</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-foreground-muted uppercase tracking-wider font-semibold">Tempo</p>
                      <p className="font-mono text-white">{Math.floor(entry.durationSeconds / 60)}m {entry.durationSeconds % 60}s</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {history.length > 5 && (
              <p className="text-center text-sm text-foreground-muted mt-4">
                Mostrando os últimos 5 treinos.
              </p>
            )}
          </div>
        ) : (
          <Card className="bg-surface/30 border-white/5 border-dashed">
            <CardContent className="p-10 text-center flex flex-col items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-foreground-muted opacity-20 mb-3" />
              <p className="text-foreground-muted">Este aluno ainda não registrou nenhum treino concluído.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
