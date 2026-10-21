"use client";

import { useEffect, useState } from 'react';
import { useSomenteMaster } from '@/components/useSomenteMaster';
import { useToast } from '@/components/ui/Toast';
import { Card, CardContent } from '@/components/ui/Card';
import { VisualizadorDeMidia } from '@/components/workout/VisualizadorDeMidia';
import { EQUIPAMENTOS_CASA } from '@/lib/equipamentoCasa';
import { Loader2, Check, ImageOff, Maximize2, AlertTriangle } from 'lucide-react';
import { PADDING_TELA, LARGURA_CONTEUDO, RODAPE_SEGURO } from '@/lib/layout';
import { traduzirErro } from '@/utils/mensagensDeErro';

/**
 * Revisão do equipamento de cada exercício.
 *
 * POR QUE ESTA TELA EXISTE
 *
 * O filtro de equipamento lia o NOME do exercício e adivinhava. Funcionava na maioria e
 * falhava em silêncio: "Levantamento Terra" não cita barra, "Puxada para o Rosto" não cita
 * polia, e os dois chegaram a alunos que treinam em casa. Cada vazamento foi descoberto por
 * alguém recebendo exercício que não tinha como fazer.
 *
 * O catálogo foi classificado uma vez pela IA, offline. Aqui a sugestão vira dado conferido —
 * e, a partir daí, o filtro lê o que o profissional confirmou em vez de deduzir.
 *
 * COMEÇA PELAS DIVERGÊNCIAS. São 882 exercícios, e ninguém revisa 882. A regra por nome
 * acerta 97%, então onde ela e a IA discordam está concentrado o que importa: 24 casos.
 */

interface ExercicioParaRevisar {
  id: string;
  name: string;
  muscle_group: string | null;
  media_url: string | null;
  equipamento_necessario: string[] | null;
  equipamento_origem: string | null;
  contexto: string | null;
  contextoEfetivo: 'casa' | 'academia' | 'ambos';
  divergente: boolean;
  naoClassificado: boolean;
  iaDizQueCabeEmCasa: boolean;
  nomeDizQueCabeEmCasa: boolean;
}

const OPCOES = [
  ...EQUIPAMENTOS_CASA.map(e => ({ id: e.id, rotulo: e.rotulo })),
  { id: 'maquina', rotulo: 'Máquina de academia' },
];

