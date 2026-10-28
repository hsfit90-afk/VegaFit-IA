import { cn } from '@/lib/utils';

/**
 * Rótulo de seção: a linha curta em maiúscula que classifica o bloco abaixo.
 *
 * POR QUE VIRA COMPONENTE
 *
 * Medido em 28/10/2026: só o dashboard repetia `text-[11px] uppercase tracking-[0.18em]` seis
 * vezes, e o app inteiro tinha 102 tamanhos em pixel cru. Cada cópia era uma chance de sair
 * 10px num lugar e 11px no outro — e é disso que vem a sensação de desalinhado, não da falta
 * de talento visual.
 *
 * O espaçamento também estava em dois valores (`tracking-[0.18em]` e `tracking-wider`). Aqui
 * é um só.
 *
 * MAIÚSCULA SÓ AQUI. Em rótulo curto ela classifica bem; em nome de exercício atrasa a
 * leitura, que é o erro do app de referência do profissional — "DESENVOLVIMENTO MILITAR COM
 * HALTERES" em maiúscula se lê bem mais devagar que em caixa normal.
 */
export function Rotulo({
  children,
  className,
  as: Tag = 'p',
}: {
  children: React.ReactNode;
  className?: string;
  /** `h2`/`h3` quando o rótulo realmente titula uma seção; `p` quando é só classificação. */
  as?: 'p' | 'h2' | 'h3' | 'span';
}) {
  return (
    <Tag
      className={cn(
        'text-nano font-semibold uppercase tracking-widest text-foreground-muted',
        className,
      )}
    >
      {children}
    </Tag>
  );
}
