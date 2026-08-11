"use client";

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Zap, Dumbbell, Users, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function RoleSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trainerId = searchParams.get('trainer');
  const [selected, setSelected] = useState<'client' | 'trainer' | null>(null);

  const handleSelect = (role: 'client' | 'trainer') => {
    setSelected(role);
    // Small delay for the animation to play before navigating
    setTimeout(() => {
      const trainerParam = trainerId ? `&trainer=${trainerId}` : '';
      if (role === 'client') {
        router.push(`/onboarding${trainerId ? `?trainer=${trainerId}` : ''}`);
      } else {
        router.push(`/onboarding?role=trainer${trainerParam}`);
      }
    }, 300);
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow Effects */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        className="w-full max-w-md flex flex-col items-center"
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.1 } }
        }}
      >
        {/* Logo */}
        <motion.div
          className="flex flex-col items-center mb-12"
          variants={{
            hidden: { opacity: 0, y: 20 },
            show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } }
          }}
        >
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center mb-6 shadow-[0_8px_30px_rgba(0,255,136,0.2)] rotate-3">
            <Zap className="w-10 h-10 text-black" />
          </div>
          <h1 className="font-outfit text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            <span className="text-primary">VEGA</span>FIT
          </h1>
          <p className="text-foreground-muted text-sm md:text-base mt-2 tracking-wide">
            Seu app de treino inteligente
          </p>
        </motion.div>

        {/* Role Selection Buttons */}
        <motion.div
          className="w-full space-y-4"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
        >
          {/* Sou Aluno */}
          <motion.button
            onClick={() => handleSelect('client')}
            disabled={selected !== null}
            className={`w-full group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
              selected === 'client'
                ? 'border-primary bg-primary/20 scale-[0.98]'
                : selected === 'trainer'
                ? 'border-border opacity-40 pointer-events-none'
                : 'border-border hover:border-primary/50 bg-surface hover:bg-surface-hover'
            }`}
            variants={{
              hidden: { opacity: 0, y: 20 },
              show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } }
            }}
            whileHover={selected === null ? { scale: 1.02 } : {}}
            whileTap={selected === null ? { scale: 0.98 } : {}}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-4 p-5 md:p-6">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
                selected === 'client' ? 'bg-primary text-black' : 'bg-primary/10 text-primary group-hover:bg-primary/20'
              }`}>
                <Dumbbell className="w-7 h-7" />
              </div>
              <div className="flex-1 text-left">
                <h2 className="text-lg md:text-xl font-bold text-white">Sou aluno</h2>
                <p className="text-sm text-foreground-muted mt-0.5">Treinos personalizados com IA</p>
              </div>
              <ChevronRight className={`w-5 h-5 transition-all ${
                selected === 'client' ? 'text-primary translate-x-1' : 'text-foreground-muted group-hover:text-primary group-hover:translate-x-1'
              }`} />
            </div>
          </motion.button>

          {/* Sou Personal Trainer */}
          <motion.button
            disabled={true}
            className={`w-full group relative overflow-hidden rounded-2xl border transition-all duration-300 border-border opacity-50 cursor-not-allowed bg-surface`}
            variants={{
              hidden: { opacity: 0, y: 20 },
              show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } }
            }}
          >
            <div className="relative flex items-center gap-4 p-5 md:p-6">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center transition-colors bg-secondary/10 text-secondary">
                <Users className="w-7 h-7" />
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg md:text-xl font-bold text-white">Sou personal trainer</h2>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-secondary/20 text-secondary rounded-md">Em construção</span>
                </div>
                <p className="text-sm text-foreground-muted mt-0.5">Gerencie alunos e crie treinos</p>
              </div>
              <ChevronRight className="w-5 h-5 transition-all text-foreground-muted" />
            </div>
          </motion.button>
        </motion.div>

        {/* Footer */}
        <motion.p
          className="text-foreground-muted/50 text-xs mt-10 text-center"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { delay: 0.5 } }
          }}
        >
          Você pode alterar isso depois nas configurações
        </motion.p>
      </motion.div>
    </div>
  );
}
