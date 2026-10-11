"use client";

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent } from '@/components/ui/Card';
import { StretchHorizontal, Loader2, Clock } from 'lucide-react';
import { ListaComCronometro, type ItemDaLista } from '@/components/workout/ListaComCronometro';
import { selecionarAlongamento } from '@/lib/preparoFinalizacao';
import { PADDING_TELA, LARGURA_FOCO, RODAPE_SEGURO } from '@/lib/layout';

/**
 * Alongamento, em tela própria.
 *
 * Tem tela separada — e não um bloco dentro da sessão como a mobilidade — porque a prescrição
 * é diferente: alongamento pode ser feito a qualquer hora do dia, inclusive em dia de
 * descanso. Amarrá-lo ao treino obrigaria a pessoa a abrir o treino para alongar.
 *
 * Não consome IA. A lista vem do catálogo, classificada por lib/preparoFinalizacao.ts, e o
 * aluno filtra pelo que quer soltar.
 *
 * O cronômetro é a parte que importa: alongamento se faz por tempo, e quase ninguém conta
 * trinta segundos direito sozinho.
 */

const GRUPOS = ['Todos', 'Peito', 'Costas', 'Ombro', 'Pernas (quadríceps)', 'Posterior de coxa', 'Glúteos', 'Core/Abdômen', 'Lombar', 'Panturrilhas'];
const SEGUNDOS = 30;

export default function Alongamento() {
  const [catalogo, setCatalogo] = useState<ItemDaLista[] | null>(null);
  const [grupo, setGrupo] = useState('Todos');

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('exercises')
        .select('id, name, muscle_group, media_url')
        .order('name')
        .limit(1000);
      setCatalogo((data ?? []).map(e => ({
        id: e.id, name: e.name, muscle_group: e.muscle_group, mediaUrl: e.media_url,
      })));
    })();
  }, []);

  const lista = useMemo(() => {
    if (!catalogo) return [];
    return selecionarAlongamento(catalogo, grupo === 'Todos' ? [] : [grupo]);
  }, [catalogo, grupo]);

  if (!catalogo) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className={`${PADDING_TELA} ${LARGURA_FOCO} mx-auto animate-fade-in ${RODAPE_SEGURO}`}>
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center shadow-lg">
            <StretchHorizontal className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-outfit font-bold leading-none">Alongamento</h1>
            <p className="text-sm text-foreground-muted mt-1">A qualquer hora do dia</p>
          </div>
        </div>
        <p className="text-foreground-muted text-sm leading-relaxed max-w-prose">
          Não precisa estar treinando. Escolha a região que está travada, segure cada posição
          por {SEGUNDOS} segundos e respire — sem forçar até doer.
        </p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1">
        {GRUPOS.map(g => (
          <button
            key={g}
            onClick={() => setGrupo(g)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors flex-none ${
              grupo === g ? 'bg-primary text-primary-foreground' : 'bg-surface text-foreground-muted hover:bg-surface-hover'
            }`}
          >
            {g === 'Pernas (quadríceps)' ? 'Pernas' : g === 'Core/Abdômen' ? 'Core' : g}
          </button>
        ))}
      </div>

      {/* Mesma lista de mobilidade: duas copias divergem na primeira correcao que alguem
          esquece de aplicar nas duas. */}
      <ListaComCronometro
        itens={lista}
        segundos={SEGUNDOS}
        vazio="Nenhum alongamento cadastrado para essa região ainda."
      />

      <p className="text-xs text-foreground-muted mt-5 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 flex-none" />
        {lista.length} {lista.length === 1 ? 'alongamento' : 'alongamentos'} · toque no play para cronometrar
      </p>
    </div>
  );
}
