"use client";

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Carga e repetição da série da vez, com botões de menos e mais.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 *
 * Registrar série no app exigia digitar número em teclado numérico, com o peso na mão, suando,
 * entre uma série e outra. O campo continua aí — quem quer cravar 27,5 digita —, mas o caso
 * comum é "igual à última, mais 2,5" ou "uma repetição menos que o previsto", e isso é um
 * toque, não uma digitação.
 *
 * SÓ NA SÉRIE DA VEZ, de propósito. Com os botões em todas as linhas, um exercício de quatro
 * séries vira dezesseis alvos de toque empilhados, e a linha que importa — a próxima a fazer —
 * deixa de se destacar. As séries concluídas e as futuras continuam na linha compacta.
 *
 * ESTE COMPONENTE NÃO DECIDE NADA
 *
 * Ele não sabe o que é carga, não conhece o método do treino, não fala com o banco. Recebe
 * dois números e devolve dois números pelo mesmo caminho que o campo de digitar já usava
 * (`handleSetUpdate` em `app/active/page.tsx`). O passo de 2,5 kg é o par de anilhas mais
 * comum na barra; em halter de 1 kg o aluno digita, como sempre pôde.
 *
 * O PISO É ZERO e não negativo: carga negativa não existe, e deixar o botão descer abaixo de
 * zero gravaria volume negativo no histórico do aluno.
 */

/** Um par de anilhas de 1,25 kg, o menor incremento real da maioria das academias. */
const PASSO_CARGA = 2.5;
const PASSO_REPS = 1;

export function ControleDaSerie({
  carga,
  repeticoes,
  rotulo,
  onAjustar,
  className,
}: {
  carga: number;
  repeticoes: number;
  /**
   * De que série é este bloco, escrito para o aluno ler: "Série 2".
   *
   * Acrescentado em 01/11/2026 porque o profissional, olhando a própria tela, perguntou
   * o que era este bloco. Sem o rótulo ele parece uma quarta linha solta entre as séries,
   * e não o controle da que está em aberto — que é o que ele é.
   */
  rotulo: string;
  /** Mesmo caminho do campo de digitar: quem chama liga em `handleSetUpdate`. */
  onAjustar: (campo: 'weight' | 'reps', valor: number) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'p-3 rounded-bloco bg-black/30 border border-primary/20',
        className,
      )}
    >
      <p className="text-nano font-semibold uppercase tracking-widest text-primary mb-2.5 pb-2 border-b border-primary/20">
        {rotulo} — a próxima a fazer
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Par
          rotulo="Carga (kg)"
          valor={carga}
          passo={PASSO_CARGA}
          /* Mostra 22,5 e 20 — não 22.5 e 20.0. Casa decimal só quando existe. */
          formatar={v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
          onMudar={v => onAjustar('weight', v)}
        />
        <Par
          rotulo="Repetições"
          valor={repeticoes}
          passo={PASSO_REPS}
          formatar={v => String(v)}
          onMudar={v => onAjustar('reps', v)}
        />
      </div>
    </div>
  );
}

function Par({
  rotulo,
  valor,
  passo,
  formatar,
  onMudar,
}: {
  rotulo: string;
  valor: number;
  passo: number;
  formatar: (v: number) => string;
  onMudar: (v: number) => void;
}) {
  const seguro = Number.isFinite(valor) ? valor : 0;

  /* Arredonda ao passo para o número não virar 22,500000000000004 depois de alguns toques —
     soma de ponto flutuante acumula, e o valor vai para o histórico do aluno. */
  const ajustar = (delta: number) => {
    const bruto = seguro + delta;
    const piso = Math.max(0, bruto);
    onMudar(Math.round(piso * 100) / 100);
  };

  return (
    <div>
      <p className="text-nano font-semibold uppercase tracking-widest text-foreground-muted mb-1.5 text-center">
        {rotulo}
      </p>

      <div className="flex items-center justify-between gap-1">
        <BotaoDePasso
          aria-label={`Diminuir ${rotulo.toLowerCase()}`}
          onClick={() => ajustar(-passo)}
          desabilitado={seguro <= 0}
        >
          <Minus className="w-4 h-4" aria-hidden="true" />
        </BotaoDePasso>

        {/* aria-live para quem usa leitor de tela ouvir o valor novo depois do toque, sem
            precisar sair do botão e voltar. */}
        <span
          aria-live="polite"
          className="flex-1 text-center font-mono text-2xl font-bold tabular-nums text-foreground"
        >
          {formatar(seguro)}
        </span>

        <BotaoDePasso
          aria-label={`Aumentar ${rotulo.toLowerCase()}`}
          onClick={() => ajustar(passo)}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </BotaoDePasso>
      </div>
    </div>
  );
}

/** 44px de lado: o mínimo que a mão acerta sem olhar, que é como se usa entre séries. */
function BotaoDePasso({
  children,
  onClick,
  desabilitado,
  ...resto
}: {
  children: React.ReactNode;
  onClick: () => void;
  desabilitado?: boolean;
} & React.ComponentPropsWithoutRef<'button'>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      className={cn(
        'w-11 h-11 shrink-0 grid place-items-center rounded-dia',
        'bg-surface-light text-foreground border border-border',
        'transition-colors duration-[120ms]',
        'hover:bg-primary/15 hover:border-primary/40 hover:text-primary',
        'active:bg-primary/25',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'disabled:opacity-30 disabled:pointer-events-none',
      )}
      {...resto}
    >
      {children}
    </button>
  );
}
