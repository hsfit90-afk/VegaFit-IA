"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Check, ShieldCheck, Loader2, Dumbbell, History, BarChart3 } from 'lucide-react';
import { estadoDeAcesso, type EstadoDeAcesso } from '@/lib/subscription';
import { PADDING_TELA, LARGURA_FOCO, RODAPE_SEGURO } from '@/lib/layout';

/**
 * Tela de assinatura. Chega aqui quem recebeu 402 de uma rota de IA, ou quem clica em
 * "assinar" nas configurações.
 *
 * Duas regras que não podem quebrar:
 *
 *  1. Quem TEM acesso nunca vê esta tela. Um aluno em 'cortesia' que caia aqui por um link
 *     errado é devolvido para a home — essa pessoa usou o app antes de existir cobrança e
 *     não pode encontrar uma parede de pagamento.
 *  2. A tela diz o que CONTINUA funcionando. Assinatura vencida para de gerar treino novo,
 *     mas o plano atual, o histórico e os gráficos seguem acessíveis. Quem acha que perdeu
 *     tudo não volta.
 *
 * Lê o status direto do banco em vez de passar pelo AppContext de propósito: é uma tela
 * isolada, e enfiar assinatura no contexto global obrigaria a mexer em 20 telas para
 * resolver uma.
 */
