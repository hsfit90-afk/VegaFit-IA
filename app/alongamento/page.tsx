"use client";

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent } from '@/components/ui/Card';
import { StretchHorizontal, Loader2, Clock, Play, Pause, RotateCcw } from 'lucide-react';
import { selecionarAlongamento, type ExercicioSimples } from '@/lib/preparoFinalizacao';
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
  const [catalogo, setCatalogo] = useState<ExercicioSimples[] | null>(null);
  const [grupo, setGrupo] = useState('Todos');
  const [rodando, setRodando] = useState<string | null>(null);
  const [restam, setRestam] = useState(SEGUNDOS);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('exercises')
        .select('id, name, muscle_group')
        .order('name')
        .limit(1000);
      setCatalogo(data ?? []);
    })();
  }, []);

  // Um cronômetro só, do exercício que está rodando. Zera ao chegar no fim.
  useEffect(() => {
    if (!rodando) return;
    if (restam <= 0) { setRodando(null); setRestam(SEGUNDOS); return; }
    const t = setTimeout(() => setRestam(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [rodando, restam]);

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

      {lista.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-foreground-muted">
          Nenhum alongamento cadastrado para essa região ainda.
        </CardContent></Card>
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map(ex => {
            const ativo = rodando === ex.name;
            return (
              <Card key={ex.id ?? ex.name} className={ativo ? 'border-primary/50' : ''}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{ex.name}</p>
                    {ex.muscle_group && (
                      <p className="text-[11px] text-foreground-muted mt-0.5">{ex.muscle_group}</p>
                    )}
                  </div>

                  {ativo ? (
                    <div className="flex items-center gap-2 flex-none">
                      <span className="font-mono font-bold text-primary tabular-nums text-lg w-10 text-right">{restam}s</span>
                      <button
                        onClick={() => { setRodando(null); setRestam(SEGUNDOS); }}
                        aria-label="Parar"
                        className="w-9 h-9 rounded-xl bg-surface-light grid place-items-center text-foreground-muted hover:text-foreground"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setRodando(ex.name); setRestam(SEGUNDOS); }}
                      aria-label={`Cronometrar ${ex.name}`}
                      className="w-9 h-9 rounded-xl bg-surface-light grid place-items-center text-primary hover:bg-primary/20 transition-colors flex-none"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-foreground-muted mt-5 flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 flex-none" />
        {lista.length} {lista.length === 1 ? 'alongamento' : 'alongamentos'} · toque no play para cronometrar
      </p>
    </div>
  );
}
