"use client";

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, Loader2, Clock } from 'lucide-react';
import { estadoDeAcesso } from '@/lib/subscription';
import { PADDING_TELA, LARGURA_AUTH } from '@/lib/layout';

/**
 * Para onde o Mercado Pago devolve o aluno depois do checkout.
 *
 * O problema que esta tela resolve: o aluno volta ANTES do webhook chegar. Se mostrássemos
 * o app direto, ele veria a mesma parede de pagamento que acabou de pagar para tirar — e
 * pediria reembolso achando que não funcionou.
 *
 * Então a tela consulta o próprio status algumas vezes, com intervalo, e só libera quando o
 * webhook já gravou. Se demorar mais que isso, diz a verdade: está confirmando, pode usar o
 * app normalmente. Nunca deixa a pessoa numa tela de erro por causa de latência do gateway.
 */

const TENTATIVAS = 8;
const INTERVALO_MS = 2000;

export default function RetornoDoPagamento() {
  const router = useRouter();
  const [situacao, setSituacao] = useState<'conferindo' | 'confirmada' | 'demorando'>('conferindo');

  const conferir = useCallback(async (): Promise<boolean> => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/login'); return true; }

    // Primeiro PERGUNTA ao Mercado Pago em vez de esperar a notificação chegar. É o que faz
    // esta tela funcionar mesmo se o webhook falhar ou atrasar — o aluno que acabou de pagar
    // não pode ficar preso aqui por causa de um problema que não é dele.
    try {
      const res = await fetch('/api/assinatura/sincronizar', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.temAcesso) return true;
      }
    } catch {
      // Sincronização é o caminho rápido, não o único: se falhar, a leitura abaixo ainda
      // pega o resultado do webhook quando ele chegar.
    }

    const { data } = await supabase
      .from('profiles')
      .select('subscription_status, trial_ends_at, subscription_expires_at')
      .eq('id', user.id)
      .maybeSingle();

    return estadoDeAcesso({
      subscriptionStatus: data?.subscription_status,
      trialEndsAt: data?.trial_ends_at,
      subscriptionExpiresAt: data?.subscription_expires_at,
    }).temAcesso;
  }, [router]);

  useEffect(() => {
    let vivo = true;
    let tentativa = 0;

    async function laco() {
      while (vivo && tentativa < TENTATIVAS) {
        if (await conferir()) {
          if (vivo) setSituacao('confirmada');
          return;
        }
        tentativa++;
        await new Promise(r => setTimeout(r, INTERVALO_MS));
      }
      if (vivo) setSituacao('demorando');
    }

    laco();
    return () => { vivo = false; };
  }, [conferir]);

  return (
    <div className={`${PADDING_TELA} ${LARGURA_AUTH} mx-auto min-h-[70vh] flex flex-col items-center justify-center text-center gap-5 animate-fade-in`}>
      {situacao === 'conferindo' && (
        <>
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <h1 className="text-2xl font-outfit font-bold">Confirmando seu pagamento…</h1>
          <p className="text-foreground-muted text-sm">Leva alguns segundos. Não feche esta tela.</p>
        </>
      )}

      {situacao === 'confirmada' && (
        <>
          <CheckCircle2 className="w-14 h-14 text-primary" />
          <h1 className="text-2xl font-outfit font-bold">Tudo certo. Bem-vindo.</h1>
          <p className="text-foreground-muted text-sm">
            Seus 7 dias de teste começaram agora. A primeira cobrança só acontece depois disso,
            e você pode cancelar antes sem pagar nada.
          </p>
          <Button className="w-full mt-2" onClick={() => router.replace('/')}>
            Começar a treinar
          </Button>
        </>
      )}

      {situacao === 'demorando' && (
        <>
          <Clock className="w-12 h-12 text-warning" />
          <h1 className="text-2xl font-outfit font-bold">Ainda estamos confirmando.</h1>
          <p className="text-foreground-muted text-sm">
            O Mercado Pago às vezes leva alguns minutos. Pode usar o app normalmente — assim que
            a confirmação chegar, tudo libera sozinho. Se em 30 minutos continuar assim, fale
            com a gente.
          </p>
          <Button variant="outline" className="w-full mt-2" onClick={() => router.replace('/')}>
            Ir para o app
          </Button>
        </>
      )}
    </div>
  );
}
