"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { estadoDeAcesso, type EstadoDeAcesso } from '@/lib/subscription';

/**
 * Avisa o aluno de que ele está em teste gratuito, e quantos dias faltam.
 *
 * POR QUE EXISTE
 *
 * Sem isto, a pessoa se cadastra, usa o app por sete dias sem nenhum sinal de que há uma
 * cobrança chegando, e no oitavo dia encontra uma parede de pagamento. Isso é emboscada: ela
 * pede reembolso, cancela e escreve avaliação ruim — e tem razão, porque ninguém avisou.
 *
 * Avisar cedo também converte melhor. Quem sabe que o prazo está acabando e está gostando do
 * treino decide assinar ANTES de ser bloqueado, em vez de decidir sob irritação.
 *
 * QUEM NÃO VÊ NADA
 *
 * Cortesia e assinatura ativa não mostram aviso nenhum. Seus testadores antigos, em especial,
 * nunca podem ver qualquer menção a pagamento — eles usaram o app antes de existir cobrança.
 *
 * Lê o próprio status direto do banco em vez de passar pelo AppContext: é um aviso isolado, e
 * enfiar assinatura no contexto global obrigaria a mexer em vinte telas para resolver uma.
 */
export function AvisoDeAssinatura() {
  const [estado, setEstado] = useState<EstadoDeAcesso | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('subscription_status, trial_ends_at, subscription_expires_at')
        .eq('id', user.id)
        .maybeSingle();

      if (!vivo) return;
      setEstado(estadoDeAcesso({
        subscriptionStatus: data?.subscription_status,
        trialEndsAt: data?.trial_ends_at,
        subscriptionExpiresAt: data?.subscription_expires_at,
      }));
    })();
    return () => { vivo = false; };
  }, []);

  if (!estado) return null;

  // Cortesia e assinatura em dia não recebem aviso nenhum.
  if (estado.status === 'cortesia') return null;
  if (estado.status === 'ativo' && !estado.emTolerancia) return null;

  // Pagamento pendente: quem já pagou antes e teve o cartão recusado. Avisa sem bloquear,
  // porque o Mercado Pago ainda está reprocessando e o acesso continua liberado.
  if (estado.emTolerancia) {
    return (
      <Faixa
        tom="alerta"
        icone={<AlertTriangle className="w-5 h-5 text-warning" />}
        titulo="Não conseguimos confirmar seu pagamento"
        texto="Seu acesso continua liberado por enquanto. Verifique o cartão para não ser interrompido."
        acao="Revisar pagamento"
      />
    );
  }

  if (!estado.emTeste) return null;

  const dias = estado.diasDeTesteRestantes ?? 0;
  const acabando = dias <= 2;

  return (
    <Faixa
      tom={acabando ? 'alerta' : 'calmo'}
      icone={acabando
        ? <AlertTriangle className="w-5 h-5 text-warning" />
        : <Clock className="w-5 h-5 text-primary" />}
      titulo={
        dias <= 0 ? 'Seu teste termina hoje'
        : dias === 1 ? 'Falta 1 dia de teste grátis'
        : `Faltam ${dias} dias de teste grátis`
      }
      texto={
        acabando
          ? 'Assine para não perder a progressão semanal e continuar gerando treino novo.'
          : 'Você está no teste gratuito. Depois dele, R$ 37 por mês — cancele quando quiser.'
      }
      acao={acabando ? 'Assinar agora' : 'Ver planos'}
    />
  );
}

function Faixa({ tom, icone, titulo, texto, acao }: {
  tom: 'calmo' | 'alerta';
  icone: React.ReactNode;
  titulo: string;
  texto: string;
  acao: string;
}) {
  const cor = tom === 'alerta'
    ? 'bg-warning/5 border-warning/30'
    : 'bg-primary/5 border-primary/20';

  return (
    <Link
      href="/assinar?ver=1"
      className={`flex items-center gap-4 p-4 rounded-2xl border ${cor} hover:brightness-110 transition-all group`}
    >
      <div className="flex-none">{icone}</div>
      <div className="flex-1 min-w-0">
        <p className="font-outfit font-bold text-sm leading-tight">{titulo}</p>
        <p className="text-xs text-foreground-muted mt-0.5 leading-snug">{texto}</p>
      </div>
      <span className="flex-none flex items-center gap-1 text-xs font-semibold text-primary whitespace-nowrap">
        {acao}
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </Link>
  );
}
