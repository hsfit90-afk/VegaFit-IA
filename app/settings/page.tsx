"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { User, Key, Bell, Download, Trash2, CheckCircle2, Sliders, Volume2, LogOut, Info, X, ClipboardList, Dumbbell, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';
import { isPushSupported, getCurrentPushSubscription, subscribeToPush, unsubscribeFromPush } from '@/utils/push';
import { PageHeader } from '@/components/ui/PageHeader';

export default function Settings() {
  const { profile, setProfile, clearData } = useAppContext();
  const router = useRouter();
  const toast = useToast();

  // Exclusão de conta (LGPD Art. 18, V)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'EXCLUIR' || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Não conseguimos excluir sua conta agora. Tente novamente em alguns minutos.');
      }
      // A conta já não existe: limpa o estado local e sai. Vai pro /login, não pra home — sem
      // sessão o AppContext redireciona pra cá de qualquer forma, e a mensagem só piscaria.
      await clearData();
      router.push('/login?conta=excluida');
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.');
      setDeleting(false);
    }
  };
  
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
        if (!ok) toast.erro('Não foi possível ativar as notificações. Verifique se você permitiu notificações para este site.');
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
    <div className="p-5 md:p-8 max-w-3xl mx-auto animate-fade-in pb-28 md:pb-12">
      <PageHeader
        titulo="Perfil e Configurações"
        subtitulo="Gerencie sua conta e histórico físico"
        acoes={
          <Button onClick={handleSave} className="w-full md:w-auto">
            {saved ? <CheckCircle2 className="w-5 h-5 mr-2" /> : null}
            {saved ? 'Salvo!' : 'Salvar Nome'}
          </Button>
        }
      />

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

        {/* Atalho para Biblioteca de Exercícios (apenas master) */}
        {profile?.role === 'master' && (
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

        {/* Privacidade */}
        <Card className="mt-8">
          <CardContent className="flex items-center justify-between gap-4 py-5">
            <div>
              <p className="text-sm text-white font-medium mb-1">Privacidade e dados</p>
              <p className="text-xs text-foreground-muted">Veja como seus dados, incluindo os de saúde da anamnese, são usados.</p>
            </div>
            <Link href="/privacy">
              <Button variant="outline" size="sm">Ver política</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Zona de Perigo */}
        <Card className="border-destructive/20 mt-12">
          <CardHeader className="border-b border-border pb-4 mb-6">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Zona de Perigo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-sm text-white font-medium mb-1">Sair da conta</p>
              <p className="text-sm text-foreground-muted mb-3">Encerra a sessão neste dispositivo. Seus dados continuam salvos.</p>
              <Button
                onClick={() => { clearData(); router.push('/'); }}
                variant="outline"
                className="border-destructive/30 text-destructive hover:bg-destructive/10 w-full md:w-auto"
              >
                <LogOut className="w-4 h-4 mr-2" /> Sair da Conta
              </Button>
            </div>

            <div className="pt-6 border-t border-destructive/20">
              <p className="text-sm text-white font-medium mb-1">Excluir minha conta</p>
              <p className="text-sm text-foreground-muted mb-3">
                Apaga permanentemente sua conta e tudo que o app guarda sobre você, incluindo os
                dados de saúde da anamnese. Não há como desfazer.
              </p>
              <Button
                onClick={() => { setDeleteOpen(true); setDeleteConfirm(''); setDeleteError(''); }}
                className="bg-destructive text-white hover:bg-destructive/90 w-full md:w-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Excluir minha conta
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Confirmação de exclusão — exige digitar EXCLUIR, porque a ação é irreversível
          e um clique acidental apagaria meses de histórico de treino. */}
      {deleteOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-0 md:p-4"
          onClick={() => !deleting && setDeleteOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="excluir-titulo"
            aria-describedby="excluir-descricao"
            className="bg-surface border border-destructive/30 rounded-t-3xl md:rounded-2xl w-full md:max-w-lg p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 id="excluir-titulo" className="font-outfit text-xl font-bold text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" /> Excluir sua conta
              </h2>
              <button
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                aria-label="Fechar sem excluir"
                className="text-foreground-muted hover:text-white disabled:opacity-40 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div id="excluir-descricao" className="text-sm text-foreground-muted space-y-3 mb-5">
              <p className="text-white">Isto apaga <strong>para sempre</strong>:</p>
              <ul className="space-y-1.5 pl-1">
                {[
                  'Seu perfil e suas configurações',
                  'Todos os planos de treino que você gerou',
                  'Todo o histórico de treinos, cargas e progresso',
                  'Suas anamneses, com lesões e condições médicas',
                  'Seu histórico de peso corporal',
                  'Exercícios e mídias que você enviou',
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-destructive shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-destructive font-medium">
                Não é possível recuperar depois. Você precisará criar uma conta nova do zero.
              </p>
            </div>

            <label htmlFor="excluir-confirmacao" className="block text-sm text-foreground-muted mb-2">
              Para confirmar, digite <strong className="text-white font-mono">EXCLUIR</strong> abaixo:
            </label>
            <input
              id="excluir-confirmacao"
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              disabled={deleting}
              autoComplete="off"
              placeholder="EXCLUIR"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white font-mono tracking-wider focus:border-destructive focus:outline-none disabled:opacity-50"
            />

            {deleteError && (
              <p role="alert" className="text-sm text-destructive mt-3">{deleteError}</p>
            )}

            <div className="flex flex-col-reverse md:flex-row gap-3 mt-6">
              <Button
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
                variant="outline"
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'EXCLUIR' || deleting}
                className="flex-1 bg-destructive text-white hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? 'Excluindo…' : 'Excluir permanentemente'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
