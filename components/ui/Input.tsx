import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Campo de texto do app.
 *
 * Havia 26 <input> espalhados por 11 telas, em DUAS famílias de estilo conflitantes para o
 * mesmo elemento — as telas de entrada usavam `bg-white/5 focus:border-accent`, as internas
 * `bg-surface focus:border-primary`. As duas viraram variantes em vez de uma só: unificar
 * mudaria a aparência das telas de login, e o objetivo ali era tirar repetição, não redesenhar.
 *
 * A COR DO FOCO SE UNIFICOU EM 21/10/2026, e o fundo não.
 *
 * O roxo do `accent` vinha da época em que o botão de entrar também era roxo. Quando o botão
 * passou a usar o verde da marca, a tela ficou com AÇÃO verde e FOCO roxo — e pior, com dois
 * anéis discordando no mesmo campo: a borda roxa do `focus:border-accent` por baixo do brilho
 * verde do `focus-visible:ring-primary/40`, que sempre esteve aqui.
 *
 * O que distingue a variante `auth` é o FUNDO (translúcido sobre o vidro da tela de entrada,
 * sólido nas telas internas). Isso continua. Cor de foco é sinal de interação, não identidade
 * de tela, e passa a ser uma só no app inteiro.
 */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 'default' nas telas internas; 'auth' em login, cadastro e recuperação de senha. */
  variant?: 'default' | 'auth';
  /** Marca o campo como inválido: borda destrutiva e aria-invalid pro leitor de tela. */
  invalid?: boolean;
}

const VARIANTES = {
  default: 'bg-surface border-border text-foreground focus:border-primary',
  auth: 'bg-white/5 border-white/10 text-foreground placeholder-gray-500 focus:border-primary',
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
