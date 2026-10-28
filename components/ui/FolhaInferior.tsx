"use client";

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Folha inferior: conteúdo que sobe por cima da tela sem trocar de página.
 *
 * POR QUE NÃO É O ConfirmDialog
 *
 * O ConfirmDialog já sobe de baixo no celular e já tem Escape, foco e animação — mas ele é
 * `role="alertdialog"` com confirmar e cancelar, especializado em decisão binária. Esta aqui
 * carrega conteúdo qualquer: filtro, detalhe de exercício, escolha de equipamento.
 *
 * As duas compartilham a MESMA linguagem de propósito (mesmo fundo, mesmo raio superior,
 * mesma entrada `vf-entrada`), para o app não ter duas gramáticas de sobreposição. Juntar o
 * esqueleto das duas é refatoração legítima — e fica para depois, porque o ConfirmDialog é
 * usado em várias telas e mexer nele agora misturaria estética com risco.
 *
 * NO CELULAR NASCE EMBAIXO, NO DESKTOP NO CENTRO. `items-end md:items-center` — a origem do
 * gesto é diferente nos dois, e o movimento acompanha.
 */
export function FolhaInferior({
  aberta,
  aoFechar,
  titulo,
  descricao,
  children,
  className,
}: {
  aberta: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const painel = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!aberta) return;

    // Guarda quem tinha o foco para devolver ao fechar: sem isso o teclado volta para o topo
    // da página e a pessoa perde o lugar onde estava.
    focoAnterior.current = document.activeElement as HTMLElement | null;
    painel.current?.focus();

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      focoAnterior.current?.focus?.();
    };
  }, [aberta, aoFechar]);

  if (!aberta) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm md:p-5"
      onClick={aoFechar}
    >
      <div
        ref={painel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="folha-titulo"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'bg-surface border border-border rounded-t-3xl md:rounded-md',
          'w-full md:max-w-md p-5 max-h-[85vh] overflow-y-auto vf-entrada',
          'focus:outline-none',
          className,
        )}
      >
        {/* A alça não é decoração: diz que isto se arrasta, antes de a pessoa tentar. */}
        <div className="md:hidden w-10 h-1 rounded-full bg-border-light mx-auto mb-4" aria-hidden="true" />

        <h2 id="folha-titulo" className="font-outfit text-xl font-bold text-foreground">
          {titulo}
        </h2>
        {descricao && (
          <p className="text-sm text-foreground-muted mt-1 leading-relaxed">{descricao}</p>
        )}

        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
}
