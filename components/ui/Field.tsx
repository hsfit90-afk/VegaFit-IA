import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Rótulo + campo + mensagem de erro, ligados corretamente.
 *
 * Havia 24 <label> em 9 telas com CINCO estilos diferentes para a mesma coisa
 * (text-gray-400 mb-1, text-white mb-1, text-foreground-muted mb-4, mb-3, uppercase...).
 *
 * Além de padronizar o visual, o componente resolve um problema de acessibilidade: gera o `id`
 * quando não vem um, e amarra `htmlFor`, `aria-describedby` e `aria-invalid` — coisas que o
 * markup repetido à mão fazia de forma inconsistente.
 */

export interface FieldProps {
  label: string;
  /** Usado no htmlFor/id. Sem ele, um id estável é gerado via useId. */
  htmlFor?: string;
  erro?: string;
  /** Texto auxiliar abaixo do campo. Some quando há erro, pra não competir. */
  ajuda?: string;
  obrigatorio?: boolean;
  className?: string;
  children: React.ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>;
}

export function Field({ label, htmlFor, erro, ajuda, obrigatorio, className, children }: FieldProps) {
  const idGerado = React.useId();
  const id = htmlFor || children.props.id || idGerado;
  const idMensagem = `${id}-msg`;
  const temMensagem = Boolean(erro || ajuda);

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-foreground-muted">
        {label}
        {obrigatorio && <span className="text-destructive ml-1" aria-hidden="true">*</span>}
      </label>

      {React.cloneElement(children, {
        id,
        'aria-describedby': temMensagem ? idMensagem : undefined,
        'aria-invalid': erro ? true : undefined,
      })}

      {temMensagem && (
        <p
          id={idMensagem}
          role={erro ? 'alert' : undefined}
          className={cn('text-xs', erro ? 'text-destructive' : 'text-foreground-muted')}
        >
          {erro || ajuda}
        </p>
      )}
    </div>
  );
}
