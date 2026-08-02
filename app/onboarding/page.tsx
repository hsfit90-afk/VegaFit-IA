"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Dumbbell, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '@/lib/types';
import { useAppContext } from '@/app/context/AppContext';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const { setProfile } = useAppContext();

  // Form State
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [goal, setGoal] = useState('Hipertrofia');
  const [level, setLevel] = useState('Iniciante');
  const [days, setDays] = useState('4');
  const [duration, setDuration] = useState('60');

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Verifica se já tem perfil
        const { data } = await supabase.from('profiles').select('id').eq('id', user.id).single();
        if (data) {
          router.push('/');
        }
      } else {
        router.push('/login');
      }
    };
    getUser();
  }, [supabase, router]);

  const handleComplete = async () => {
    if (!userId) return;
    setLoading(true);

    const newProfile: UserProfile = {
      name,
      age: parseInt(age) || 0,
      weight: parseFloat(weight) || 0,
      height: parseFloat(height) || 0,
      goal,
      level,
      intent: 'Geral',
      geminiApiKey: '',
      soundEnabled: true,
      defaultRestTimer: 60,
    };

    // Save to Supabase Profile table
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      name: newProfile.name,
      age: newProfile.age,
      weight: newProfile.weight,
      height: newProfile.height,
      goal: newProfile.goal,
      level: newProfile.level,
      intent: newProfile.intent,
      sound_enabled: newProfile.soundEnabled,
      default_rest_timer: newProfile.defaultRestTimer
    });

    if (error) {
      console.error("Error saving profile:", error);
      setLoading(false);
      return;
    }

    // Update context
    setProfile(newProfile);

    // After saving profile, generate first workout
    try {
      const res = await fetch('/api/treino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: newProfile,
          config: {
            goal: newProfile.goal,
            level: newProfile.level,
            daysPerWeek: parseInt(days),
            duration: duration,
            equipment: 'Academia completa',
            priorities: [],
            limitations: '',
            trainingMethod: 'tradicional'
          }
        })
      });
      
      const plan = await res.json();
      if (plan && !plan.error) {
        plan.id = crypto.randomUUID();
        plan.createdAt = Date.now();
        
        // Save plan to Supabase
        await supabase.from('workout_plans').insert({
          user_id: userId,
          name: plan.name,
          split: plan.split,
          sessions: plan.sessions
        });
      }
    } catch (e) {
      console.error("Error generating initial plan:", e);
    }

    router.push('/');
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, 4));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/[0.03] backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-2xl">
        <div className="flex justify-between mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`h-2 flex-1 rounded-full mx-1 ${step >= i ? 'bg-[#00ff88]' : 'bg-white/10'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-6">Fale um pouco sobre você</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Como devemos te chamar?</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" placeholder="Seu nome" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Idade</label>
                  <input type="number" value={age} onChange={e => setAge(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" placeholder="Anos" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Peso (kg)</label>
                  <input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" placeholder="kg" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Altura (cm)</label>
                  <input type="number" value={height} onChange={e => setHeight(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white" placeholder="cm" />
                </div>
              </div>
            </div>
            <button onClick={nextStep} disabled={!name || !age || !weight} className="w-full mt-8 bg-white text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">Continuar <ArrowRight className="w-4 h-4" /></button>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-6">Qual seu principal objetivo?</h2>
            <div className="space-y-3">
              {['Hipertrofia', 'Emagrecimento', 'Condicionamento Físico', 'Saúde e Bem-estar'].map(g => (
                <button key={g} onClick={() => setGoal(g)} className={`w-full text-left px-4 py-4 rounded-xl border transition-all ${goal === g ? 'bg-[#7c3aed]/20 border-[#7c3aed] text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}>
                  <div className="font-medium">{g}</div>
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={prevStep} className="px-4 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5">Voltar</button>
              <button onClick={nextStep} className="flex-1 bg-white text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2">Continuar <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-6">Qual seu nível de experiência?</h2>
            <div className="space-y-3">
              {['Iniciante', 'Intermediário', 'Avançado'].map(l => (
                <button key={l} onClick={() => setLevel(l)} className={`w-full text-left px-4 py-4 rounded-xl border transition-all ${level === l ? 'bg-[#00ff88]/20 border-[#00ff88] text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}>
                  <div className="font-medium">{l}</div>
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={prevStep} className="px-4 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5">Voltar</button>
              <button onClick={nextStep} className="flex-1 bg-white text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2">Continuar <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-2">Disponibilidade</h2>
            <p className="text-gray-400 text-sm mb-6">Para a IA criar seu primeiro treino ideal</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Dias por semana</label>
                <select value={days} onChange={e => setDays(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white appearance-none">
                  {[2,3,4,5,6].map(d => <option key={d} value={d} className="bg-[#1a1a24]">{d} dias</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Duração do treino</label>
                <select value={duration} onChange={e => setDuration(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white appearance-none">
                  <option value="30" className="bg-[#1a1a24]">30 minutos</option>
                  <option value="45" className="bg-[#1a1a24]">45 minutos</option>
                  <option value="60" className="bg-[#1a1a24]">60 minutos</option>
                  <option value="90" className="bg-[#1a1a24]">90 minutos</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button onClick={prevStep} className="px-4 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5">Voltar</button>
              <button onClick={handleComplete} disabled={loading} className="flex-1 bg-gradient-to-r from-[#00ff88] to-[#00cc6d] text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Gerando treino...</> : <><CheckCircle2 className="w-5 h-5" /> Finalizar</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
