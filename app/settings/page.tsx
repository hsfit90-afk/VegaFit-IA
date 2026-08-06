"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { User, Key, Bell, Download, Trash2, CheckCircle2, Sliders, Volume2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

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
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const handleSave = () => {
    setProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleClear = () => {
    if (window.confirm("Tem certeza que deseja apagar TODOS os seus dados, histórico e treinos? Essa ação não pode ser desfeita.")) {
      clearData();
      router.push('/');
    }
  };

  const exportData = () => {
    const data = {
      profile: localStorage.getItem('fitforge_profile'),
      plans: localStorage.getItem('fitforge_plans'),
      history: localStorage.getItem('fitforge_history'),
      chat: localStorage.getItem('fitforge_coach_history')
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitforge_backup_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-fade-in pb-32">
      <header className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-3xl md:text-4xl font-outfit font-bold mb-2">Perfil e Configurações</h1>
          <p className="text-foreground-muted">Gerencie seus dados e preferências</p>
        </div>
        <Button 
          onClick={handleSave}
          size="lg"
        >
          {saved ? <CheckCircle2 className="w-5 h-5 mr-2" /> : null}
          {saved ? 'Salvo!' : 'Salvar'}
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader className="border-b border-border pb-4 mb-6">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" /> Dados Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm text-foreground-muted block mb-2">Nome</label>
                  <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-sm text-foreground-muted block mb-2">Idade</label>
                  <input type="number" value={form.age || ''} onChange={e => setForm({...form, age: Number(e.target.value)})} className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-sm text-foreground-muted block mb-2">Peso (kg)</label>
                  <input type="number" value={form.weight || ''} onChange={e => setForm({...form, weight: Number(e.target.value)})} className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-sm text-foreground-muted block mb-2">Altura (cm)</label>
                  <input type="number" value={form.height || ''} onChange={e => setForm({...form, height: Number(e.target.value)})} className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-sm text-foreground-muted block mb-2">Objetivo Principal</label>
                  <select value={form.goal || ''} onChange={e => setForm({...form, goal: e.target.value})} className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary outline-none transition-colors">
                    <option value="">Selecione...</option>
                    <option value="Hipertrofia">Hipertrofia</option>
                    <option value="Força">Força</option>
                    <option value="Emagrecimento">Emagrecimento</option>
                    <option value="Condicionamento">Condicionamento</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-foreground-muted block mb-2">Nível de Experiência</label>
                  <select value={form.level || ''} onChange={e => setForm({...form, level: e.target.value})} className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary outline-none transition-colors">
                    <option value="">Selecione...</option>
                    <option value="Iniciante">Iniciante</option>
                    <option value="Intermediário">Intermediário</option>
                    <option value="Avançado">Avançado</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-6">
                <label className="text-sm text-foreground-muted block mb-2">Limitações, Foco ou Intenção</label>
                <textarea 
                  value={form.intent || ''} 
                  onChange={e => setForm({...form, intent: e.target.value})} 
                  placeholder="Ex: Tenho dor no joelho, quero focar muito em costas..."
                  className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary outline-none min-h-[100px] resize-y transition-colors" 
                />
              </div>
            </CardContent>
          </Card>


        </div>

        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-primary/20 to-transparent border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-primary text-lg">Métricas Calculadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mt-2">
                <div>
                  <p className="text-sm text-foreground-muted mb-1">IMC</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-mono font-bold text-white">{imc}</span>
                    <span className="text-sm text-primary pb-1">{imcClass}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted mb-1">TMB (Basal)</p>
                  <p className="text-2xl font-mono font-bold text-white">{tmb} <span className="text-sm text-foreground-muted font-sans">kcal/dia</span></p>
                </div>
                <div>
                  <p className="text-sm text-foreground-muted mb-1">Gasto Est. (Treino)</p>
                  <p className="text-2xl font-mono font-bold text-white">{Math.round(tmb * 1.55)} <span className="text-sm text-foreground-muted font-sans">kcal/dia</span></p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 mt-2">
              <Button onClick={exportData} variant="outline" fullWidth className="text-sm justify-center text-foreground font-semibold h-12 border-border">
                <Download className="w-4 h-4 mr-2" /> Exportar Backup
              </Button>
              <Button onClick={handleClear} variant="danger" fullWidth className="text-sm justify-center h-12">
                <Trash2 className="w-4 h-4 mr-2" /> Apagar Tudo
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
