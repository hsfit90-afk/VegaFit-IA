"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { UserCheck, Loader2, Check, Clock, CalendarDays, ExternalLink } from 'lucide-react';
import { descreverStatus, prazoDeEntrega } from '@/lib/treinoPersonalizado';
import { PADDING_TELA, LARGURA_FOCO, RODAPE_SEGURO } from '@/lib/layout';

/**
 * Treino Personalizado: o treino montado à mão pelo profissional.
 *
 * É o produto de maior margem do app e o único que um concorrente não copia — um software
 * qualquer gera treino, mas não tem um profissional registrado assinando embaixo. Por isso a
 * tela vende a PESSOA, não a tecnologia: em todo o resto do app a IA é o argumento, aqui ela
 * é justamente o que o aluno está deixando de lado.
 *
 * As vagas são reais, não escassez inventada: cada treino consome horas do profissional. A
 * contagem vem do servidor e é conferida de novo na hora de aceitar o pedido.
 */

interface Estado {
  valor: number;
  vagasRestantes: number;
  limiteDeVagas: number;
  acabando: boolean;
  esgotado: boolean;
  temPedidoAberto: boolean;
  pedidos: { id: string; status: string; created_at: string; objetivo?: string | null }[];
  whatsapp: string | null;
}

/**
 * Link do WhatsApp com a mensagem já escrita.
 *
 * Levar o aluno para uma conversa em branco faz ele travar e desistir — a maior perda de um
 * funil que termina em contato humano acontece no "e agora, o que eu escrevo?". Com o
 * objetivo dele já no texto, a conversa começa no assunto.
 */
function linkWhatsApp(numero: string, objetivo: string): string {
  const msg = objetivo
    ? `Olá! Reservei minha vaga do Treino do Personal no VegaFit. Meu objetivo: ${objetivo}`
    : 'Olá! Reservei minha vaga do Treino do Personal no VegaFit.';
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
}

