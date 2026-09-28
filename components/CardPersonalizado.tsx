"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserCheck, ArrowRight } from 'lucide-react';
import { VALOR } from '@/lib/treinoPersonalizado';

/**
 * Chamada do Treino Personalizado na home.
 *
 * Existe por dois motivos. O prático: no celular a barra inferior tem cinco itens fixos e não
 * inclui esta tela, então sem o card o produto de maior margem ficaria invisível justamente
 * para a maior parte do público.
 *
 * O comercial: um item de menu é navegação, um card é oferta. Aqui dá para dizer o preço e
 * mostrar que as vagas são poucas — que é o que faz alguém clicar.
 *
 * Some quando não há vaga e quando o aluno já tem pedido em andamento: oferecer o que não se
 * pode entregar é a forma mais rápida de perder a confiança de quem já comprou.
 */
export function CardPersonalizado() {
  const [vagas, setVagas] = useState<{ restantes: number; limite: number; acabando: boolean } | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch('/api/personalizado');
        if (!res.ok || !vivo) return;
        const d = await res.json();
        if (d.esgotado || d.temPedidoAberto) return;   // fica null, não renderiza
        setVagas({ restantes: d.vagasRestantes, limite: d.limiteDeVagas ?? 10, acabando: d.acabando });
      } catch { /* sem card é melhor que card quebrado */ }
    })();
    return () => { vivo = false; };
  }, []);

  if (vagas === null) return null;

  // Com poucas vagas o card troca de tom: de oferta para urgência. A escassez é real — são
  // as vagas do lote de lançamento, que não voltam no mês seguinte.
  const urgente = vagas.acabando;

  return (
    <Link
      href="/personalizado"
      className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all ${
        urgente
          ? 'border-warning/40 bg-gradient-to-r from-warning/10 to-transparent hover:border-warning/60'
          : 'border-accent/25 bg-gradient-to-r from-accent/10 to-transparent hover:border-accent/50'
      }`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
        urgente ? 'bg-gradient-to-br from-warning to-accent' : 'bg-gradient-to-br from-accent to-primary'
      }`}>
        <UserCheck className="w-5 h-5 text-white" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-outfit font-bold text-sm leading-tight">
            {urgente ? 'Últimas vagas do treino montado por mim' : 'Quer um treino montado por mim?'}
          </p>
          <span className={`px-2 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider whitespace-nowrap ${
            urgente ? 'bg-warning/20 text-warning' : 'bg-accent/20 text-accent'
          }`}>
            {vagas.restantes} de {vagas.limite}
          </span>
        </div>
        <p className="text-xs text-foreground-muted mt-1 leading-snug">
          Sem IA: eu monto exercício por exercício, a partir da sua anamnese.{' '}
          <span className="text-foreground font-semibold whitespace-nowrap">R$ {VALOR}</span>
          {urgente && <span className="text-warning font-semibold"> · quando acabar, fecha.</span>}
        </p>
      </div>

      <ArrowRight className={`w-4 h-4 shrink-0 group-hover:translate-x-0.5 transition-transform ${
        urgente ? 'text-warning' : 'text-accent'
      }`} />
    </Link>
  );
}
