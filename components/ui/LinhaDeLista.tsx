import { cn } from '@/lib/utils';

/**
 * A linha de lista padrão: miniatura, título, meta, ação.
 *
 * É O COMPONENTE QUE MAIS FALTAVA.
 *
 * Nos dois apps de referência esta mesma linha se repete em todas as telas — lista de
 * exercício, lista de treino, lista de ajuste. Repetir um padrão é o que faz um app parecer
 * organizado; é mais barato que desenhar bonito, e rende mais.
 *
 * Aqui ela é reinventada à mão em /active, /library, /history, /admin/montar e /alongamento,
 * cada uma com altura, espaçamento e tamanho de miniatura próprios.
 *
 * SEM BORDA ENTRE AS LINHAS. A separação é por respiro e por fundo, como na referência;
 * filete entre itens soma linha, e linha soma ruído.
 */
export function LinhaDeLista({
  midia,
  titulo,
  meta,
  selo,
  acao,
  onClick,
  className,
}: {
  /** Miniatura 56px. Quem chama decide se é imagem, vídeo ou ícone. */
  midia?: React.ReactNode;
  titulo: React.ReactNode;
  /** Linha de apoio: "5 séries · 10 reps · 28 kg". */
  meta?: React.ReactNode;
  selo?: React.ReactNode;
  /** Canto direito: menu, cronômetro, seta. */
  acao?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const conteudo = (
    <>
      {midia && (
        <span className="w-14 h-14 shrink-0 rounded-sm bg-surface-light overflow-hidden grid place-items-center">
          {midia}
        </span>
      )}

      {/* min-w-0 permite o truncate funcionar: sem ele, título longo empurra a ação para fora. */}
      <span className="flex-1 min-w-0">
        {selo && <span className="block mb-1">{selo}</span>}
        <span className="block text-sm font-semibold text-foreground truncate">{titulo}</span>
        {meta && (
          <span className="block text-micro text-foreground-muted truncate mt-0.5">{meta}</span>
        )}
      </span>

      {acao && <span className="shrink-0">{acao}</span>}
    </>
  );

  const base = 'w-full flex items-center gap-3 py-3 text-left';

  if (!onClick) return <div className={cn(base, className)}>{conteudo}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        base,
        'min-h-[44px] rounded-md transition-colors duration-[120ms] hover:bg-surface-hover',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        className,
      )}
    >
      {conteudo}
    </button>
  );
}
