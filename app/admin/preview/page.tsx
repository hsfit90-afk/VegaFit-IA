"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useSomenteMaster } from '@/components/useSomenteMaster';
import { useToast } from '@/components/ui/Toast';
import { Card, CardContent } from '@/components/ui/Card';
import { VisualizadorDeMidia } from '@/components/workout/VisualizadorDeMidia';
import { Loader2, ArrowLeft, Eye, ImageOff, Maximize2, Waves, Timer, AlertTriangle, Check, Trash2 } from 'lucide-react';
import { PADDING_TELA, LARGURA_FOCO, RODAPE_SEGURO } from '@/lib/layout';

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

interface SessaoPrescrita {
  id?: string;
  name: string;
  exercises?: ExercicioPrescrito[];
  warmup?: { name: string; muscleGroup?: string; segundos?: number; exerciseId?: string }[];
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

      <div className="flex flex-col gap-5">
        {(plano?.sessions ?? []).map((sessao, i) => (
          <Card key={sessao.id ?? i}>
            <CardContent className="p-5">
              <h2 className="font-outfit font-bold text-xl mb-4">{sessao.name}</h2>

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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