export default function TreinoPersonalizado() {
  const toast = useToast();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [objetivo, setObjetivo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = async () => {
    try {
      const res = await fetch('/api/personalizado');
      if (res.ok) setEstado(await res.json());
    } catch { /* a tela mostra o carregando; recarregar resolve */ }
  };

  useEffect(() => { carregar(); }, []);

  const pedir = async () => {
    if (!objetivo.trim()) { toast.erro('Conte qual é o seu objetivo.'); return; }
    setEnviando(true);
    try {
      const res = await fetch('/api/personalizado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objetivo, observacoes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não consegui registrar o pedido.');
      toast.sucesso('Pedido registrado. Agora é só concluir o pagamento.');
      setObjetivo(''); setObservacoes('');
      await carregar();
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : 'Não consegui registrar o pedido.');
    } finally {
      setEnviando(false);
    }
  };

  if (!estado) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  const emAberto = estado.pedidos.find(p =>
    ['aguardando_pagamento', 'pago', 'em_producao'].includes(p.status)
  );
  const entrega = prazoDeEntrega();

  return (
    <div className={`${PADDING_TELA} ${LARGURA_FOCO} mx-auto animate-fade-in ${RODAPE_SEGURO}`}>
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg">
            <UserCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-outfit font-bold leading-none">Treino do Personal</h1>
            <p className="text-sm text-foreground-muted mt-1">Montado à mão, exercício por exercício</p>
          </div>
        </div>
        <p className="text-foreground-muted leading-relaxed max-w-prose">
          Aqui a inteligência artificial sai de cena. Eu leio sua anamnese, seu histórico e suas
          limitações, e monto seu treino exercício por exercício — com as escolhas que eu faria
          se você estivesse na minha frente.
        </p>
      </header>

      {/* Pedido em andamento tem prioridade sobre o formulário: quem já pediu quer saber
          do próprio pedido, não abrir outro. */}
      {emAberto ? (
        <Card className="border-primary/40 mb-6">
          <CardContent className="p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary flex-none" />
              <div>
                <p className="font-outfit font-bold">{descreverStatus(emAberto.status)}</p>
                <p className="text-sm text-foreground-muted">
                  Pedido feito em {new Date(emAberto.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            {emAberto.status === 'aguardando_pagamento' && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-foreground-muted mb-3">
                  Sua vaga está reservada. Agora é só falar comigo no WhatsApp para acertar o
                  pagamento e tirar qualquer dúvida antes de eu começar.
                </p>
                {estado.whatsapp ? (
                  <a
                    href={linkWhatsApp(estado.whatsapp, emAberto.objetivo ?? '')}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button className="w-full sm:w-auto">
                      Falar no WhatsApp <ExternalLink className="w-4 h-4" />
                    </Button>
                  </a>
                ) : (
                  <p className="text-sm text-warning">
                    Entrarei em contato com as instruções de pagamento.
                  </p>
                )}
              </div>
            )}

            {emAberto.status === 'em_producao' && (
              <p className="text-sm text-foreground-muted pt-4 border-t border-border">
                Estou montando seu treino agora. Ele aparece na sua tela de treinos assim que ficar pronto.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardContent className="p-6 flex flex-col gap-5">
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <div className="flex items-baseline gap-1">
                  <span className="text-foreground-muted font-semibold">R$</span>
                  <span className="font-outfit font-extrabold text-5xl tracking-tight tabular-nums">{estado.valor}</span>
                  <span className="text-foreground-muted text-sm ml-1">pagamento único</span>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                  estado.esgotado ? 'bg-destructive/15 text-destructive'
                    : estado.acabando ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'
                }`}>
                  {estado.esgotado
                    ? 'Lote esgotado'
                    : `${estado.vagasRestantes} de ${estado.limiteDeVagas} vagas`}
                </span>
              </div>

              <ul className="space-y-2.5 text-sm text-foreground-muted">
                <li className="flex gap-2.5"><Check className="w-4 h-4 text-primary flex-none mt-0.5" /> Treino montado exercício por exercício, por mim</li>
                <li className="flex gap-2.5"><Check className="w-4 h-4 text-primary flex-none mt-0.5" /> Baseado na sua anamnese, seu histórico e suas limitações</li>
                <li className="flex gap-2.5"><Check className="w-4 h-4 text-primary flex-none mt-0.5" /> Uma revisão gratuita depois de duas semanas de uso</li>
                <li className="flex gap-2.5"><Check className="w-4 h-4 text-primary flex-none mt-0.5" /> Entra direto no app, com vídeo e cronômetro como qualquer treino</li>
              </ul>

              <p className="flex items-center gap-2 text-xs text-foreground-muted pt-1">
                <CalendarDays className="w-4 h-4 text-primary flex-none" />
                Pedindo hoje, fica pronto até {entrega.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}.
              </p>
            </CardContent>
          </Card>

          {estado.esgotado ? (
            <Card className="border-border">
              <CardContent className="p-6 text-center">
                <p className="font-outfit font-bold mb-1">As vagas deste lote acabaram.</p>
                <p className="text-sm text-foreground-muted">
                  O limite existe porque cada treino é montado à mão — prefiro entregar poucos bem
                  feitos a muitos às pressas. Quando eu abrir um novo lote, aviso por aqui.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="objetivo" className="text-sm font-semibold">
                    O que você quer alcançar?
                  </label>
                  <Input
                    id="objetivo"
                    value={objetivo}
                    onChange={e => setObjetivo(e.target.value)}
                    placeholder="Ex: ganhar massa nas pernas sem forçar o joelho"
                    maxLength={200}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="obs" className="text-sm font-semibold">
                    Algo que eu precise saber? <span className="text-foreground-muted font-normal">(opcional)</span>
                  </label>
                  <textarea
                    id="obs"
                    value={observacoes}
                    onChange={e => setObservacoes(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder="Horário que você treina, aparelhos que sua academia não tem, dores, o que você odeia fazer…"
                    className="w-full bg-surface border border-border rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  <span className="text-xs text-foreground-muted self-end tabular-nums">
                    {observacoes.length}/1000
                  </span>
                </div>

                <Button onClick={pedir} disabled={enviando} className="w-full">
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : `Reservar minha vaga e falar no WhatsApp`}
                </Button>
                <p className="text-xs text-foreground-muted text-center">
                  Ao reservar, você fala comigo no WhatsApp para acertar o pagamento. A vaga fica sua enquanto a gente conversa.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {estado.pedidos.filter(p => p.status === 'entregue').length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider mb-3">
            Já entregues
          </h2>
          <div className="flex flex-col gap-2">
            {estado.pedidos.filter(p => p.status === 'entregue').map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border text-sm">
                <Check className="w-4 h-4 text-primary flex-none" />
                <span className="flex-1 min-w-0 truncate">{p.objetivo || 'Treino personalizado'}</span>
                <span className="text-xs text-foreground-muted whitespace-nowrap">
                  {new Date(p.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