export default function Assinar() {
  const router = useRouter();
  const params = useSearchParams();
  const [estado, setEstado] = useState<EstadoDeAcesso | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [indoParaCheckout, setIndoParaCheckout] = useState<'mensal' | 'anual' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data } = await supabase
        .from('profiles')
        .select('subscription_status, trial_ends_at, subscription_expires_at, subscription_plan')
        .eq('id', user.id)
        .maybeSingle();

      if (!vivo) return;

      const e = estadoDeAcesso({
        subscriptionStatus: data?.subscription_status,
        trialEndsAt: data?.trial_ends_at,
        subscriptionExpiresAt: data?.subscription_expires_at,
        subscriptionPlan: data?.subscription_plan,
      });

      // Regra 1: quem tem acesso não fica preso aqui.
      if (e.temAcesso && !params.get('ver')) { router.replace('/'); return; }

      setEstado(e);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [router, params]);

  async function assinar(plano: 'mensal' | 'anual') {
    setIndoParaCheckout(plano);
    setErro(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Não consegui abrir o pagamento.');
      window.location.href = data.url;
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui abrir o pagamento. Tente de novo.');
      setIndoParaCheckout(null);
    }
  }

  if (carregando) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  const titulo =
    estado?.status === 'trial' ? 'Seu teste de 7 dias terminou.'
    : estado?.status === 'cancelado' ? 'Sua assinatura foi encerrada.'
    : estado?.nuncaAssinou ? 'Assine para continuar.'
    : 'Seu pagamento não foi confirmado.';

  const subtitulo =
    estado?.status === 'trial' ? 'Você montou seu treino e testou na academia. Para continuar recebendo treino novo e a progressão semanal, escolha um plano.'
    : estado?.status === 'cancelado' ? 'Reative quando quiser — seu histórico, seus recordes e sua evolução continuam todos aqui.'
    : 'Verifique o cartão ou escolha outra forma de pagamento. Se você acabou de pagar, pode levar alguns minutos para confirmar.';

  return (
    <div className={`${PADDING_TELA} ${LARGURA_FOCO} mx-auto animate-fade-in ${RODAPE_SEGURO}`}>
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-outfit font-bold mb-3">{titulo}</h1>
        <p className="text-foreground-muted leading-relaxed">{subtitulo}</p>
      </header>

      {/* Regra 2: o que NÃO some. Quem acha que perdeu tudo não volta. */}
      <Card className="mb-8 border-border-light">
        <CardContent className="p-5">
          <p className="text-sm font-semibold mb-3">Continua seu, mesmo sem assinar:</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2.5 text-sm text-foreground-muted">
              <Dumbbell className="w-4 h-4 text-primary flex-none" /> O treino que você já tem
            </div>
            <div className="flex items-center gap-2.5 text-sm text-foreground-muted">
              <History className="w-4 h-4 text-primary flex-none" /> Histórico e recordes
            </div>
            <div className="flex items-center gap-2.5 text-sm text-foreground-muted">
              <BarChart3 className="w-4 h-4 text-primary flex-none" /> Gráficos de evolução
            </div>
          </div>
          <p className="text-xs text-foreground-muted mt-3">
            O que pausa é a geração de treino novo, o check-in semanal, a troca de exercício e o coach.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-6 flex flex-col gap-5 h-full">
            <div>
              <p className="font-outfit font-bold text-lg">Mensal</p>
              <p className="text-sm text-foreground-muted">Para testar sem compromisso</p>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-foreground-muted font-semibold">R$</span>
                <span className="font-outfit font-extrabold text-5xl tracking-tight tabular-nums">37</span>
                <span className="text-foreground-muted">/mês</span>
              </div>
              <p className="text-sm text-primary font-semibold mt-1">R$ 1,23 por dia</p>
            </div>
            <ul className="space-y-2 text-sm text-foreground-muted flex-1">
              <li className="flex gap-2"><Check className="w-4 h-4 text-primary flex-none mt-0.5" /> Acesso completo</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-primary flex-none mt-0.5" /> Treino novo quando precisar</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-primary flex-none mt-0.5" /> Cancele quando quiser</li>
            </ul>
            <Button
              variant="outline"
              className="w-full"
              disabled={indoParaCheckout !== null}
              onClick={() => assinar('mensal')}
            >
              {indoParaCheckout === 'mensal' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assinar o mensal'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/50 relative overflow-visible">
          <span className="absolute -top-3 left-6 bg-primary text-primary-foreground font-outfit font-bold text-[0.7rem] tracking-wider uppercase px-3 py-1 rounded-md">
            Economize R$ 147
          </span>
          <CardContent className="p-6 flex flex-col gap-5 h-full">
            <div>
              <p className="font-outfit font-bold text-lg">Anual</p>
              <p className="text-sm text-foreground-muted">Para quem vai levar a sério</p>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-foreground-muted font-semibold">R$</span>
                <span className="font-outfit font-extrabold text-5xl tracking-tight tabular-nums">24</span>
                <span className="text-foreground-muted">,75/mês</span>
              </div>
              <p className="text-sm text-primary font-semibold mt-1">R$ 0,81 por dia</p>
              <p className="text-xs text-foreground-muted mt-1">
                R$ 297 à vista ou em 12× · <span className="line-through">R$ 444</span>
              </p>
            </div>
            <ul className="space-y-2 text-sm text-foreground-muted flex-1">
              <li className="flex gap-2"><Check className="w-4 h-4 text-primary flex-none mt-0.5" /> Tudo do mensal</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-primary flex-none mt-0.5" /> 3 meses grátis na prática</li>
              <li className="flex gap-2"><Check className="w-4 h-4 text-primary flex-none mt-0.5" /> Preço travado na renovação</li>
            </ul>
            <Button
              className="w-full"
              disabled={indoParaCheckout !== null}
              onClick={() => assinar('anual')}
            >
              {indoParaCheckout === 'anual' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assinar o anual'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {erro && (
        <p className="text-sm text-destructive mb-6" role="alert">{erro}</p>
      )}

      <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/30 bg-warning/5">
        <ShieldCheck className="w-5 h-5 text-warning flex-none mt-0.5" />
        <p className="text-sm text-foreground-muted">
          <span className="text-foreground font-semibold">Garantia de 7 dias.</span> Se você assinar e
          mudar de ideia em até 7 dias, devolvo o valor integral — sem pergunta e sem formulário.
        </p>
      </div>
    </div>
  );
}
