"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

/**
 * Avisos não-bloqueantes, no lugar de `alert()`.
 *
 * O `alert()` nativo trava a thread principal: num app de treino com cronômetro correndo, o
 * tempo congela até o usuário clicar OK. Além disso, num PWA instalado ele aparece com a cara do
 * navegador ("localhost diz:"), quebrando a ilusão de app.
 *
 * Uso: `const toast = useToast()` e então `toast.erro('mensagem')`.
 */

export type ToastVariante = 'sucesso' | 'erro' | 'aviso' | 'info';

interface Toast {
  id: number;
  variante: ToastVariante;
  mensagem: string;
}

interface ToastAPI {
  mostrar: (mensagem: string, variante?: ToastVariante) => void;
  sucesso: (mensagem: string) => void;
  erro: (mensagem: string) => void;
  aviso: (mensagem: string) => void;
}

const ToastContext = createContext<ToastAPI | null>(null);

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>');
  return ctx;
}

// Mensagem de erro fica mais tempo: costuma ser mais longa e o usuário precisa ler com calma.
const DURACAO: Record<ToastVariante, number> = {
  sucesso: 3500,
  info: 4000,
  aviso: 5500,
  erro: 7000,
};

const ESTILO: Record<ToastVariante, { icone: typeof Info; classes: string; rotulo: string }> = {
  sucesso: { icone: CheckCircle2,   classes: 'border-primary/40 text-primary',       rotulo: 'Sucesso' },
  erro:    { icone: XCircle,        classes: 'border-destructive/40 text-destructive', rotulo: 'Erro' },
  aviso:   { icone: AlertTriangle,  classes: 'border-warning/40 text-warning',       rotulo: 'Atenção' },
  info:    { icone: Info,           classes: 'border-border text-foreground',        rotulo: 'Aviso' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remover = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const mostrar = useCallback((mensagem: string, variante: ToastVariante = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, variante, mensagem }]);
    setTimeout(() => remover(id), DURACAO[variante]);
  }, [remover]);

  const api: ToastAPI = {
    mostrar,
    sucesso: useCallback((m: string) => mostrar(m, 'sucesso'), [mostrar]),
    erro: useCallback((m: string) => mostrar(m, 'erro'), [mostrar]),
    aviso: useCallback((m: string) => mostrar(m, 'aviso'), [mostrar]),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Fica acima da navegação inferior (z-50) pra não ficar escondido no celular. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed left-4 right-4 bottom-24 md:bottom-6 md:left-auto md:right-6 md:w-[380px] z-[60] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map(t => {
          const { icone: Icone, classes, rotulo } = ESTILO[t.variante];
          return (
            <div
              key={t.id}
              role={t.variante === 'erro' ? 'alert' : 'status'}
              className={`pointer-events-auto bg-surface border ${classes} rounded-xl p-4 shadow-xl backdrop-blur-md flex items-start gap-3 vf-entrada`}
            >
              <Icone className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <span className="sr-only">{rotulo}: </span>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line break-words">{t.mensagem}</p>
              </div>
              <button
                onClick={() => remover(t.id)}
                aria-label="Fechar aviso"
                className="shrink-0 text-foreground-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
