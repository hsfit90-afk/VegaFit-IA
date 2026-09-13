"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Confirmação de ação destrutiva, no lugar de `confirm()`.
 *
 * A API é baseada em promessa de propósito: `if (confirm(msg))` vira
 * `if (await confirmar({...}))`, então a migração não exige reescrever o fluxo de cada handler
 * em callbacks — o que seria a fonte mais provável de bug nessa troca.
 *
 * Ganhos sobre o nativo: não bloqueia a thread (o cronômetro do treino continua correndo),
 * permite listar o que será perdido, e tem foco preso pra quem navega por teclado.
 */

export interface OpcoesConfirmacao {
  titulo: string;
  mensagem: string;
  /** Itens do que será perdido. Aparecem como lista — mais legível que um parágrafo corrido. */
  perdas?: string[];
  textoConfirmar?: string;
  textoCancelar?: string;
  /** Pinta o botão de confirmar como destrutivo. Padrão: true. */
  destrutivo?: boolean;
}

type Resolver = (confirmado: boolean) => void;

const ConfirmContext = createContext<((opcoes: OpcoesConfirmacao) => Promise<boolean>) | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>');
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opcoes, setOpcoes] = useState<OpcoesConfirmacao | null>(null);
  const resolverRef = useRef<Resolver | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmarRef = useRef<HTMLButtonElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);

  const confirmar = useCallback((novasOpcoes: OpcoesConfirmacao) => {
    focoAnterior.current = document.activeElement as HTMLElement | null;
    setOpcoes(novasOpcoes);
    return new Promise<boolean>(resolve => { resolverRef.current = resolve; });
  }, []);

  const fechar = useCallback((confirmado: boolean) => {
    resolverRef.current?.(confirmado);
    resolverRef.current = null;
    setOpcoes(null);
    // Devolve o foco para o botão que abriu o diálogo — sem isso, quem usa teclado
    // é jogado para o início da página.
    focoAnterior.current?.focus?.();
  }, []);

  // Foco inicial no botão de confirmar quando o diálogo abre.
  useEffect(() => {
    if (opcoes) confirmarRef.current?.focus();
  }, [opcoes]);

  // Esc fecha; Tab circula dentro do diálogo (foco preso).
  useEffect(() => {
    if (!opcoes) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        fechar(false);
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focaveis = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];

      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [opcoes, fechar]);

  const destrutivo = opcoes?.destrutivo !== false;

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {opcoes && (
        <div
          className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm md:p-4"
          onClick={() => fechar(false)}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmar-titulo"
            aria-describedby="confirmar-descricao"
            onClick={e => e.stopPropagation()}
            className="bg-surface border border-border rounded-t-3xl md:rounded-2xl w-full md:max-w-md p-6 max-h-[85vh] overflow-y-auto vf-entrada"
          >
            <h2
              id="confirmar-titulo"
              className={`font-outfit text-xl font-bold mb-3 flex items-center gap-2 ${destrutivo ? 'text-destructive' : 'text-foreground'}`}
            >
              {destrutivo && <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />}
              {opcoes.titulo}
            </h2>

            <div id="confirmar-descricao" className="text-sm text-foreground-muted space-y-3 mb-6">
              <p className="whitespace-pre-line leading-relaxed">{opcoes.mensagem}</p>
              {opcoes.perdas && opcoes.perdas.length > 0 && (
                <ul className="space-y-1.5">
                  {opcoes.perdas.map(item => (
                    <li key={item} className="flex gap-2">
                      <span className="text-destructive shrink-0" aria-hidden="true">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col-reverse md:flex-row gap-3">
              <button
                onClick={() => fechar(false)}
                className="flex-1 h-12 rounded-xl border border-border text-foreground font-semibold hover:bg-surface-light transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {opcoes.textoCancelar || 'Cancelar'}
              </button>
              <button
                ref={confirmarRef}
                onClick={() => fechar(true)}
                className={`flex-1 h-12 rounded-xl font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                  destrutivo
                    ? 'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive'
                    : 'bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-primary'
                }`}
              >
                {opcoes.textoConfirmar || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
