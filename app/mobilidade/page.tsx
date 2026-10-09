"use client";

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Waves } from 'lucide-react';
import { ListaComCronometro, type ItemDaLista } from '@/components/workout/ListaComCronometro';
import { classificarTipo } from '@/lib/preparoFinalizacao';
import { PADDING_TELA, LARGURA_FOCO, RODAPE_SEGURO } from '@/lib/layout';

/**
 * Mobilidade como sessão avulsa.
 *
 * O bloco de aquecimento dentro do treino CONTINUA existindo — é a prescrição: mobilidade
 * prepara a articulação que vai ser carregada naquele dia. Esta tela é para o outro caso: a
 * pessoa quer soltar o corpo num dia de descanso, ou de manhã, sem abrir um treino.
 *
 * Não é duplicação. O bloco é "o aquecimento de hoje"; esta tela é "uma sessão de mobilidade".
 */

const SEGUNDOS = 40;

export default function Mobilidade() {
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

  const todos = useMemo(
    () => (catalogo ?? []).filter(e => classificarTipo(e.name, e.muscle_group) === 'mobilidade'),
    [catalogo]
  );

  // Só os grupos que de fato têm mobilidade cadastrada: um filtro que devolve lista vazia é
  // pior que não existir.
  const grupos = useMemo(
    () => ['Todos', ...[...new Set(todos.map(e => e.muscle_group || 'Outros'))].sort()],
    [todos]
  );

  const lista = grupo === 'Todos' ? todos : todos.filter(e => (e.muscle_group || 'Outros') === grupo);

  if (!catalogo) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className={`${PADDING_TELA} ${LARGURA_FOCO} mx-auto animate-fade-in ${RODAPE_SEGURO}`}>
      <header className="mb-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center shadow-lg">
            <Waves className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-outfit font-bold leading-none">Mobilidade</h1>
            <p className="text-sm text-foreground-muted mt-1">Solte o corpo, sem carga</p>
          </div>
        </div>
        <p className="text-foreground-muted text-sm leading-relaxed max-w-prose">
          Pode ser em dia de descanso ou pela manhã. Antes do treino, você já recebe a
          mobilidade do dia dentro da própria sessão.
        </p>
      </header>

      {grupos.length > 2 && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
          {grupos.map(g => (
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
      )}

      <ListaComCronometro
        itens={lista}
        segundos={SEGUNDOS}
        vazio="Nenhum exercício de mobilidade cadastrado para essa região ainda."
      />

      <p className="text-xs text-foreground-muted mt-5">
        {lista.length} {lista.length === 1 ? 'movimento' : 'movimentos'} · {SEGUNDOS} segundos cada
      </p>
    </div>
  );
}
