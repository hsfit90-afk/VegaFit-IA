"use client";

import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Tela cheia de descanso entre séries. Cobre a tela de propósito: durante o descanso o aluno
 * não deve editar séries por engano, e o número grande é legível de longe, com o celular
 * apoiado no banco.
 */
export function RestTimerOverlay({
  segundosRestantes,
  onPular,
  formatarTempo,
}: {
  segundosRestantes: number;
  onPular: () => void;
  formatarTempo: (segundos: number) => string;
}) {
  if (segundosRestantes <= 0) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Descanso entre séries"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    >
      <div className="bg-surface/90 border border-primary/30 p-8 rounded-[32px] shadow-[0_0_50px_rgb(var(--color-primary-rgb)/0.2)] flex flex-col items-center max-w-sm w-full">
        <div className="w-24 h-24 rounded-full border-4 border-primary/20 flex items-center justify-center relative mb-6">
          <div className="absolute inset-0 border-4 border-primary rounded-full animate-[spin_4s_linear_infinite] border-t-transparent" aria-hidden="true" />
          <Clock className="w-8 h-8 text-primary" aria-hidden="true" />
        </div>
        <h3 className="text-white font-bold text-xl mb-2">Tempo de Descanso</h3>
        {/* aria-live desligado: anunciar a cada segundo atrapalharia mais que ajudaria. */}
        <div aria-live="off" className="font-mono text-primary font-black text-6xl tracking-tight mb-8">
          {formatarTempo(segundosRestantes)}
        </div>
        <Button onClick={onPular} variant="outline" className="w-full border-primary/50 text-primary hover:bg-primary/10 rounded-xl">
          PULAR DESCANSO
        </Button>
      </div>
    </div>
  );
}
