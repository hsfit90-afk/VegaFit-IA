"use client";

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ImageOff, Shuffle } from 'lucide-react';

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
 *
 * O AUTOMÁTICO DEIXOU DE SER UMA CAIXA-PRETA (19/10/2026)
 *
 * Antes, "automático" era só a palavra: o profissional salvava sem nunca ver quais três
 * exercícios o aluno ia receber. Pior, nessa época a escolha casava o grupo muscular cru e
 * entregava mobilidade de TORNOZELO num dia de supino — defeito que durou porque não havia
 * onde olhar. Agora a sugestão aparece na tela mesmo no modo automático, com a articulação de
 * cada exercício ao lado, e um botão para sortear outra.
 */

export interface ItemDePreparo {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  /** Ausente no abdominal, que é prescrito por série e repetição, não por tempo. */
  segundos?: number;
}

export function EditorDePreparo({
  titulo,
  ajuda,
  itens,
  catalogo,
  listaId,
  onMudar,
  classesDaMoldura,
  sugestao,
  onRoletar,
  legendaDe,
  semSegundos,
  rodape,
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
   * O que o aluno receberia AGORA se este bloco ficasse no automático.
   *
   * Calculado por quem chama, com a mesma função que o servidor usa — e é esse "mesma função"
   * que faz a prévia valer alguma coisa. Uma prévia calculada por outra regra seria pior que
   * nenhuma: mostraria três exercícios e entregaria outros três.
   */
  sugestao?: ItemDePreparo[];
  /** Sortear outra sugestão. Ausente desliga o botão (o bloco não tem de onde sortear). */
  onRoletar?: () => void;
  /** Texto curto ao lado do nome, como a articulação que o exercício prepara. */
  legendaDe?: (item: ItemDePreparo) => string | null;
  /** Abdominal é por série e repetição; o campo de segundos não faz sentido nele. */
  semSegundos?: boolean;
  /** Linha final, para o bloco explicar de onde vêm série e repetição. */
  rodape?: string;
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
  /** O que está na tela: a escolha do profissional, ou a sugestão do automático. */
  const visivel = automatico ? (sugestao ?? []) : lista;

  const midiaDe = (id: string) => catalogo.find(c => c.id === id)?.media_url ?? null;

  const acrescentar = (nome: string) => {
    const achado = catalogo.find(c => c.name === nome);
    if (!achado) return;
    onMudar([...lista, {
      exerciseId: achado.id,
      name: achado.name,
      muscleGroup: achado.muscle_group || '',
      ...(semSegundos ? {} : { segundos: 40 }),
    }]);
  };

  /**
   * Assumir a sugestão como escolha.
   *
   * O profissional que mexe em qualquer coisa estando no automático está decidindo — e a
   * decisão precisa virar lista explícita, senão o servidor remonta por conta própria no
   * salvamento e joga fora o que ele acabou de ajustar.
   */
  const assumirSugestao = (): ItemDePreparo[] => {
    const assumida = sugestao ?? [];
    onMudar(assumida);
    return assumida;
  };

  return (
    <div className={`mt-3 rounded-xl border overflow-hidden ${classesDaMoldura}`}>
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        aria-expanded={aberto}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left"
      >
        <span className="text-xs font-semibold flex-1 min-w-0">
          {titulo}
          <span className="ml-2 font-normal text-foreground-muted">
            {automatico ? 'automático' : `${lista.length} escolhido${lista.length === 1 ? '' : 's'}`}
          </span>
          {/* OS NOMES NO CABEÇALHO, para não precisar abrir cada dia só para conferir.
              Era a queixa: "não consigo ver qual é a mobilidade que está ativa". */}
          {!aberto && visivel.length > 0 && (
            <span className="block font-normal text-micro text-foreground-muted truncate mt-0.5">
              {visivel.map(i => i.name).join(' · ')}
            </span>
          )}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-foreground-muted transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="px-3.5 pb-3.5">
          <p className="text-micro text-foreground-muted mb-2.5 leading-relaxed">{ajuda}</p>

          {/* A LISTA APARECE NOS DOIS MODOS.
              No automático ela é a sugestão e não tem controles por item: mexer em alguma
              coisa é decidir, e decidir tem um passo próprio ("Escolher à mão"), que já parte
              desta mesma lista. Sem esse passo, o profissional ajustaria segundos achando que
              ficou guardado, e o servidor remontaria tudo no salvamento. */}
          {visivel.length === 0 ? (
            <p className="text-micro text-warning mb-2.5">
              Nenhum exercício do catálogo cabe no que este aluno tem. O bloco vai chegar vazio
              para ele.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5 mb-2">
              {visivel.map((item, i) => {
                const legenda = legendaDe?.(item) ?? null;
                return (
                  <div key={`${item.exerciseId}-${i}`} className="flex items-center gap-2 bg-surface rounded-lg p-1.5 border border-border">
                    <span className="w-10 h-10 rounded bg-black/40 grid place-items-center overflow-hidden flex-none">
                      {midiaDe(item.exerciseId)
                        ? <img src={midiaDe(item.exerciseId)!} alt="" className="w-full h-full object-contain opacity-90" />
                        : <ImageOff className="w-3 h-3 text-foreground-muted/40" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs truncate">{item.name}</span>
                      {legenda && (
                        <span className="block text-nano text-foreground-muted truncate">{legenda}</span>
                      )}
                    </span>

                    {!automatico && !semSegundos && (
                      <input
                        type="number" min={10} max={300} step={10} value={item.segundos ?? 40}
                        onChange={e => onMudar(lista.map((x, j) =>
                          j === i ? { ...x, segundos: Number(e.target.value) } : x))}
                        aria-label={`Segundos de ${item.name}`}
                        className="w-14 bg-black/30 border border-border rounded px-1.5 py-1 text-xs text-center tabular-nums"
                      />
                    )}
                    {!automatico && (
                      <button
                        type="button"
                        onClick={() => onMudar(lista.filter((_, j) => j !== i))}
                        aria-label={`Remover ${item.name}`}
                        className="p-1 text-foreground-muted hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!automatico && (
            <div className="relative mb-2">
              <Plus className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
              <input
                list={listaId}
                placeholder="Acrescentar do catálogo…"
                onChange={e => { acrescentar(e.target.value); e.target.value = ''; }}
                className="w-full bg-black/30 border border-border rounded-lg py-1.5 pl-7 pr-2 text-xs focus:outline-none focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {onRoletar && (
              <button
                type="button"
                onClick={onRoletar}
                className="inline-flex items-center gap-1.5 text-micro font-semibold px-2.5 py-1.5 rounded-lg border border-white/10 bg-surface-light text-foreground-muted hover:text-primary hover:border-primary/40 transition-colors"
              >
                <Shuffle className="w-3 h-3" /> Roletar
              </button>
            )}

            {automatico ? (
              <button
                type="button"
                onClick={assumirSugestao}
                className="text-micro font-semibold text-primary hover:text-primary-hover"
              >
                Escolher à mão
              </button>
            ) : (
              /* Voltar ao automático é importante: quem experimentou e se arrependeu não
                 deve precisar readicionar os três na mão. */
              <button
                type="button"
                onClick={() => onMudar(undefined)}
                className="text-micro text-foreground-muted hover:text-foreground whitespace-nowrap"
              >
                Voltar ao automático
              </button>
            )}
          </div>

          {rodape && <p className="text-nano text-foreground-muted mt-2">{rodape}</p>}
        </div>
      )}
    </div>
  );
}
