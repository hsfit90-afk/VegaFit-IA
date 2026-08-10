"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Minus, Plus, Target, Zap, Clock, ChevronRight } from 'lucide-react';
import { UserProfile } from '@/lib/types';
import { useAppContext } from '@/app/context/AppContext';
import { useSearchParams } from 'next/navigation';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const { setProfile } = useAppContext();

  // Form State
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('Hipertrofia');
  const [level, setLevel] = useState('Iniciante');
  const [weight, setWeight] = useState(70);
  const [height, setHeight] = useState(170);
  const [age, setAge] = useState(25);
  const [days, setDays] = useState(4);
  const [duration, setDuration] = useState('60');

  const searchParams = useSearchParams();
  const trainerId = searchParams.get('trainer');
  const selectedRole = searchParams.get('role'); // 'trainer' or null (defaults to 'client')

  const totalSteps = 6;

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data } = await supabase.from('profiles').select('id').eq('id', user.id).single();
        if (data) router.push('/');
      } else {
        router.push('/login');
      }
    };
    getUser();
  }, [supabase, router]);

  const handleComplete = async () => {
    if (!userId) return;
    setLoading(true);

    // Buscar perfil existente para não sobrescrever o cargo (role) como 'client'
    const { data: existingProfile } = await supabase.from('profiles').select('role, trainer_id').eq('id', userId).single();

    const newProfile: UserProfile = {
      name,
      age: age,
      weight: weight,
      height: height,
      goal,
      level,
      intent: 'Geral',
      geminiApiKey: '',
      soundEnabled: true,
      defaultRestTimer: 60,
      role: existingProfile?.role || selectedRole || 'client',
      trainerId: existingProfile?.trainer_id || trainerId || null,
    };

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
      default_rest_timer: newProfile.defaultRestTimer,
      role: newProfile.role,
      trainer_id: newProfile.trainerId
    });

    if (error) {
      console.error("Error saving profile details:", error);
      alert(`Erro ao salvar perfil: ${error.message || JSON.stringify(error)}`);
      setLoading(false);
      return;
    }

    setProfile(newProfile);

    try {
      const res = await fetch('/api/treino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: newProfile,
          config: {
            goal: newProfile.goal,
            level: newProfile.level,
            daysPerWeek: days,
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
    // Redirect based on role
    const finalRole = existingProfile?.role || selectedRole || 'client';
    if (finalRole === 'trainer' || finalRole === 'master') {
      router.push('/trainer');
    } else {
      router.push('/');
    }
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const adjustNumber = (setter: React.Dispatch<React.SetStateAction<number>>, delta: number, min: number, max: number) => {
    setter(prev => Math.min(Math.max(prev + delta, min), max));
  };

  return (
    <div className="min-h-[100dvh] bg-background flex justify-center w-full">
      <div className="w-full max-w-md flex flex-col relative bg-background px-6 py-6 md:py-10 md:border-x md:border-border/50 shadow-2xl">
        
        {/* Header / Progress */}
        <div className="flex items-center gap-4 mb-8 mt-2">
          <button 
            onClick={step > 1 ? prevStep : undefined} 
            className="w-10 h-10 rounded-full bg-surface hover:bg-surface-hover flex items-center justify-center text-foreground border border-border active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step > i ? 'bg-primary' : 'bg-surface'}`} 
              />
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col justify-start pb-24">
          
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-8 tracking-tight">Qual é o seu nome?</h1>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="w-full bg-surface border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none px-6 py-5 text-xl text-foreground font-medium transition-all rounded-2xl shadow-lg" 
                placeholder="Seu nome..." 
                autoFocus
              />
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col flex-1">
              <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">Qual seu objetivo?</h1>
              <p className="text-foreground-muted mb-8">Isso nos ajuda a personalizar seus treinos.</p>
              <div className="space-y-4">
                {[
                  { id: 'Hipertrofia', label: 'Ganhar Massa', desc: 'Foco em hipertrofia e volume', icon: Zap },
                  { id: 'Emagrecimento', label: 'Perder Peso', desc: 'Queima de gordura e definição', icon: Target },
                  { id: 'Condicionamento Físico', label: 'Condicionamento', desc: 'Melhorar o fôlego e resistência', icon: Clock }
                ].map(g => (
                  <button 
                    key={g.id} 
                    onClick={() => setGoal(g.id)} 
                    className={`w-full text-left p-5 rounded-2xl border transition-all flex items-center gap-4 ${goal === g.id ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(0,255,136,0.15)]' : 'bg-surface border-border hover:border-border-light'}`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${goal === g.id ? 'bg-primary/20 text-primary' : 'bg-black/20 text-foreground-muted'}`}>
                      <g.icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="text-lg font-semibold text-foreground">{g.label}</div>
                      <div className="text-sm text-foreground-muted mt-1">{g.desc}</div>
                    </div>
                    <ChevronRight className={`w-5 h-5 ${goal === g.id ? 'text-primary' : 'text-transparent'}`} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col flex-1">
              <h1 className="text-3xl font-bold text-foreground mb-8 tracking-tight">Nível de experiência</h1>
              <div className="space-y-4">
                {[
                  { id: 'Iniciante', label: 'Iniciante', desc: 'Nunca treinei ou treino há menos de 6 meses' },
                  { id: 'Intermediário', label: 'Intermediário', desc: 'Treino regularmente de 6 meses a 2 anos' },
                  { id: 'Avançado', label: 'Avançado', desc: 'Treino consistentemente há mais de 2 anos' }
                ].map(l => (
                  <button 
                    key={l.id} 
                    onClick={() => setLevel(l.id)} 
                    className={`w-full text-left p-5 rounded-2xl border transition-all relative overflow-hidden ${level === l.id ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(0,255,136,0.15)]' : 'bg-surface border-border hover:border-border-light'}`}
                  >
                    {level === l.id && (
                      <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase">Recomendado</div>
                    )}
                    <div className="text-lg font-semibold text-foreground mb-1">{l.label}</div>
                    <div className="text-sm text-foreground-muted pr-8">{l.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col flex-1">
              <h1 className="text-3xl font-bold text-foreground mb-12 tracking-tight text-center">Físico Atual</h1>
              
              <div className="flex flex-col items-center gap-12 mt-4">
                <div className="w-full flex flex-col items-center">
                  <span className="text-foreground-muted mb-4 font-medium uppercase tracking-wider text-sm">Peso (kg)</span>
                  <div className="flex items-center justify-center gap-6">
                    <button onClick={() => adjustNumber(setWeight, -1, 30, 200)} className="w-14 h-14 rounded-full bg-surface hover:bg-surface-hover border border-border flex items-center justify-center text-foreground text-2xl active:scale-95 shadow-lg transition-transform"><Minus /></button>
                    <div className="text-5xl md:text-6xl font-black text-foreground w-24 md:w-28 text-center">{weight}</div>
                    <button onClick={() => adjustNumber(setWeight, 1, 30, 200)} className="w-14 h-14 rounded-full bg-surface hover:bg-surface-hover border border-border flex items-center justify-center text-foreground text-2xl active:scale-95 shadow-lg transition-transform"><Plus /></button>
                  </div>
                </div>

                <div className="w-full flex flex-col items-center">
                  <span className="text-foreground-muted mb-4 font-medium uppercase tracking-wider text-sm">Altura (cm)</span>
                  <div className="flex items-center justify-center gap-6">
                    <button onClick={() => adjustNumber(setHeight, -1, 100, 250)} className="w-14 h-14 rounded-full bg-surface hover:bg-surface-hover border border-border flex items-center justify-center text-foreground text-2xl active:scale-95 shadow-lg transition-transform"><Minus /></button>
                    <div className="text-5xl md:text-6xl font-black text-foreground w-28 md:w-32 text-center">{height}</div>
                    <button onClick={() => adjustNumber(setHeight, 1, 100, 250)} className="w-14 h-14 rounded-full bg-surface hover:bg-surface-hover border border-border flex items-center justify-center text-foreground text-2xl active:scale-95 shadow-lg transition-transform"><Plus /></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col flex-1">
              <h1 className="text-3xl font-bold text-foreground mb-12 tracking-tight text-center">Sua Idade</h1>
              <div className="w-full flex flex-col items-center mt-10">
                <div className="flex items-center justify-center gap-6">
                  <button onClick={() => adjustNumber(setAge, -1, 14, 100)} className="w-14 h-14 rounded-full bg-surface hover:bg-surface-hover border border-border flex items-center justify-center text-foreground text-2xl active:scale-95 shadow-lg transition-transform"><Minus /></button>
                  <div className="text-6xl md:text-7xl font-black text-primary w-28 md:w-32 text-center drop-shadow-md">{age}</div>
                  <button onClick={() => adjustNumber(setAge, 1, 14, 100)} className="w-14 h-14 rounded-full bg-surface hover:bg-surface-hover border border-border flex items-center justify-center text-foreground text-2xl active:scale-95 shadow-lg transition-transform"><Plus /></button>
                </div>
                <p className="text-foreground-muted mt-12 text-center px-4 max-w-sm">
                  A idade nos ajuda a ajustar o volume e a intensidade de recuperação do treino.
                </p>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col flex-1">
              <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">Frequência ideal</h1>
              <p className="text-foreground-muted mb-10">Recomendamos 4 a 5 dias para resultados consistentes.</p>
              
              <div className="flex flex-col items-center mb-12 bg-surface/50 py-8 rounded-3xl border border-border">
                <div className="flex items-center justify-center gap-6 mb-4">
                  <button onClick={() => adjustNumber(setDays, -1, 1, 7)} className="w-12 h-12 rounded-full bg-surface hover:bg-surface-hover border border-border flex items-center justify-center text-foreground text-xl active:scale-95 shadow-md transition-transform"><Minus /></button>
                  <div className="text-5xl font-black text-foreground w-20 text-center">{days}</div>
                  <button onClick={() => adjustNumber(setDays, 1, 1, 7)} className="w-12 h-12 rounded-full bg-surface hover:bg-surface-hover border border-border flex items-center justify-center text-foreground text-xl active:scale-95 shadow-md transition-transform"><Plus /></button>
                </div>
                <span className="text-foreground-muted font-medium uppercase tracking-wider text-sm">Dias por semana</span>
              </div>

              <h3 className="text-lg font-bold text-foreground mb-4">Duração de cada treino</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { v: '30', label: 'Rápido', desc: 'Até 30 min' },
                  { v: '45', label: 'Curto', desc: '45 min' },
                  { v: '60', label: 'Médio', desc: '60 min' },
                  { v: '90', label: 'Longo', desc: '90+ min' }
                ].map(d => (
                  <button 
                    key={d.v} 
                    onClick={() => setDuration(d.v)}
                    className={`p-4 rounded-2xl border text-left transition-all ${duration === d.v ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(0,255,136,0.15)]' : 'bg-surface border-border hover:border-border-light'}`}
                  >
                    <div className="font-bold text-foreground mb-1">{d.label}</div>
                    <div className="text-xs text-foreground-muted">{d.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Bottom Action */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent pt-12">
          <button 
            onClick={step === totalSteps ? handleComplete : nextStep} 
            disabled={loading || (step === 1 && !name)}
            className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-extrabold text-base py-4 rounded-full flex items-center justify-center gap-2 transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(0,255,136,0.4)] hover:shadow-[0_4px_25px_rgba(0,255,136,0.6)] hover:-translate-y-0.5 active:translate-y-0"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> GERANDO TREINO...</>
            ) : (
              step === totalSteps ? 'FINALIZAR' : 'CONTINUAR'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

