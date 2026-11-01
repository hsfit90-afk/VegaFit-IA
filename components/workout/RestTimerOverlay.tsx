"use client";

import { Clock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Tela cheia de descanso entre séries. Cobre a tela de propósito: durante o descanso o aluno
 * não deve editar séries por engano, e o número grande é legível de longe, com o celular
 * apoiado no banco.
 */
export function RestTimerOverlay({
  segundosRestantes,
  onPular,
  onAdicionar15s,
  formatarTempo,
}: {
  segundosRestantes: number;
  onPular: () => void;
  /**
   * Estica o descanso em 15 segundos. Opcional: sem ela o botão não aparece, e as telas
   * que já usavam este componente continuam iguais.
   */
  onAdicionar15s?: () => void;
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
      <div className="bg-surface/90 border border-primary/30 p-8 rounded-folha shadow-[0_0_50px_rgb(var(--color-primary-rgb)/0.2)] flex flex-col items-center max-w-sm w-full">
        <div className="w-24 h-24 rounded-full border-4 border-primary/20 flex items-center justify-center relative mb-6">
          <div className="absolute inset-0 border-4 border-primary rounded-full animate-[spin_4s_linear_infinite] border-t-transparent" aria-hidden="true" />
          <Clock className="w-8 h-8 text-primary" aria-hidden="true" />
        </div>
        <h3 className="text-white font-bold text-xl mb-2">Tempo de Descanso</h3>
        {/* aria-live desligado: anunciar a cada segundo atrapalharia mais que ajudaria. */}
        <div aria-live="off" className="font-mono text-primary font-black text-6xl tracking-tight mb-8">
          {formatarTempo(segundosRestantes)}
        </div>
        {/* OS DOIS LADOS DA MESMA DECISÃO.

            Até 31/10/2026 só existia PULAR: a tela assumia que o único desvio possível era
            querer menos descanso. Na prática o outro acontece tanto quanto — a série pegou
            mais do que o previsto e a pessoa precisa de mais ar antes da próxima.

            Sem o +15 s, quem precisava de mais tempo deixava o cronômetro zerar e ficava
            parado olhando a tela de treino, ou pior: entrava na série seguinte antes de
            recuperar, porque o app disse que o descanso acabou.

            O +15 s vem primeiro e com mais peso visual: ele é aditivo e sem risco, enquanto
            pular encerra o descanso. */}
        <div className="w-full flex flex-col gap-2">
          {onAdicionar15s && (
            <Button
              onClick={onAdicionar15s}
              className="w-full rounded-bloco"
              aria-label="Adicionar 15 segundos ao descanso"
            >
              <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
              MAIS 15 s
            </Button>
          )}

          <Button onClick={onPular} variant="outline" className="w-full border-primary/50 text-primary hover:bg-primary/10 rounded-bloco">
            PULAR DESCANSO
          </Button>
        </div>
      </div>
    </div>
  );
}
