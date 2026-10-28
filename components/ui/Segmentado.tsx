"use client";

import { cn } from '@/lib/utils';

/**
 * Controle segmentado: escolher UM entre poucos.
 *
 * É o padrão "DIA 1 / DIA 2 / DIA 3" e "CONVERSAS / SOLICITAÇÕES" dos apps de referência, e o
 * app já o reinventa à mão em vários lugares — as abas do montador, os filtros da biblioteca,
 * a troca de período do progresso. Cada um com altura, raio e cor de ativo diferentes.
 *
 * ALVO DE TOQUE DE 44px. `min-h-[44px]` não é enfeite: é o mínimo para o dedo acertar, e o
 * aluno usa isto com a mão suada, em pé, no meio do treino.
 *
 * O ESTADO ATIVO NÃO É SÓ COR. Fundo cheio mais peso de fonte — quem não distingue a cor
 * ainda vê qual está escolhido.
 */
export function Segmentado<T extends string>({
  opcoes,
  valor,
  onMudar,
  className,
  'aria-label': ariaLabel,
}: {
  opcoes: { valor: T; rotulo: string }[];
  valor: T;
  onMudar: (v: T) => void;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex gap-1 p-1 rounded-full bg-surface', className)}
    >
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => onMudar(o.valor)}
            className={cn(
              'flex-1 min-h-[44px] px-3 rounded-full text-sm transition-colors duration-[120ms]',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              ativo
                ? 'bg-primary text-primary-foreground font-bold'
                : 'text-foreground-muted font-medium hover:text-foreground',
            )}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
