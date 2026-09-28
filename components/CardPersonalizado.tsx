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
  const [vagas, setVagas] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch('/api/personalizado');
        if (!res.ok || !vivo) return;
        const d = await res.json();
        if (d.esgotado || d.temPedidoAberto) return;   // fica null, não renderiza
        setVagas(d.vagasRestantes);
      } catch { /* sem card é melhor que card quebrado */ }
    })();
    return () => { vivo = false; };
  }, []);

  if (vagas === null) return null;

  return (
    <Link
      href="/personalizado"
      className="group flex items-center gap-4 p-4 rounded-2xl border border-accent/25 bg-gradient-to-r from-accent/10 to-transparent hover:border-accent/50 transition-all"
    >
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shrink-0 shadow-lg">
        <UserCheck className="w-5 h-5 text-white" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-outfit font-bold text-sm leading-tight">Quer um treino montado por mim?</p>
        <p className="text-xs text-foreground-muted mt-0.5 leading-snug">
          Sem IA: eu monto exercício por exercício, a partir da sua anamnese.
          {' '}
          <span className="text-accent font-semibold whitespace-nowrap">
            R$ {VALOR} · {vagas} {vagas === 1 ? 'vaga' : 'vagas'} este mês
          </span>
        </p>
      </div>

      <ArrowRight className="w-4 h-4 text-accent shrink-0 group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}
