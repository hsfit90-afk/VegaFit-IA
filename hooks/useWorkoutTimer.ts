import { useEffect, useState } from 'react';

/**
 * Cronômetro do treino em andamento.
 *
 * Conta a partir de um timestamp absoluto, não somando ticks: se o aluno bloqueia a tela ou
 * troca de app no meio da série, o navegador pausa o setInterval e um contador incremental
 * ficaria para trás. Ao voltar, o visibilitychange recalcula do relógio real.
 */
export function useWorkoutTimer(startTime: number, pausado: boolean) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (startTime === 0 || pausado) return;

    const atualizar = () => setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));

    // Sem chamada imediata, igual ao original: o valor só aparece após o primeiro segundo.
    // (Ver nota no fim do arquivo — é candidato a melhoria, não foi alterado aqui de propósito.)
    const intervalo = setInterval(atualizar, 1000);

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') atualizar();
    };
    window.addEventListener('visibilitychange', aoVoltar);

    return () => {
      clearInterval(intervalo);
      window.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [startTime, pausado]);

  return elapsedSeconds;
}

/*
 * NOTA (não corrigido de propósito — refatoração conservadora):
 * Ao restaurar um treino do cache, `elapsedSeconds` mostra 0 por até 1 segundo antes do primeiro
 * tick, mesmo que o treino já dure 40 minutos. Basta chamar `atualizar()` antes do setInterval.
 * Deixado como está porque a tarefa era mover código sem mudar comportamento.
 */
