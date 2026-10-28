import { cn } from '@/lib/utils';

/**
 * Selo curto: estado, categoria, contagem.
 *
 * POR QUE VIRA COMPONENTE
 *
 * O padrão já existia espalhado pelo app — "TREINANDO AGORA", "C/ AQUECIMENTO", "(master)",
 * o rótulo do método no bloco de superset —, cada um com o próprio tamanho, raio e opacidade
 * de fundo. Um selo escrito à mão em cada tela é uma decisão tomada de novo em cada tela.
 *
 * AS CLASSES SÃO COMPLETAS, NUNCA MONTADAS.
 *
 * `bg-${cor}/15` não gera CSS: o Tailwind lê o código como texto e não executa nada. Por isso
 * o mapa abaixo guarda a classe inteira — a armadilha número 1 do AGENTS.md.
 */
const TONS = {
  neutro: 'bg-surface-light text-foreground-muted',
  primario: 'bg-primary/15 text-primary',
  destaque: 'bg-accent/15 text-accent',
  atencao: 'bg-warning/15 text-warning',
  perigo: 'bg-destructive/15 text-destructive',
} as const;

export type TomDoSelo = keyof typeof TONS;

export function Badge({
  tom = 'neutro',
  children,
  className,
}: {
  tom?: TomDoSelo;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        // text-nano em maiúscula com espaçamento: é o rótulo de classificação, não de leitura.
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5',
        'text-nano font-bold uppercase tracking-wider whitespace-nowrap',
        TONS[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}
