"use client";

import { useState, useEffect } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { User, Key, Bell, Download, Trash2, CheckCircle2, Sliders, Volume2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

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
    <div className="p-6 md:p-10 max-w-4xl mx-auto animate-fade-in">
      <header className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-3xl md:text-4xl font-outfit font-bold mb-2">Perfil e Configurações</h1>
          <p className="text-gray-400">Gerencie seus dados e preferências</p>
        </div>
        <button 
          onClick={handleSave}
          className="px-6 py-3 bg-[#00ff88] text-[#0a0a0f] font-bold rounded-xl flex items-center gap-2 hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] transition-all"
        >
          {saved ? <CheckCircle2 className="w-5 h-5" /> : 'Salvar'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-[24px] p-6 md:p-8">
            <h2 className="text-xl font-outfit font-semibold mb-6 flex items-center gap-2 border-b border-white/5 pb-4"><User className="w-5 h-5 text-[#7c3aed]" /> Dados Pessoais</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm text-gray-400 block mb-2">Nome</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-3 text-white focus:border-[#7c3aed] outline-none" />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Idade</label>
                <input type="number" value={form.age || ''} onChange={e => setForm({...form, age: Number(e.target.value)})} className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-3 text-white focus:border-[#7c3aed] outline-none" />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Peso (kg)</label>
                <input type="number" value={form.weight || ''} onChange={e => setForm({...form, weight: Number(e.target.value)})} className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-3 text-white focus:border-[#7c3aed] outline-none" />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Altura (cm)</label>
                <input type="number" value={form.height || ''} onChange={e => setForm({...form, height: Number(e.target.value)})} className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-3 text-white focus:border-[#7c3aed] outline-none" />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Objetivo Principal</label>
                <select value={form.goal || ''} onChange={e => setForm({...form, goal: e.target.value})} className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-3 text-white focus:border-[#7c3aed] outline-none">
                  <option value="">Selecione...</option>
                  <option value="Hipertrofia">Hipertrofia</option>
                  <option value="Força">Força</option>
                  <option value="Emagrecimento">Emagrecimento</option>
                  <option value="Condicionamento">Condicionamento</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Nível de Experiência</label>
                <select value={form.level || ''} onChange={e => setForm({...form, level: e.target.value})} className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-3 text-white focus:border-[#7c3aed] outline-none">
                  <option value="">Selecione...</option>
                  <option value="Iniciante">Iniciante</option>
                  <option value="Intermediário">Intermediário</option>
                  <option value="Avançado">Avançado</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6">
              <label className="text-sm text-gray-400 block mb-2">Limitações, Foco ou Intenção</label>
              <textarea 
                value={form.intent || ''} 
                onChange={e => setForm({...form, intent: e.target.value})} 
                placeholder="Ex: Tenho dor no joelho, quero focar muito em costas..."
                className="w-full bg-white/[0.02] border border-white/10 rounded-xl p-3 text-white focus:border-[#7c3aed] outline-none min-h-[100px] resize-y" 
              />
            </div>
          </div>

          <div className="bg-[#0a0a0f]/60 backdrop-blur-2xl rounded-3xl p-6 md:p-8 border border-white/[0.05] shadow-2xl">
            <h2 className="text-xl font-outfit font-bold text-white mb-6 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#ffd700]" /> Preferências
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#00ff88]/20 rounded-xl">
                    <Volume2 className="w-5 h-5 text-[#00ff88]" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Sons do Timer</h3>
                    <p className="text-xs text-gray-400">Tocar alerta quando o descanso terminar</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={form.soundEnabled} onChange={e => setForm({...form, soundEnabled: e.target.checked})} />
                  <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00ff88]"></div>
                </label>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-3">Tempo de Descanso Padrão</label>
                <div className="grid grid-cols-4 gap-2">
                  {[30, 60, 90, 120].map((time) => (
                    <button
                      key={time}
                      onClick={() => setForm({ ...form, defaultRestTimer: time })}
                      className={`py-2 px-3 rounded-lg text-sm transition-colors border ${
                        form.defaultRestTimer === time
                          ? 'bg-[#00ff88]/20 border-[#00ff88] text-[#00ff88] font-bold'
                          : 'bg-white/[0.02] border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {time}s
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Usado automaticamente ao iniciar o descanso entre as séries.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-[#7c3aed]/20 to-transparent border border-[#7c3aed]/30 rounded-[24px] p-6 backdrop-blur-md">
            <h3 className="font-outfit font-semibold mb-4 text-[#7c3aed]">Métricas Calculadas</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">IMC</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-mono font-bold text-white">{imc}</span>
                  <span className="text-sm text-[#00ff88] pb-1">{imcClass}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">TMB (Basal)</p>
                <p className="text-2xl font-mono font-bold text-white">{tmb} <span className="text-sm text-gray-500 font-sans">kcal/dia</span></p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Gasto Est. (Treino)</p>
                <p className="text-2xl font-mono font-bold text-white">{Math.round(tmb * 1.55)} <span className="text-sm text-gray-500 font-sans">kcal/dia</span></p>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-[24px] p-6 space-y-3">
            <h3 className="font-outfit font-semibold mb-4">Dados</h3>
            <button onClick={exportData} className="w-full flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm transition-colors text-white">
              <Download className="w-4 h-4" /> Exportar Backup (JSON)
            </button>
            <button onClick={handleClear} className="w-full flex items-center justify-center gap-2 p-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl text-sm transition-colors">
              <Trash2 className="w-4 h-4" /> Apagar Tudo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
