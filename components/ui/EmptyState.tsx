import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from './Card';

/**
 * Estado vazio: ícone apagado, explicação e — quando existe — o caminho de saída.
 *
 * Aparecia em 6 telas ("Nenhum plano salvo", "Nenhum treino registrado", "Nenhum exercício
 * encontrado") com estruturas diferentes. A ação é a parte que mais faltava: várias telas
 * diziam que estava vazio sem oferecer o que fazer a respeito.
 */

export interface EmptyStateProps {
  icone: React.ReactNode;
  titulo: string;
  descricao?: string;
  /** Botão ou link que resolve o vazio. */
  acao?: React.ReactNode;
  /** Sem o Card em volta, para usar dentro de um card existente. */
  semCard?: boolean;
  className?: string;
}

export function EmptyState({ icone, titulo, descricao, acao, semCard, className }: EmptyStateProps) {
  const conteudo = (
    <div className={cn('flex flex-col items-center text-center py-10 px-6', className)}>
      <div className="text-foreground-muted opacity-30 mb-4" aria-hidden="true">
        {icone}
      </div>
      <p className="text-foreground font-medium mb-1">{titulo}</p>
      {descricao && <p className="text-sm text-foreground-muted mb-4 max-w-sm">{descricao}</p>}
      {acao && <div className="mt-2 flex gap-3">{acao}</div>}
    </div>
  );

  if (semCard) return conteudo;

  return (
    <Card className="border-dashed border-2">
      <CardContent className="p-0">{conteudo}</CardContent>
    </Card>
  );
}
