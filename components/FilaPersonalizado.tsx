"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { UserCheck, Loader2, ExternalLink } from 'lucide-react';
import { descreverStatus, vagasDoMes, VAGAS_POR_MES } from '@/lib/treinoPersonalizado';

/**
 * Fila de Treino Personalizado no painel master.
 *
 * Ordenada do mais antigo para o mais novo: quem esperou mais aparece primeiro, que é a ordem
 * em que os pedidos devem ser atendidos. Quem entrega por ordem de chegada não precisa se
 * lembrar de nada.
 *
 * O contador de vagas fica no topo porque é a informação que muda a sua decisão: com duas
 * vagas restantes você pensa duas vezes antes de aceitar um pedido fora do app.
 */

interface Pedido {
  id: string;
  user_id: string;
  nome: string;
  status: string;
  valor: number;
  objetivo: string | null;
  observacoes: string | null;
  created_at: string;
  pago_em: string | null;
  entregue_em: string | null;
}

const PROXIMO: Record<string, { status: string; rotulo: string } | null> = {
  aguardando_pagamento: { status: 'pago', rotulo: 'Confirmar pagamento' },
  pago: { status: 'em_producao', rotulo: 'Comecei a montar' },
  em_producao: { status: 'entregue', rotulo: 'Entreguei' },
  entregue: null,
  cancelado: null,
};

const COR: Record<string, string> = {
  aguardando_pagamento: 'bg-yellow-500/20 text-yellow-400',
  pago: 'bg-blue-500/20 text-blue-400',
  em_producao: 'bg-primary/20 text-primary',
  entregue: 'bg-white/10 text-gray-400',
  cancelado: 'bg-red-500/20 text-red-400',
};

export function FilaPersonalizado() {
  const toast = useToast();
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [mexendo, setMexendo] = useState<string | null>(null);

  const carregar = async () => {
    try {
      const res = await fetch('/api/admin/personalizado');
      if (res.ok) setPedidos((await res.json()).pedidos);
      else setPedidos([]);
    } catch { setPedidos([]); }
  };

  useEffect(() => { carregar(); }, []);

  const mover = async (id: string, status: string, rotulo: string) => {
    setMexendo(id);
    try {
      const res = await fetch('/api/admin/personalizado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não consegui alterar.');
      setPedidos(p => (p ?? []).map(x => (x.id === id ? { ...x, ...data.pedido } : x)));
      toast.sucesso(rotulo);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : 'Não consegui alterar.');
    } finally {
      setMexendo(null);
    }
  };

  if (pedidos === null) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const vagas = vagasDoMes(pedidos.map(p => ({ status: p.status, createdAt: p.created_at })));
  const emAndamento = pedidos.filter(p => p.status !== 'entregue' && p.status !== 'cancelado');
  const concluidos = pedidos.filter(p => p.status === 'entregue').length;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <h2 className="text-2xl font-outfit font-bold flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-primary" />
          Treino Personalizado
        </h2>
        <div className="flex items-center gap-3 text-sm">
          <span className={`px-3 py-1.5 rounded-full font-semibold ${
            vagas.esgotado ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'
          }`}>
            {vagas.ocupadas} de {VAGAS_POR_MES} vagas usadas
          </span>
          <span className="text-gray-500">{concluidos} entregues no total</span>
        </div>
      </div>

      {emAndamento.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-gray-400">
            Nenhum pedido em andamento. As {vagas.restantes} vagas restantes deste mês estão livres.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {emAndamento.map(p => {
            const proximo = PROXIMO[p.status];
            return (
              <Card key={p.id}>
                <CardContent className="p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-outfit font-bold text-white">{p.nome}</p>
                      <p className="text-xs text-gray-500 tabular-nums">
                        Pedido em {new Date(p.created_at).toLocaleDateString('pt-BR')} · R$ {p.valor}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${COR[p.status]}`}>
                      {descreverStatus(p.status)}
                    </span>
                  </div>

                  {p.objetivo && (
                    <p className="text-sm text-gray-300">
                      <span className="text-gray-500">Objetivo: </span>{p.objetivo}
                    </p>
                  )}
                  {p.observacoes && (
                    <p className="text-sm text-gray-400 bg-white/5 rounded-lg p-3 whitespace-pre-wrap">
                      {p.observacoes}
                    </p>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {proximo && (
                      <button
                        onClick={() => mover(p.id, proximo.status, proximo.rotulo)}
                        disabled={mexendo === p.id}
                        className="text-xs bg-primary/15 text-primary hover:bg-primary/25 disabled:opacity-40 transition-colors px-3 py-2 rounded-lg font-semibold"
                      >
                        {proximo.rotulo}
                      </button>
                    )}
                    <a
                      href={`/generator?para=${p.user_id}`}
                      className="text-xs bg-surface-light hover:bg-white/10 transition-colors px-3 py-2 rounded-lg inline-flex items-center gap-1.5"
                    >
                      Montar treino <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      onClick={() => {
                        if (confirm(`Cancelar o pedido de ${p.nome}? A vaga volta para o mês.`)) {
                          mover(p.id, 'cancelado', 'Pedido cancelado');
                        }
                      }}
                      disabled={mexendo === p.id}
                      className="text-xs bg-surface-light hover:bg-red-500/20 hover:text-red-400 disabled:opacity-40 transition-colors px-3 py-2 rounded-lg"
                    >
                      Cancelar
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
