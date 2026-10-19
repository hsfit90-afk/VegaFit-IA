"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useSomenteMaster } from '@/components/useSomenteMaster';
import { useToast } from '@/components/ui/Toast';
import { Card, CardContent } from '@/components/ui/Card';
import { VisualizadorDeMidia } from '@/components/workout/VisualizadorDeMidia';
import { Loader2, ArrowLeft, Eye, ImageOff, Maximize2, Waves, Timer, AlertTriangle, Check, Trash2, StretchHorizontal, Flame, Pencil } from 'lucide-react';
import { PADDING_TELA, LARGURA_FOCO, RODAPE_SEGURO } from '@/lib/layout';
import { escolherSessao, minutosDaSessao } from '@/lib/proximoTreino';
import { temAbdominalNoDia } from '@/lib/protocolo';

/**
 * O treino do aluno, como ele vai ver.
 *
 * POR QUE EXISTE
 *
 * O profissional montava o Treino do Personal e entregava sem nunca ter visto o resultado do
 * outro lado. Ele não tem a senha do aluno — e não deve ter —, então a única forma de
 * conferir era perguntar. Entregar um produto de R$ 147 às cegas é como mandar um bolo pelo
 * correio sem olhar se ele assou.
 *
 * É LEITURA, não execução. Mostra o que foi prescrito: os dias, os exercícios com GIF, séries,
 * repetições, descanso e as observações. Não reproduz cronômetro, registro de carga nem
 * check-in, porque o que ele precisa conferir é a PRESCRIÇÃO, não a mecânica da tela.
 *
 * Mostra o plano ATIVO do aluno — o único que ele enxerga. Conferido em 15/10/2026: o
 * dashboard dele renderiza um card só, o do ativo, e não existe seletor de planos. Os outros
 * planos existem apenas deste lado.
 *
 * Isso torna o painel de planos aqui mais importante do que parecia: se o ativo estiver
 * desatualizado, o aluno treina errado e não tem como perceber nem corrigir sozinho.
 */

interface ExercicioPrescrito {
  id?: string;
  exerciseId?: string;
  name: string;
  muscleGroup?: string;
  sets: number;
  reps: string;
  restSeconds: number;
  tips?: string;
}

interface ItemDePreparoPrescrito {
  name: string;
  muscleGroup?: string;
  segundos?: number;
  exerciseId?: string;
}

interface SessaoPrescrita {
  id?: string;
  name: string;
  exercises?: ExercicioPrescrito[];
  warmup?: ItemDePreparoPrescrito[];
  alongamento?: ItemDePreparoPrescrito[];
  abdominal?: ItemDePreparoPrescrito[];
}

interface PlanoDoAluno {
  id: string;
  name: string;
  split: string | null;
  sessions: SessaoPrescrita[];
  equipment: string | null;
  cardio_session: { name: string; durationMinutes: number; options?: string[] } | null;
  created_at: string;
}

