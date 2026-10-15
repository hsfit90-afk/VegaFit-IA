"use client";

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ImageOff } from 'lucide-react';

/**
 * Editor do aquecimento e do alongamento de um dia de treino, no montador.
 *
 * POR QUE EXISTE
 *
 * O aquecimento era montado só pelo servidor: três exercícios de mobilidade escolhidos pelos
 * grupos musculares do dia, sem o profissional poder opinar. Para o Treino do Personal isso é
 * limitação real — um aluno com ombro ruim precisa de uma mobilidade específica que a regra
 * automática não tem como saber.
 *
 * O alongamento nem existia na sessão. A tela livre continua livre para todo aluno; aqui é
 * para quem pagou por prescrição.
 *
 * UM COMPONENTE PARA OS DOIS porque são a mesma coisa do ponto de vista do dado: uma lista de
 * exercícios por TEMPO, não por série. O que muda é quando acontece e o filtro do catálogo.
 *
 * COMEÇA RECOLHIDO. Na maioria dos dias o automático serve, e abrir as duas listas em cada um
 * dos cinco dias transformaria a tela num rolo.
 */

export interface ItemDePreparo {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  segundos: number;
}

export function EditorDePreparo({
  titulo,
  ajuda,
  itens,
  catalogo,
  listaId,
  onMudar,
  classesDaMoldura,
}: {
  titulo: string;
  ajuda: string;
  /** `undefined` = o servidor preenche sozinho. Array (mesmo vazio) = o profissional decidiu. */
  itens: ItemDePreparo[] | undefined;
  catalogo: { id: string; name: string; muscle_group: string; media_url: string | null }[];
  /** id do <datalist> com os exercícios elegíveis para esta lista. */
  listaId: string;
  onMudar: (novos: ItemDePreparo[] | undefined) => void;
  /**
   * As classes vêm PRONTAS de quem chama, não montadas aqui por concatenação.
   *
   * `border-${cor}/25` não funciona: o Tailwind lê o código como texto para gerar o CSS, e
   * uma classe que só existe depois de executar não é encontrada. Mesma armadilha documentada
   * em lib/layout.ts.
   */
  classesDaMoldura: string;
}) {
  const [aberto, setAberto] = useState(false);
  const lista = itens ?? [];
  const automatico = itens === undefined;

  const midiaDe = (id: string) => catalogo.find(c => c.id === id)?.media_url ?? null;

  const acrescentar = (nome: string) => {
    const achado = catalogo.find(c => c.name === nome);
    if (!achado) return;
    onMudar([...lista, {
      exerciseId: achado.id,
      name: achado.name,
      muscleGroup: achado.muscle_group || '',
      segundos: 40,
    }]);
  };

  return (
    <div className={`mt-3 rounded-xl border overflow-hidden ${classesDaMoldura}`}>
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        aria-expanded={aberto}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left"
      >
        <span className="text-xs font-semibold flex-1">
          {titulo}
          <span className="ml-2 font-normal text-foreground-muted">
            {automatico ? 'automático' : `${lista.length} escolhido${lista.length === 1 ? '' : 's'}`}
          </span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-foreground-muted transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="px-3.5 pb-3.5">
          <p className="text-[11px] text-foreground-muted mb-2.5 leading-relaxed">{ajuda}</p>

          {automatico ? (
            <button
              type="button"
              onClick={() => onMudar([])}
              className="text-xs font-semibold text-primary hover:text-primary-hover"
            >
              Escolher à mão
            </button>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 mb-2">
                {lista.map((item, i) => (
                  <div key={`${item.exerciseId}-${i}`} className="flex items-center gap-2 bg-surface rounded-lg p-1.5 border border-border">
                    <span className="w-10 h-10 rounded bg-black/40 grid place-items-center overflow-hidden flex-none">
                      {midiaDe(item.exerciseId)
                        ? <img src={midiaDe(item.exerciseId)!} alt="" className="w-full h-full object-contain opacity-90" />
                        : <ImageOff className="w-3 h-3 text-foreground-muted/40" />}
                    </span>
                    <span className="flex-1 min-w-0 text-xs truncate">{item.name}</span>
                    <input
                      type="number" min={10} max={300} step={10} value={item.segundos}
                      onChange={e => onMudar(lista.map((x, j) =>
                        j === i ? { ...x, segundos: Number(e.target.value) } : x))}
                      aria-label={`Segundos de ${item.name}`}
                      className="w-14 bg-black/30 border border-border rounded px-1.5 py-1 text-xs text-center tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => onMudar(lista.filter((_, j) => j !== i))}
                      aria-label={`Remover ${item.name}`}
                      className="p-1 text-foreground-muted hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Plus className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
                  <input
                    list={listaId}
                    placeholder="Acrescentar do catálogo…"
                    onChange={e => { acrescentar(e.target.value); e.target.value = ''; }}
                    className="w-full bg-black/30 border border-border rounded-lg py-1.5 pl-7 pr-2 text-xs focus:outline-none focus:border-primary/50"
                  />
                </div>
                {/* Voltar ao automático é importante: quem experimentou e se arrependeu não
                    deve precisar readicionar os três na mão. */}
                <button
                  type="button"
                  onClick={() => onMudar(undefined)}
                  className="text-[11px] text-foreground-muted hover:text-foreground whitespace-nowrap"
                >
                  Voltar ao automático
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
