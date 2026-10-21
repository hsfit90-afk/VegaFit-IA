"use client";

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Waves } from 'lucide-react';
import { ListaComCronometro, type ItemDaLista } from '@/components/workout/ListaComCronometro';
import { classificarTipo, selecionarMobilidade, articulacoesDosGrupos } from '@/lib/preparoFinalizacao';
import { useSessaoDoDia } from '@/components/useSessaoDoDia';
import { useAppContext } from '@/app/context/AppContext';
import { filtrarParaCasa } from '@/lib/equipamentoCasa';
import { treinaEmCasa, mapAnamneseLocationToEquipment } from '@/lib/trainingLocation';
import { PADDING_TELA, LARGURA_FOCO, RODAPE_SEGURO } from '@/lib/layout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

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
  const sessao = useSessaoDoDia();
  const { profile } = useAppContext();

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('exercises')
        .select('id, name, muscle_group, media_url, equipamento_necessario, contexto')
        .order('name')
        .limit(1000);
      setCatalogo((data ?? []).map(e => ({
        id: e.id, name: e.name, muscle_group: e.muscle_group, mediaUrl: e.media_url,
        equipamento_necessario: e.equipamento_necessario,
        contexto: e.contexto,
      })));
    })();
  }, []);

  /**
   * Quem treina em casa não vê mobilidade que exige aparelho.
   *
   * Dez dos 24 exercícios de mobilidade pedem rolo de espuma. Mostrá-los a quem declarou não
   * ter nada é oferecer o que a pessoa não pode fazer — o mesmo erro que o aquecimento
   * cometia dentro do treino, corrigido em 12/10/2026.
   */
  const todos = useMemo(() => {
    const mob = (catalogo ?? []).filter(e => classificarTipo(e.name, e.muscle_group) === 'mobilidade');
    // Normaliza antes: perfil antigo gravou "Casa com equipamentos", nao "Em casa".
    return treinaEmCasa(mapAnamneseLocationToEquipment(profile?.trainingLocation))
      ? filtrarParaCasa(mob, profile?.equipamentosCasa)
      : mob;
  }, [catalogo, profile?.trainingLocation, profile?.equipamentosCasa]);

  // Só os grupos que de fato têm mobilidade cadastrada: um filtro que devolve lista vazia é
  // pior que não existir.
  const grupos = useMemo(
    () => ['Todos', ...[...new Set(todos.map(e => e.muscle_group || 'Outros'))].sort()],
    [todos]
  );

  /**
   * O bloco do dia, no topo.
   *
   * Prescrição de 11/10/2026: a tela abre dizendo quais ARTICULAÇÕES o treino de hoje vai
   * usar, e já com a mobilidade delas — em vez de uma lista de 20 movimentos em que o aluno
   * tem que adivinhar o que serve. A lista completa continua logo abaixo, porque soltar o
   * corpo num dia de descanso também é uso legítimo desta tela.
   */
  const doDia = useMemo(
    () => (sessao ? selecionarMobilidade(todos, sessao.grupos, 4) as ItemDaLista[] : []),
    [todos, sessao]
  );
  const articulacoes = useMemo(
    () => (sessao ? articulacoesDosGrupos(sessao.grupos) : []),
    [sessao]
  );

  const lista = grupo === 'Todos' ? todos : todos.filter(e => (e.muscle_group || 'Outros') === grupo);

  if (!catalogo) {
    return <LoadingSpinner tela tamanho="lg" />;
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
          Antes do treino, para preparar as articulações que vão receber carga. Também vale
          em dia de descanso ou pela manhã.
        </p>
      </header>

      {doDia.length > 0 && sessao && (
        <section className="mb-7">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 mb-3">
            <p className="text-xs uppercase tracking-wider font-semibold text-primary mb-1.5">
              Antes do seu treino de hoje
            </p>
            <p className="text-sm font-bold mb-1">{sessao.nome}</p>
            {articulacoes.length > 0 && (
              <p className="text-sm text-foreground-muted">
                Articulações que vão trabalhar:{' '}
                <span className="text-foreground">{articulacoes.join(' · ')}</span>
              </p>
            )}
          </div>

          <ListaComCronometro
            itens={doDia}
            segundos={SEGUNDOS}
            vazio="Sem mobilidade cadastrada para os grupos de hoje."
          />
        </section>
      )}

      {doDia.length > 0 && (
        <h2 className="text-lg font-outfit font-bold mb-3">Catálogo completo</h2>
      )}

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