export default function RevisarEquipamentos() {
  const ehMaster = useSomenteMaster();
  const toast = useToast();

  const [lista, setLista] = useState<ExercicioParaRevisar[] | null>(null);
  const [resumo, setResumo] = useState<{ total: number; divergentes: number; naoClassificados: number; revisados: number } | null>(null);
  const [filtro, setFiltro] = useState<'novos' | 'divergentes' | 'pendentes' | 'todos' | 'revisados'>('divergentes');
  const [salvando, setSalvando] = useState<string | null>(null);
  const [ampliado, setAmpliado] = useState<ExercicioParaRevisar | null>(null);

  useEffect(() => {
    (async () => {
      setLista(null);
      const r = await fetch(`/api/admin/equipamentos?filtro=${filtro}`);
      if (!r.ok) { toast.erro('Não consegui carregar o catálogo.'); setLista([]); return; }
      const d = await r.json();
      setLista(d.exercicios ?? []);
      setResumo(d.resumo ?? null);
    })();
  }, [filtro]);

  const alternar = async (ex: ExercicioParaRevisar, idEquip: string) => {
    const atual = ex.equipamento_necessario ?? [];
    const novo = atual.includes(idEquip)
      ? atual.filter(x => x !== idEquip)
      : [...atual, idEquip];
    await salvar(ex, novo);
  };

  /**
   * OS DOIS BOTÕES GRANDES: casa ou academia, num toque.
   *
   * Pedido do profissional, e ele está certo sobre o motivo — oito caixas por exercício é
   * lento para 882. A maioria se resolve na pergunta binária.
   *
   * ACADEMIA é simples: vira ['maquina'] e sai de todo treino de casa.
   *
   * AMBOS precisa de cuidado. "Cabe nos dois" não diz DE QUE precisa, e sem isso quem não
   * tem nada receberia rosca com halteres. Então o botão PRESERVA o equipamento que já estava
   * marcado (a sugestão da IA, quase sempre certa) e só tira 'maquina'. Se a sugestão for
   * vazia, fica peso corporal mesmo.
   *
   * O rótulo é "Ambos" e não "Casa" porque é o que ele de fato significa: não existe
   * exercício que caiba em casa e não caiba na academia. Chamar de "Casa" fazia parecer que
   * faltava um terceiro estado.
   *
   * O refinamento continua ali embaixo, nas caixas, para os casos em que o balde grosso não
   * basta — mas deixou de ser obrigatório.
   */
  /**
   * Os tres contextos, num toque cada.
   *
   * ACADEMIA marca o contexto E poe 'maquina' no equipamento: exercicio de academia costuma
   * exigir aparelho, e as duas coisas andam juntas na pratica.
   *
   * CASA e AMBOS preservam o equipamento ja marcado e so tiram 'maquina' -- "serve em casa"
   * nao diz DE QUE precisa, e sem isso quem nao tem nada receberia rosca com halteres.
   *
   * A diferenca entre os dois esta so no CONTEXTO: "casa" some do treino de quem esta na
   * academia, "ambos" aparece nos dois. Pelo equipamento eles sao identicos.
   */
  const semMaquina = (ex: ExercicioParaRevisar) =>
    (ex.equipamento_necessario ?? []).filter(x => x !== 'maquina');

  const marcarAcademia = (ex: ExercicioParaRevisar) => salvar(ex, ['maquina'], 'academia');
  const marcarCasa = (ex: ExercicioParaRevisar) => salvar(ex, semMaquina(ex), 'casa');
  const marcarAmbos = (ex: ExercicioParaRevisar) => salvar(ex, semMaquina(ex), 'ambos');

  const salvar = async (ex: ExercicioParaRevisar, equipamento: string[], contexto?: string) => {
    setSalvando(ex.id);
    try {
      const r = await fetch('/api/admin/equipamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ex.id, equipamento, contexto }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Não consegui salvar.');
      /**
       * O EXERCÍCIO SAI DA LISTA ao ser confirmado — nas abas de trabalho pendente.
       *
       * Antes ele ficava, e a tela deixava de responder a pergunta "o que falta?": o
       * profissional passava pelos mesmos exercícios de novo sem saber quais já tinha olhado.
       *
       * Em "Já confirmados" e "Catálogo inteiro" ele FICA, porque ali o trabalho é consultar
       * e corrigir, não esvaziar fila. Sumir seria perder o que ele acabou de ajustar.
       */
      const abaDeTrabalho = filtro === 'novos' || filtro === 'divergentes' || filtro === 'pendentes';

      if (abaDeTrabalho) {
        setLista(l => (l ?? []).filter(x => x.id !== ex.id));
        setResumo(r => r && {
          ...r,
          revisados: r.revisados + (ex.equipamento_origem === 'profissional' ? 0 : 1),
          divergentes: Math.max(0, r.divergentes - (ex.divergente ? 1 : 0)),
          naoClassificados: Math.max(0, r.naoClassificados - (ex.naoClassificado ? 1 : 0)),
        });
        toast.sucesso(`${ex.name}: ${d.contexto ?? 'salvo'}.`);
      } else {
        setLista(l => (l ?? []).map(x => x.id === ex.id
          ? {
              ...x,
              equipamento_necessario: d.equipamento,
              equipamento_origem: 'profissional',
              contexto: d.contexto ?? x.contexto,
              contextoEfetivo: (d.contexto ?? x.contextoEfetivo) as 'casa' | 'academia' | 'ambos',
            }
          : x));
      }
    } catch (e) {
      toast.erro(traduzirErro(e, e instanceof Error ? e.message : 'Não consegui salvar.'));
    } finally {
      setSalvando(null);
    }
  };

  if (!ehMaster) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className={`${PADDING_TELA} ${LARGURA_CONTEUDO} mx-auto animate-fade-in ${RODAPE_SEGURO}`}>
      <VisualizadorDeMidia
        midia={ampliado?.media_url ?? null}
        titulo={ampliado?.name ?? ''}
        subtitulo={ampliado?.muscle_group}
        onFechar={() => setAmpliado(null)}
      />

      <header className="mb-5">
        <h1 className="text-3xl md:text-4xl font-outfit font-bold mb-2">Equipamento por exercício</h1>
        <p className="text-foreground-muted text-sm leading-relaxed max-w-prose">
          Marque de que o exercício precisa. <strong>Nada marcado</strong> significa peso do
          corpo — faz em qualquer lugar. O que você confirmar aqui passa a valer no lugar do
          palpite pelo nome.
        </p>
      </header>

      {resumo && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          {[
            { n: resumo.total, r: 'no catálogo' },
            { n: resumo.divergentes, r: 'divergentes', destaque: true },
            { n: resumo.naoClassificados, r: 'sem classificação' },
            { n: resumo.revisados, r: 'você confirmou' },
          ].map(c => (
            <div key={c.r} className={`rounded-xl border p-3 ${c.destaque ? 'border-warning/40 bg-warning/5' : 'border-border bg-surface'}`}>
              <p className="text-2xl font-bold tabular-nums">{c.n}</p>
              <p className="text-[11px] text-foreground-muted">{c.r}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-5">
        {([
          ['novos', 'GIF novo', resumo?.naoClassificados],
          ['divergentes', 'Precisam do seu olho', resumo?.divergentes],
          ['pendentes', 'Falta confirmar', resumo ? resumo.total - resumo.revisados : undefined],
          ['revisados', 'Já confirmados', resumo?.revisados],
          ['todos', 'Catálogo inteiro', resumo?.total],
        ] as const).map(([v, rotulo, quantos]) => (
          <button
            key={v}
            onClick={() => setFiltro(v)}
            className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
              filtro === v ? 'bg-primary text-primary-foreground' : 'bg-surface text-foreground-muted hover:bg-surface-hover'
            }`}
          >
            {rotulo}
            {typeof quantos === 'number' && (
              <span className={`ml-1.5 tabular-nums ${filtro === v ? 'opacity-70' : 'opacity-50'}`}>
                {quantos}
              </span>
            )}
          </button>
        ))}
      </div>

      {lista === null ? (
        <div className="min-h-[30vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : lista.length === 0 ? (
        // A fila vazia é o resultado do trabalho, e vale dizer o que ela significa — cada aba
        // esvazia por um motivo diferente.
        <Card><CardContent className="p-6 text-sm text-foreground-muted flex items-start gap-3">
          <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <span>
            {filtro === 'novos'
              ? 'Nenhum GIF novo esperando. Quando você subir exercício novo, ele aparece aqui.'
              : filtro === 'divergentes'
              ? 'Acabaram as divergências. O que sobrou é onde a classificação e a regra por nome já concordavam.'
              : filtro === 'pendentes'
              ? 'Catálogo inteiro revisado por você. Daqui em diante, só o que entrar de novo.'
              : filtro === 'revisados'
              ? 'Você ainda não confirmou nenhum. Toque em Casa, Ambos ou Academia em qualquer exercício.'
              : 'Nada por aqui.'}
          </span>
        </CardContent></Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {lista.map(ex => {
            const ids = ex.equipamento_necessario ?? [];
            const confirmado = ex.equipamento_origem === 'profissional';
            return (
              <Card key={ex.id} className={confirmado ? 'border-primary/30' : ''}>
                <CardContent className="p-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => ex.media_url && setAmpliado(ex)}
                    disabled={!ex.media_url}
                    aria-label={ex.media_url ? `Ver ${ex.name} ampliado` : undefined}
                    className="w-24 h-24 rounded-xl bg-black/40 grid place-items-center overflow-hidden flex-none relative"
                  >
                    {ex.media_url ? (
                      <>
                        {ex.media_url.endsWith('.mp4')
                          ? <video src={ex.media_url} autoPlay loop muted playsInline className="w-full h-full object-contain opacity-90" />
                          : <img src={ex.media_url} alt="" className="w-full h-full object-contain opacity-90" />}
                        <span className="absolute bottom-1 right-1 w-5 h-5 rounded bg-black/60 grid place-items-center">
                          <Maximize2 className="w-2.5 h-2.5 text-white/80" />
                        </span>
                      </>
                    ) : <ImageOff className="w-5 h-5 text-foreground-muted/40" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <p className="text-sm font-medium leading-tight flex-1">{ex.name}</p>
                      {confirmado && <Check className="w-4 h-4 text-primary shrink-0" />}
                      {salvando === ex.id && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
                    </div>
                    <p className="text-[11px] text-foreground-muted mt-0.5">{ex.muscle_group || '—'}</p>

                    {/* Dizer DE QUE LADO está a discordância poupa o profissional de
                        reconstruir o raciocínio em cada um dos 24. */}
                    {ex.divergente && !confirmado && (
                      <p className="text-[11px] text-warning mt-1.5 flex items-start gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                        {ex.iaDizQueCabeEmCasa
                          ? 'A regra antiga cortava este; a classificação diz que cabe em casa.'
                          : 'A regra antiga deixava este passar; a classificação diz que é de academia.'}
                      </p>
                    )}

                    {/* OS TRÊS CONTEXTOS.
                        Casa e Ambos são idênticos pelo EQUIPAMENTO — a diferença é onde o
                        exercício aparece. "Casa" some do treino de quem está na academia: é
                        para o que o profissional só prescreve em casa, porque lá existe
                        coisa melhor. */}
                    <div className="grid grid-cols-3 gap-2 mt-2.5">
                      {([
                        ['casa', 'Casa', marcarCasa, false],
                        ['ambos', 'Ambos', marcarAmbos, false],
                        ['academia', 'Academia', marcarAcademia, true],
                      ] as const).map(([valor, rotulo, acao, vermelho]) => {
                        const ativo = ex.contextoEfetivo === valor;
                        return (
                          <button
                            key={valor}
                            onClick={() => acao(ex)}
                            disabled={salvando === ex.id}
                            className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-40 ${
                              ativo && confirmado
                                ? (vermelho
                                    ? 'bg-destructive/20 text-destructive border-destructive/50'
                                    : 'bg-primary/20 text-primary border-primary/50')
                                : ativo
                                ? 'bg-surface-light border-white/25 text-foreground'
                                : 'bg-surface-light border-white/10 text-foreground-muted hover:text-foreground'
                            }`}
                          >
                            {rotulo}
                          </button>
                        );
                      })}
                    </div>

                    {/* O que esta aceso sem confirmacao e palpite. Dizer isso evita achar que
                        ja revisou o que so foi deduzido do equipamento. */}
                    <p className="text-[11px] text-foreground-muted mt-1.5">
                      {!confirmado && 'Sugerido — toque para confirmar. '}
                      {!ids.includes('maquina') && (ids.length > 0
                        ? `Precisa de: ${ids.join(', ')}.`
                        : 'Não precisa de nada.')}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {OPCOES.map(o => {
                        const ativo = ids.includes(o.id);
                        return (
                          <button
                            key={o.id}
                            onClick={() => alternar(ex, o.id)}
                            disabled={salvando === ex.id}
                            className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-40 ${
                              ativo
                                ? (o.id === 'maquina'
                                    ? 'bg-destructive/20 text-destructive border-destructive/40 font-semibold'
                                    : 'bg-primary/20 text-primary border-primary/40 font-semibold')
                                : 'bg-surface-light border-white/5 text-foreground-muted hover:text-foreground'
                            }`}
                          >
                            {o.rotulo}
                          </button>
                        );
                      })}
                    </div>

                    {ids.length === 0 && (
                      <p className="text-[11px] text-foreground-muted mt-1.5">
                        Nada marcado: peso do corpo, faz em qualquer lugar.
                      </p>
                    )}
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
