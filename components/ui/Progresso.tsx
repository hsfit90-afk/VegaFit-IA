import { cn } from '@/lib/utils';

/**
 * Barra e anel de progresso.
 *
 * DOIS FORMATOS PORQUE SÃO DUAS PERGUNTAS DIFERENTES.
 *
 * A barra responde "quanto falta para o fim" e ocupa largura — serve para o ciclo de semanas,
 * para o plano, para a sessão. O anel responde "quanto deste item está feito" num espaço
 * pequeno e ao lado de outra coisa — serve para a série dentro do exercício.
 *
 * O NÚMERO ANDA JUNTO, SEMPRE.
 *
 * Informação nunca só por cor nem só por forma: quem enxerga mal, quem está no sol ou quem só
 * passou o olho precisa do valor escrito. Por isso `rotulo` existe e vem ligado por padrão.
 */

const limitar = (v: number) => Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0));

export function BarraDeProgresso({
  valor,
  rotulo = true,
  className,
  'aria-label': ariaLabel,
}: {
  /** 0 a 100. Valor fora da faixa é cortado, não rejeitado: barra quebrada é pior que barra cheia. */
  valor: number;
  rotulo?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const pct = limitar(valor);
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className="flex-1 h-1.5 rounded-full bg-surface-light overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel ?? 'Progresso'}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      {rotulo && (
        <span className="text-micro font-bold tabular-nums text-foreground-muted w-9 text-right">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}

export function AnelDeProgresso({
  valor,
  tamanho = 44,
  children,
  className,
  'aria-label': ariaLabel,
}: {
  valor: number;
  tamanho?: number;
  /** O que vai no meio: normalmente o número de séries feitas. */
  children?: React.ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  const pct = limitar(valor);
  const traco = 4;
  const raio = (tamanho - traco) / 2;
  const volta = 2 * Math.PI * raio;

  return (
    <div
      className={cn('relative inline-grid place-items-center shrink-0', className)}
      style={{ width: tamanho, height: tamanho }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? 'Progresso'}
    >
      {/* -rotate-90 põe o zero no topo; sem isso o anel começa às 3 horas e ninguém entende. */}
      <svg width={tamanho} height={tamanho} className="-rotate-90" aria-hidden="true">
        <circle
          cx={tamanho / 2} cy={tamanho / 2} r={raio}
          fill="none" strokeWidth={traco}
          className="stroke-surface-light"
        />
        <circle
          cx={tamanho / 2} cy={tamanho / 2} r={raio}
          fill="none" strokeWidth={traco} strokeLinecap="round"
          strokeDasharray={volta}
          strokeDashoffset={volta - (volta * pct) / 100}
          className="stroke-primary transition-[stroke-dashoffset] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
        />
      </svg>
      <span className="absolute text-micro font-bold tabular-nums text-foreground">
        {children}
      </span>
    </div>
  );
}
