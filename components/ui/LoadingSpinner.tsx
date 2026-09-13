import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Indicador de carregamento. Estava repetido em 7 telas, sempre com `Loader2 animate-spin` e
 * sempre sem texto para leitor de tela — quem não enxerga não sabia que algo estava carregando.
 *
 * `rotulo` é anunciado e fica visível quando `mostrarRotulo` é passado.
 */

export interface LoadingSpinnerProps {
  tamanho?: 'sm' | 'md' | 'lg';
  rotulo?: string;
  mostrarRotulo?: boolean;
  /** Centraliza ocupando a área toda, para tela em carregamento inicial. */
  tela?: boolean;
  className?: string;
}

const TAMANHOS = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' } as const;

export function LoadingSpinner({
  tamanho = 'md',
  rotulo = 'Carregando…',
  mostrarRotulo,
  tela,
  className,
}: LoadingSpinnerProps) {
  const spinner = (
    <span role="status" className={cn('inline-flex items-center gap-3', className)}>
      <Loader2 className={cn('animate-spin text-primary', TAMANHOS[tamanho])} aria-hidden="true" />
      <span className={mostrarRotulo ? 'text-sm text-foreground-muted' : 'sr-only'}>{rotulo}</span>
    </span>
  );

  if (!tela) return spinner;

  return (
    <div className="min-h-[50vh] w-full flex items-center justify-center">
      {spinner}
    </div>
  );
}
