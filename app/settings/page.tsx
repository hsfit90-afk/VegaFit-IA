"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { User, Key, Bell, Download, Trash2, CheckCircle2, Sliders, Volume2, LogOut, Info, X, ClipboardList, Dumbbell } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { isPushSupported, getCurrentPushSubscription, subscribeToPush, unsubscribeFromPush } from '@/utils/push';

export default function Settings() {
  const { profile, setProfile, clearData } = useAppContext();
  const router = useRouter();
  
  const [form, setForm] = useState(profile || {
    name: '',
    age: 0,
    weight: 0,
    height: 0,
    goal: '',
    level: '',
    intent: '',
    geminiApiKey: '',
    soundEnabled: true,
    defaultRestTimer: 60,
    gender: 'M' as 'M' | 'F',
    waist: 0,
    hip: 0
  });

  const [saved, setSaved] = useState(false);
  const [showMeasureInfo, setShowMeasureInfo] = useState(false);
  const [pushStatus, setPushStatus] = useState<'loading' | 'unsupported' | 'subscribed' | 'unsubscribed'>('loading');
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  useEffect(() => {
    if (!isPushSupported()) {
      setPushStatus('unsupported');
      return;
    }
    getCurrentPushSubscription().then(sub => setPushStatus(sub ? 'subscribed' : 'unsubscribed'));
  }, []);

  const handleTogglePush = async () => {
    setPushBusy(true);
    try {
      if (pushStatus === 'subscribed') {
        const ok = await unsubscribeFromPush();
        if (ok) setPushStatus('unsubscribed');
      } else {
        const ok = await subscribeToPush();
        setPushStatus(ok ? 'subscribed' : 'unsubscribed');
        if (!ok) alert('Não foi possível ativar as notificações. Verifique se você permitiu notificações para este site.');
      }
    } finally {
      setPushBusy(false);
    }
  };

  const handleSave = () => {
    setProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };



  // Cálculos
  const imc = form.weight && form.height ? (form.weight / Math.pow(form.height / 100, 2)).toFixed(1) : '0';
  let imcClass = '';
  if (Number(imc) > 0) {
    if (Number(imc) < 18.5) imcClass = 'Abaixo do peso';
    else if (Number(imc) < 25) imcClass = 'Peso normal';
    else if (Number(imc) < 30) imcClass = 'Sobrepeso';
    else imcClass = 'Obesidade';
  }

  // TMB (Mifflin-St Jeor) - simplificado unissex para o app
  const tmb = form.weight && form.height && form.age 
    ? Math.round(10 * form.weight + 6.25 * form.height - 5 * form.age + 5) 
    : 0;

  // RCQ (Relação Cintura-Quadril)
  const rcq = form.waist && form.hip ? (form.waist / form.hip).toFixed(2) : '0';
  let rcqRisk = '';
  let rcqColor = 'text-foreground-muted';
  if (Number(rcq) > 0) {
    const limit = form.gender === 'F' ? 0.85 : 0.90;
    if (Number(rcq) > limit) {
      rcqRisk = 'Risco Aumentado';
      rcqColor = 'text-red-500';
    } else {
      rcqRisk = 'Risco Baixo';
      rcqColor = 'text-green-500';
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto animate-fade-in pb-32">
      <header className="mb-10 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-outfit font-bold mb-2">Perfil e Configurações</h1>
          <p className="text-foreground-muted">Gerencie sua conta e histórico físico</p>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={handleSave}
            className="w-full md:w-auto"
          >
            {saved ? <CheckCircle2 className="w-5 h-5 mr-2" /> : null}
            {saved ? 'Salvo!' : 'Salvar Nome'}
          </Button>
        </div>
      </header>

      <div className="space-y-6">
        
        {/* Atalho para Anamnese */}
        <Card className="bg-primary/5 border-primary/20 overflow-hidden relative">
          <div className="absolute -right-10 -top-10 text-primary/10">
            <ClipboardList className="w-40 h-40" />
          </div>
          <CardContent className="p-6 relative z-10 flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1">
              <h3 className="font-outfit text-xl font-bold text-white mb-2">Atualizar Anamnese</h3>
              {form.intent ? (
                <p className="text-sm text-foreground-muted mb-4 line-clamp-3 whitespace-pre-line">{form.intent}</p>
              ) : (
                <p className="text-sm text-foreground-muted mb-4">Mudou seu objetivo? Sentiu alguma dor nova? Refaça sua anamnese para que a Inteligência Artificial ajuste seus treinos.</p>
              )}
              <div className="flex flex-wrap gap-3">
                <Link href="/anamnese">
                  <Button className="w-full md:w-auto">
                    Refazer Anamnese
                  </Button>
                </Link>
                <Link href="/anamnese/history">
                  <Button variant="outline" className="w-full md:w-auto border-primary/30 text-primary hover:bg-primary/10">
                    Ver Histórico
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Atalho para Biblioteca de Exercícios (Apenas Master/Trainer) */}
        {(profile?.role === 'master' || profile?.role === 'trainer') && (
          <Card className="bg-surface border-border overflow-hidden relative">
            <div className="absolute -right-4 -top-4 text-foreground/5">
              <Dumbbell className="w-32 h-32" />
            </div>
            <CardContent className="p-6 relative z-10 flex flex-col md:flex-row items-center gap-6">
              <div className="flex-1">
                <h3 className="font-outfit text-xl font-bold text-white mb-2">Biblioteca de Exercícios</h3>
                <p className="text-sm text-foreground-muted mb-4">Adicione novos exercícios com vídeos/gifs um a um, ou importe uma pasta inteira de uma vez só no modo massa.</p>
                <Link href="/library">
                  <Button variant="outline" className="w-full md:w-auto border-primary/30 text-primary hover:bg-primary/10">
                    Gerenciar Exercícios
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dados Básicos da Conta */}
        <Card>
          <CardHeader className="border-b border-border pb-4 mb-6">
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> Conta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-foreground-muted block mb-2">Nome de Exibição</label>
                <input 
                  type="text" 
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})} 
                  className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary outline-none transition-colors" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notificações */}
        {pushStatus !== 'unsupported' && (
          <Card>
            <CardHeader className="border-b border-border pb-4 mb-6">
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" /> Notificações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-white font-medium mb-1">Lembretes de treino</p>
                  <p className="text-xs text-foreground-muted">Receba um aviso se ainda não tiver treinado no fim do dia.</p>
                </div>
                <Button
                  onClick={handleTogglePush}
                  disabled={pushBusy || pushStatus === 'loading'}
                  variant={pushStatus === 'subscribed' ? 'outline' : 'default'}
                  className={pushStatus === 'subscribed' ? 'border-primary/30 text-primary hover:bg-primary/10' : ''}
                >
                  {pushStatus === 'subscribed' ? 'Ativado' : 'Ativar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Zona de Perigo */}
        <Card className="border-destructive/20 mt-12">
          <CardHeader className="border-b border-border pb-4 mb-6">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <LogOut className="w-5 h-5" /> Zona de Perigo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground-muted mb-4">Encerre sua sessão no dispositivo atual.</p>
            <Button 
              onClick={() => { clearData(); router.push('/'); }} 
              variant="outline"
              className="border-destructive/30 text-destructive hover:bg-destructive/10 w-full md:w-auto"
            >
              Sair da Conta
            </Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
