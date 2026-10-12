"use client";

import { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

/**
 * Pede permissão de notificação e inscreve o aluno nos lembretes de treino.
 *
 * POR QUE ISTO NÃO EXISTIA
 *
 * Tudo em volta já estava pronto: a tabela push_subscriptions, a rota /api/push/subscribe, o
 * handler de `push` no worker e o cron que dispara 22h todo dia. Faltava a única peça que o
 * navegador exige — alguém PEDIR a permissão. Medido em 11/10/2026: zero inscritos. O cron
 * rodava toda noite e enviava para ninguém.
 *
 * QUANDO PEDIR IMPORTA MAIS QUE COMO PEDIR
 *
 * O navegador dá UMA chance: quem clica em "bloquear" não vê o pedido de novo, e consertar
 * exige mexer nas configurações do site — ninguém faz. Por isso este componente nasce na tela
 * de TREINO CONCLUÍDO, não na primeira visita. A pessoa acabou de terminar, está no melhor
 * momento do app, e o pedido faz sentido para ela ("quer que eu te lembre na próxima?").
 *
 * E pede em dois tempos: primeiro o nosso botão, depois o do navegador. Quem não tem
 * interesse ignora o nosso e nunca gasta a única chance.
 */

/**
 * A chave VAPID vem em base64url e o navegador quer bytes.
 *
 * O ArrayBuffer é criado explicitamente porque `applicationServerKey` exige um BufferSource
 * apoiado em ArrayBuffer, e `Uint8Array.from` devolve um tipo genérico que também abrange
 * SharedArrayBuffer — que o TypeScript recusa ali.
 */
function paraBytes(base64: string): Uint8Array<ArrayBuffer> {
  const preenchido = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const bruto = atob(preenchido);
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

type Estado = 'verificando' | 'indisponivel' | 'bloqueado' | 'inscrito' | 'pode-pedir' | 'pedindo';

export function AtivarLembretes({ compacto = false }: { compacto?: boolean }) {
  const toast = useToast();
  const [estado, setEstado] = useState<Estado>('verificando');

  useEffect(() => {
    (async () => {
      // iOS só expõe Notification dentro do app instalado; navegador antigo não tem nada
      // disso. Em qualquer um dos casos, some em vez de oferecer o que não funciona.
      if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        setEstado('indisponivel');
        return;
      }
      if (Notification.permission === 'denied') { setEstado('bloqueado'); return; }

      try {
        const registro = await navigator.serviceWorker.ready;
        const jaTem = await registro.pushManager.getSubscription();
        setEstado(jaTem ? 'inscrito' : 'pode-pedir');
      } catch {
        setEstado('indisponivel');
      }
    })();
  }, []);

  const ativar = async () => {
    setEstado('pedindo');
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== 'granted') {
        setEstado(permissao === 'denied' ? 'bloqueado' : 'pode-pedir');
        return;
      }

      const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!chave) throw new Error('Lembretes indisponíveis no momento.');

      const registro = await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: paraBytes(chave),
      });

      const r = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: inscricao.toJSON() }),
      });
      if (!r.ok) throw new Error('Não consegui salvar o lembrete.');

      setEstado('inscrito');
      toast.sucesso('Pronto. Vou te lembrar na hora do treino.');
    } catch (e) {
      setEstado('pode-pedir');
      toast.erro(e instanceof Error ? e.message : 'Não consegui ativar os lembretes.');
    }
  };

  const desativar = async () => {
    try {
      const registro = await navigator.serviceWorker.ready;
      const inscricao = await registro.pushManager.getSubscription();
      if (inscricao) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: inscricao.endpoint }),
        });
        await inscricao.unsubscribe();
      }
      setEstado('pode-pedir');
      toast.sucesso('Lembretes desligados.');
    } catch {
      toast.erro('Não consegui desligar.');
    }
  };

  if (estado === 'verificando' || estado === 'indisponivel') return null;

  // Na tela de treino concluído: só aparece para quem ainda pode ativar. Quem já ativou não
  // precisa ser parabenizado por isso toda vez que termina um treino.
  if (compacto && estado !== 'pode-pedir' && estado !== 'pedindo') return null;

  if (estado === 'bloqueado') {
    return (
      <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-foreground-muted flex items-start gap-3">
        <BellOff className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Os lembretes estão bloqueados para este site no seu navegador. Para voltar a
          recebê-los, libere as notificações nas configurações do site.
        </span>
      </div>
    );
  }

  if (estado === 'inscrito') {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
        <Check className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm flex-1">Lembretes de treino ligados.</span>
        <button onClick={desativar} className="text-xs text-foreground-muted hover:text-destructive underline shrink-0">
          Desligar
        </button>
      </div>
    );
  }

  return (
    <div className={compacto
      ? 'w-full rounded-2xl border border-white/15 bg-white/5 p-4 text-left'
      : 'rounded-2xl border border-border bg-surface p-4'}>
      <p className="text-sm font-semibold mb-1 flex items-center gap-2">
        <Bell className="w-4 h-4 text-primary" /> Quer que eu te lembre do próximo?
      </p>
      <p className="text-xs text-foreground-muted leading-relaxed mb-3">
        Um aviso no celular nos dias de treino. Dá para desligar quando quiser.
      </p>
      <Button onClick={ativar} disabled={estado === 'pedindo'} size="sm">
        {estado === 'pedindo' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ativar lembretes'}
      </Button>
    </div>
  );
}