export default function PreviaDoAluno() {
  const ehMaster = useSomenteMaster();
  const toast = useToast();
  const params = useSearchParams();
  const alunoId = params.get('userId') ?? '';

  const [planos, setPlanos] = useState<PlanoDoAluno[] | null>(null);
  const [nomeDoAluno, setNomeDoAluno] = useState('');
  const [midias, setMidias] = useState<Map<string, string>>(new Map());
  const [ampliado, setAmpliado] = useState<{ midia: string; titulo: string; sub?: string | null } | null>(null);
  const [ativoId, setAtivoId] = useState<string | null>(null);
  const [vendo, setVendo] = useState<string | null>(null);
  const [mexendo, setMexendo] = useState(false);
  /** O estado do treino do aluno: onde o rodízio está e o que está em recuperação. */
  const [estadoDoTreino, setEstadoDoTreino] = useState<{
    indiceDaSessao: number;
    musculosEmFadiga: string[];
  }>({ indiceDaSessao: 0, musculosEmFadiga: [] });
  const [ultimoTreino, setUltimoTreino] = useState<string | null>(null);

  useEffect(() => {
    if (!alunoId) return;
    (async () => {
      const supabase = createClient();
      const [r, cat, alunoR] = await Promise.all([
        fetch(`/api/admin/plano?userId=${encodeURIComponent(alunoId)}`),
        supabase.from('exercises').select('id, name, media_url').limit(1000),
        fetch(`/api/admin/aluno?userId=${encodeURIComponent(alunoId)}`),
      ]);

      if (!r.ok) { toast.erro('Não consegui carregar os treinos deste aluno.'); setPlanos([]); return; }
      setPlanos((await r.json()).planos ?? []);

      // Mídia por id E por nome: plano antigo pode ter guardado o exercício sem id, e plano
      // montado à mão a partir de modelo também — o modelo guarda nome, não id.
      const mapa = new Map<string, string>();
      for (const e of cat.data ?? []) {
        if (!e.media_url) continue;
        mapa.set(e.id, e.media_url);
        mapa.set(e.name.trim().toLowerCase(), e.media_url);
      }
      setMidias(mapa);

      if (alunoR.ok) {
        const d = await alunoR.json();
        setNomeDoAluno(d.aluno?.nome ?? '');
        setAtivoId(d.aluno?.activePlanId ?? null);
        setUltimoTreino(d.aluno?.ultimoTreino ?? null);
        setEstadoDoTreino({
          indiceDaSessao: d.treino?.indiceDaSessao ?? 0,
          musculosEmFadiga: d.treino?.musculosEmFadiga ?? [],
        });
      }
    })();
  }, [alunoId]);

  const midiaDe = (ex: { exerciseId?: string; name: string }): string | null =>
    (ex.exerciseId ? midias.get(ex.exerciseId) : null)
    ?? midias.get(ex.name.trim().toLowerCase())
    ?? null;

  /**
   * O plano mostrado e o que o aluno realmente vai abrir: o ATIVO, nao simplesmente o mais
   * recente. Eram a mesma coisa enquanto o ativo so existia no aparelho dele; agora que o
   * banco manda, mostrar o mais recente seria mentir quando os dois divergem.
   */
  const plano = useMemo(
    () => planos?.find(p => p.id === (vendo ?? ativoId)) ?? planos?.[0] ?? null,
    [planos, vendo, ativoId]
  );

  /** O card do dashboard só vale para o plano que ele realmente abre. */
  const ehOAtivo = Boolean(plano && plano.id === (ativoId ?? planos?.[0]?.id));

  /**
   * QUAL SESSÃO ELE VAI ABRIR — pela mesma função do dashboard (lib/proximoTreino.ts).
   *
   * Recalcular aqui com uma conta própria daria um número que PARECE certo e diverge no dia
   * em que a fadiga desvia. O profissional entregaria confiando na prévia.
   */
  const escolha = useMemo(
    () => escolherSessao(plano?.sessions, estadoDoTreino.indiceDaSessao, new Set(estadoDoTreino.musculosEmFadiga)),
    [plano, estadoDoTreino]
  );
  const sessaoDeHoje = plano?.sessions?.[escolha.indice % (plano?.sessions?.length || 1)];
  const sessaoDoCiclo = plano?.sessions?.[escolha.indiceDoCiclo % (plano?.sessions?.length || 1)];

  const textoDoUltimoTreino = useMemo(() => {
    if (!ultimoTreino) return 'Nunca treinou';
    const dias = Math.floor((Date.now() - Date.parse(ultimoTreino)) / 86_400_000);
    if (!Number.isFinite(dias)) return 'Nunca treinou';
    if (dias <= 0) return 'Treinou hoje';
    if (dias === 1) return 'Treinou ontem';
    return `Treinou há ${dias} dias`;
  }, [ultimoTreino]);

  const ativar = async (planoId: string) => {
    setMexendo(true);
    try {
      const r = await fetch('/api/admin/plano', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: alunoId, planoId }),
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Nao consegui ativar.');
      setAtivoId(planoId);
      setVendo(planoId);
      toast.sucesso('Este passou a ser o treino que o aluno abre.');
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : 'Nao consegui ativar.');
    } finally {
      setMexendo(false);
    }
  };

  const apagar = async (pl: PlanoDoAluno) => {
    if (!confirm(`Apagar "${pl.name}" da conta do aluno? O historico de treinos feitos continua.`)) return;
    setMexendo(true);
    try {
      const r = await fetch(`/api/admin/plano?userId=${alunoId}&planoId=${pl.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Nao consegui apagar.');
      const sobraram = (planos ?? []).filter(x => x.id !== pl.id);
      setPlanos(sobraram);
      if (vendo === pl.id) setVendo(null);
      if (ativoId === pl.id) setAtivoId(sobraram[0]?.id ?? null);
      toast.sucesso('Plano apagado da conta.');
    } catch {
      toast.erro('Nao consegui apagar.');
    } finally {
      setMexendo(false);
    }
  };

  if (!ehMaster) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  if (!alunoId) {
    return (
      <div className={`${PADDING_TELA} ${LARGURA_FOCO} mx-auto`}>
        <p className="text-sm text-foreground-muted">
          Escolha um aluno no <Link href="/admin" className="text-primary underline">painel</Link> para ver o treino dele.
        </p>
      </div>
    );
  }

  if (planos === null) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className={`${PADDING_TELA} ${LARGURA_FOCO} mx-auto animate-fade-in ${RODAPE_SEGURO}`}>
      <VisualizadorDeMidia
        midia={ampliado?.midia ?? null}
        titulo={ampliado?.titulo ?? ''}
        subtitulo={ampliado?.sub}
        onFechar={() => setAmpliado(null)}
      />

      <Link href="/admin/montar" className="inline-flex items-center gap-1.5 text-sm text-foreground-muted hover:text-primary transition-colors mb-5">
        <ArrowLeft className="w-4 h-4" /> Voltar ao montador
      </Link>

      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider font-semibold text-primary mb-1 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Como {nomeDoAluno || 'o aluno'} vai ver
        </p>
        <h1 className="text-3xl md:text-4xl font-outfit font-bold leading-tight">
          {plano?.name ?? 'Nenhum treino na conta'}
        </h1>
        {plano && (
          <p className="text-sm text-foreground-muted mt-1">
            {plano.split || `${plano.sessions?.length ?? 0} dias`}
            {plano.equipment ? ` · ${plano.equipment}` : ''}
            {` · salvo em ${new Date(plano.created_at).toLocaleDateString('pt-BR')}`}
          </p>
        )}
      </header>

      {!plano && (
        <Card><CardContent className="p-6 text-sm text-foreground-muted">
          Este aluno ainda não tem nenhum treino salvo. Monte um no{' '}
          <Link href="/admin/montar" className="text-primary underline">montador</Link>.
        </CardContent></Card>
      )}

      {/* A TELA QUE ELE ABRE, na linguagem visual do dashboard dele.
          Mesma moldura, mesma informação, mesma ordem — e os VERBOS trocados: onde ele lê
          "INICIAR TREINO", aqui se lê "Editar este treino". Uma cópia fiel teria o botão de
          treinar sem função nenhuma, e meia tela de botão morto é pior que nenhuma tela.

          Só aparece no plano ATIVO: é o único que ele enxerga, e mostrar esta moldura num
          plano antigo diria "é isto que ele abre" sobre algo que ele não abre. */}
      {plano && ehOAtivo && (
        <div className="mb-5 bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 rounded-3xl p-5 md:p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <h2 className="text-base font-bold m-0">Plano Ativo</h2>
            </div>
            <p className="text-lg font-bold text-primary mb-3">{plano.name}</p>

            {/* O MESMO desvio por fadiga que o dashboard dele faz. Sem isto a prévia diria
                "Treino A" e ele abriria o B. */}
            {escolha.desviadoPorFadiga && (
              <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 mb-3">
                <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-orange-400 font-bold text-[11px] uppercase tracking-wider">
                    Ele vai ver &quot;Fadiga Detectada&quot;
                  </p>
                  <p className="text-orange-300/80 text-xs mt-0.5">
                    {sessaoDoCiclo?.name} usa músculo treinado nas últimas 24h. O app desvia
                    para o treino abaixo.
                  </p>
                </div>
              </div>
            )}

            <p className="text-[11px] text-foreground-muted uppercase tracking-wider font-semibold mb-1">
              Próximo treino
            </p>
            <p className="text-base font-bold mb-3">{sessaoDeHoje?.name ?? '—'}</p>

            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs text-foreground-muted bg-surface/60 px-3 py-1.5 rounded-lg border border-white/5">
                ⚡ {sessaoDeHoje?.exercises?.length ?? 0} exercícios
              </span>
              <span className="text-xs text-foreground-muted bg-surface/60 px-3 py-1.5 rounded-lg border border-white/5">
                ⏱️ ~{minutosDaSessao(sessaoDeHoje)} min
              </span>
              <span className="text-xs text-foreground-muted bg-surface/60 px-3 py-1.5 rounded-lg border border-white/5">
                {textoDoUltimoTreino}
              </span>
            </div>

            <Link
              href={`/admin/montar?userId=${alunoId}&planoId=${plano.id}`}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto text-sm font-bold bg-primary text-primary-foreground px-5 py-3 rounded-xl hover:bg-primary-hover transition-colors"
            >
              <Pencil className="w-4 h-4" /> EDITAR ESTE TREINO
            </Link>
          </div>
        </div>
      )}

      {/* O QUE MAIS APARECE NA TELA DELE.
          O dashboard oferece aeróbico, mobilidade, abdominal e alongamento ao lado do treino.
          Saber o que está sendo oferecido faz parte de conferir o que a pessoa recebe — e o
          abdominal, por cair em dias alternados, não aparece todo dia. */}
      {plano && ehOAtivo && (
        <div className="mb-5 grid sm:grid-cols-2 gap-2.5">
          {plano.cardio_session && (
            <div className="rounded-xl border border-border bg-surface p-3 flex items-center gap-3">
              <Timer className="w-4 h-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-foreground-muted">Depois do treino</p>
                <p className="text-sm font-medium truncate">{plano.cardio_session.name}</p>
              </div>
            </div>
          )}
          <div className="rounded-xl border border-border bg-surface p-3 flex items-center gap-3">
            <Waves className="w-4 h-4 text-secondary shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-foreground-muted">Antes do treino</p>
              <p className="text-sm font-medium truncate">
                {(sessaoDeHoje?.warmup?.length ?? 0) > 0
                  ? sessaoDeHoje!.warmup!.map(w => w.name).join(' · ')
                  : 'Mobilidade — nenhuma neste dia'}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3 flex items-center gap-3">
            <Flame className="w-4 h-4 text-accent shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-foreground-muted">Abdominal</p>
              <p className="text-sm font-medium truncate">
                {temAbdominalNoDia(escolha.indice)
                  ? ((sessaoDeHoje?.abdominal?.length ?? 0) > 0
                      ? sessaoDeHoje!.abdominal!.map(a => a.name).join(' · ')
                      : 'Sorteado na tela dele')
                  : 'Não cai neste dia'}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3 flex items-center gap-3">
            <StretchHorizontal className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-foreground-muted">Quando quiser</p>
              <p className="text-sm font-medium truncate">
                {(sessaoDeHoje?.alongamento?.length ?? 0) > 0
                  ? sessaoDeHoje!.alongamento!.map(a => a.name).join(' · ')
                  : 'Alongamento livre'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* DOMÍNIO SOBRE A CONTA.
          O aluno só enxerga o ativo — o dashboard dele mostra um treino só. Então quem decide
          o que ele treina é quem mexe aqui, e até 15/10/2026 ninguém decidia: o ativo vivia no
          localStorage do aparelho dele, fora do alcance de todo mundo. */}
      {planos.length > 0 && (
        <Card className="mb-5">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider font-semibold text-foreground-muted mb-3">
              Treinos na conta ({planos.length})
            </p>
            <div className="flex flex-col gap-2">
              {planos.map(pl => {
                const ativo = pl.id === (ativoId ?? planos[0]?.id);
                const olhando = pl.id === (vendo ?? ativoId ?? planos[0]?.id);
                return (
                  <div
                    key={pl.id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-sm ${
                      olhando ? 'border-primary/40 bg-primary/5' : 'border-border bg-surface'
                    }`}
                  >
                    <button onClick={() => setVendo(pl.id)} className="flex-1 min-w-0 text-left">
                      <span className="block font-medium truncate">{pl.name}</span>
                      <span className="block text-[11px] text-foreground-muted">
                        {pl.sessions?.length ?? 0} dias · {new Date(pl.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </button>

                    {ativo ? (
                      <span className="text-[11px] font-semibold text-primary flex items-center gap-1 shrink-0 px-2">
                        <Check className="w-3.5 h-3.5" /> o aluno abre neste
                      </span>
                    ) : (
                      <button
                        onClick={() => ativar(pl.id)}
                        disabled={mexendo}
                        className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-surface-light border border-white/10 hover:text-primary hover:border-primary/40 disabled:opacity-40 transition-colors shrink-0"
                      >
                        Tornar este o ativo
                      </button>
                    )}

                    <button
                      onClick={() => apagar(pl)}
                      disabled={mexendo}
                      aria-label={`Apagar ${pl.name}`}
                      className="p-1.5 text-foreground-muted hover:text-destructive disabled:opacity-40 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {planos.length > 1 && (
              <p className="flex items-start gap-2 text-[11px] text-foreground-muted mt-3">
                <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
                O aluno <strong>só enxerga o ativo</strong> — o dashboard dele mostra um treino
                só. Os outros existem apenas aqui, e quem decide qual ele abre é você.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {plano?.cardio_session && (
        <Card className="mb-4">
          <CardContent className="p-4 flex items-center gap-3">
            <Timer className="w-5 h-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider font-semibold text-primary">Depois do treino</p>
              <p className="font-bold">{plano.cardio_session.name}</p>
              <p className="text-xs text-foreground-muted">{plano.cardio_session.durationMinutes} min</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* O PLANO INTEIRO, que o dashboard dele NÃO mostra.
          Ele vê um dia por vez; aqui estão todos. É daqui que a revisão acontece — o card de
          cima serve para saber o que ele abre, esta lista para julgar o que foi prescrito. */}
      {plano && (plano.sessions?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h2 className="font-outfit font-bold text-lg">Os {plano.sessions!.length} dias</h2>
            <p className="text-xs text-foreground-muted">
              Ele abre um por vez, no rodízio. Aqui estão todos.
            </p>
          </div>
          <Link
            href={`/admin/montar?userId=${alunoId}&planoId=${plano.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-white/10 bg-surface-light hover:text-primary hover:border-primary/40 transition-colors shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" /> Editar no montador
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {(plano?.sessions ?? []).map((sessao, i) => (
          <Card key={sessao.id ?? i} className={ehOAtivo && i === escolha.indice ? 'border-primary/40' : ''}>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <h2 className="font-outfit font-bold text-xl flex-1 min-w-0">{sessao.name}</h2>
                {ehOAtivo && i === escolha.indice && (
                  <span className="text-[11px] font-semibold text-primary px-2 py-1 rounded-full bg-primary/10 shrink-0">
                    é este que ele abre agora
                  </span>
                )}
              </div>

              {/* O aquecimento é montado no servidor quando a IA gera. Plano montado à mão
                  também recebe, desde 15/10/2026 — antes o Treino do Personal chegava sem,
                  e o produto pago tinha menos que o gerado de graça. */}
              {sessao.warmup && sessao.warmup.length > 0 && (
                <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-3 mb-4">
                  <p className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                    <Waves className="w-3.5 h-3.5 text-secondary" /> Aquecimento · mobilidade
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {sessao.warmup.map(w => w.name).join(' · ')}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                {(sessao.exercises ?? []).map((ex, j) => {
                  const midia = midiaDe(ex);
                  return (
                    <div key={ex.id ?? j} className="flex gap-3 p-2.5 rounded-xl border border-border bg-surface">
                      <button
                        type="button"
                        onClick={() => midia && setAmpliado({ midia, titulo: ex.name, sub: ex.muscleGroup })}
                        disabled={!midia}
                        aria-label={midia ? `Ver ${ex.name} ampliado` : undefined}
                        className="w-20 h-20 rounded-lg bg-black/40 grid place-items-center overflow-hidden flex-none relative"
                      >
                        {midia ? (
                          <>
                            <img src={midia} alt="" className="w-full h-full object-contain opacity-90" />
                            <span className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded bg-black/60 grid place-items-center">
                              <Maximize2 className="w-2.5 h-2.5 text-white/80" />
                            </span>
                          </>
                        ) : (
                          <ImageOff className="w-4 h-4 text-foreground-muted/40" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{ex.name}</p>
                        {ex.muscleGroup && (
                          <p className="text-[11px] text-foreground-muted mt-0.5">{ex.muscleGroup}</p>
                        )}
                        <p className="text-xs text-primary mt-1 font-mono tabular-nums">
                          {ex.sets} × {ex.reps} · descanso {ex.restSeconds}s
                        </p>
                        {ex.tips && (
                          <p className="text-[11px] text-foreground-muted mt-1.5 leading-relaxed">{ex.tips}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ABDOMINAL PRESCRITO.
                  Só aparece quando o profissional escolheu à mão. No automático ele é
                  sorteado na tela do aluno, e mostrar aqui um sorteio que vai acontecer do
                  outro lado seria prometer exercício que pode não ser esse. */}
              {sessao.abdominal && sessao.abdominal.length > 0 && (
                <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 mt-4">
                  <p className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                    <Flame className="w-3.5 h-3.5 text-accent" /> Abdominal · depois do treino
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {sessao.abdominal.map(a => a.name).join(' · ')}
                  </p>
                  <p className="text-[11px] text-foreground-muted mt-1.5">
                    Aparece em dias alternados. Séries e repetições saem do protocolo do objetivo.
                  </p>
                </div>
              )}

              {/* Só aparece quando foi prescrito à mão: no app, alongar é livre. */}
              {sessao.alongamento && sessao.alongamento.length > 0 && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 mt-4">
                  <p className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                    <StretchHorizontal className="w-3.5 h-3.5 text-primary" /> Alongamento · no fim
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {sessao.alongamento.map(a => `${a.name} (${a.segundos ?? 40}s)`).join(' · ')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
