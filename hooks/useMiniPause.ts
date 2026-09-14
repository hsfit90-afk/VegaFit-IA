import { useEffect, useState } from 'react';

export interface MiniPausa {
  exIndex: number;
  setIndex: number;
  endTime: number;
}

/**
 * Mini-pausa do método Rest-Pause: 10 a 15 segundos DENTRO da mesma série, entre os "clusters"
 * de repetições até a falha. Não é o descanso normal entre séries — por isso tem estado próprio,
 * duração curta e vibração mais discreta.
 */
export function useMiniPause(miniPause: MiniPausa | null, aoZerar: () => void) {
  const [miniPauseRemaining, setMiniPauseRemaining] = useState(0);

  useEffect(() => {
    if (!miniPause) {
      setMiniPauseRemaining(0);
      return;
    }

    const atualizar = () => {
      const restante = Math.max(0, Math.ceil((miniPause.endTime - Date.now()) / 1000));
      setMiniPauseRemaining(restante);
      if (restante === 0) {
        aoZerar();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([80, 40, 80]);
        }
      }
    };

    atualizar();
    const intervalo = setInterval(atualizar, 1000);
    return () => clearInterval(intervalo);
    // `aoZerar` fora das dependências pelo mesmo motivo do useRestTimer; o efeito original
    // dependia só de [miniPause].
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miniPause]);

  return miniPauseRemaining;
}
