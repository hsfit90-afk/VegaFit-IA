import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Campo de texto do app.
 *
 * Havia 26 <input> espalhados por 11 telas, em DUAS famílias de estilo conflitantes para o
 * mesmo elemento — as telas de entrada usavam `bg-white/5 focus:border-accent`, as internas
 * `bg-surface focus:border-primary`. As duas viraram variantes em vez de uma só: unificar
 * mudaria a aparência das telas de login, e o objetivo aqui é tirar repetição, não redesenhar.
 */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 'default' nas telas internas; 'auth' em login, cadastro e recuperação de senha. */
  variant?: 'default' | 'auth';
  /** Marca o campo como inválido: borda destrutiva e aria-invalid pro leitor de tela. */
  invalid?: boolean;
}

const VARIANTES = {
  default: 'bg-surface border-border text-foreground focus:border-primary',
  auth: 'bg-white/5 border-white/10 text-foreground placeholder-gray-500 focus:border-accent',
} as const;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = 'default', invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'w-full rounded-xl border px-4 py-3 outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-primary/40',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTES[variant],
        invalid && 'border-destructive focus:border-destructive',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';
