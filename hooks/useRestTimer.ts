import { useEffect, useState } from 'react';

/**
 * Descanso entre séries. Como o cronômetro do treino, conta a partir de um timestamp absoluto —
 * o aluno costuma bloquear a tela durante o descanso, e um contador incremental atrasaria.
 *
 * Ao zerar, avisa por som (se o aluno deixou ligado) e vibração.
 */
export function useRestTimer(
  restEndTime: number,
  aoZerar: () => void,
  opcoes: { somLigado: boolean; audioRef: React.RefObject<HTMLAudioElement | null> }
) {
  const [restRemaining, setRestRemaining] = useState(0);
  const { somLigado, audioRef } = opcoes;

  useEffect(() => {
    if (restEndTime === 0) {
      setRestRemaining(0);
      return;
    }

    const atualizar = () => {
      const restante = Math.max(0, Math.ceil((restEndTime - Date.now()) / 1000));
      setRestRemaining(restante);

      if (restante === 0) {
        aoZerar();
        if (somLigado && audioRef.current) {
          audioRef.current.play().catch(e => console.log('Audio play failed', e));
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
      }
    };

    atualizar(); // imediato, igual ao original
    const intervalo = setInterval(atualizar, 1000);

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') atualizar();
    };
    window.addEventListener('visibilitychange', aoVoltar);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener('visibilitychange', aoVoltar);
    };
    // `aoZerar` fica fora das dependências de propósito: a página passa uma função nova a cada
    // render, e incluí-la reiniciaria o descanso a cada segundo. O efeito original tinha as
    // mesmas dependências ([restEndTime, soundEnabled]) — comportamento preservado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restEndTime, somLigado]);

  return restRemaining;
}
