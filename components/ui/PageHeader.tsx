import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Cabeçalho de tela: título, subtítulo e ações à direita.
 * Estava repetido em 10 das 11 telas internas, com variações de margem e tamanho de fonte que
 * faziam uma tela parecer levemente diferente da outra sem motivo.
 */

export interface PageHeaderProps {
  titulo: string;
  subtitulo?: string;
  /** Botões ou links à direita; embaixo do título no celular. */
  acoes?: React.ReactNode;
  /** Ícone opcional antes do título. */
  icone?: React.ReactNode;
  /**
   * Etiqueta miúda acima do título, como na tela inicial e na de treino.
   *
   * É o que dá contexto sem gastar uma linha de título: "Sua evolução", "Em treino". Opcional
   * para as telas que já passavam só título e subtítulo continuarem iguais.
   */
  etiqueta?: string;
  className?: string;
}

export function PageHeader({ titulo, subtitulo, acoes, icone, etiqueta, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-8 md:mb-10 flex flex-col md:flex-row md:justify-between md:items-end gap-4', className)}>
      <div className="min-w-0">
        {etiqueta && (
          <p className="text-nano uppercase tracking-widest text-foreground-muted mb-2">
            {etiqueta}
          </p>
        )}
        <h1 className="text-3xl md:text-4xl font-outfit font-bold tracking-tight mb-2 flex items-center gap-3">
          {icone}
          <span className="truncate">{titulo}</span>
        </h1>
        {subtitulo && <p className="text-foreground-muted text-sm">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex gap-3 shrink-0">{acoes}</div>}
    </header>
  );
}
