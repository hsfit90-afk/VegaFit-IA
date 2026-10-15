"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { useSomenteMaster } from '@/components/useSomenteMaster';
import { useToast } from '@/components/ui/Toast';
import { Card, CardContent } from '@/components/ui/Card';
import { VisualizadorDeMidia } from '@/components/workout/VisualizadorDeMidia';
import { Loader2, ArrowLeft, Eye, ImageOff, Maximize2, Waves, Timer, AlertTriangle } from 'lucide-react';
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
 * Mostra o plano MAIS RECENTE do aluno, que é o que o app dele abre por padrão (a lista vem
 * ordenada por data em AppContext). Se houver outros, avisa — plano antigo esquecido na conta
 * é coisa que o aluno pode abrir sem entender por quê.
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

      if (alunoR.ok) setNomeDoAluno((await alunoR.json()).aluno?.nome ?? '');
    })();
  }, [alunoId]);

  const midiaDe = (ex: { exerciseId?: string; name: string }): string | null =>
    (ex.exerciseId ? midias.get(ex.exerciseId) : null)
    ?? midias.get(ex.name.trim().toLowerCase())
    ?? null;

  const plano = useMemo(() => planos?.[0] ?? null, [planos]);

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

      {/* Plano antigo esquecido na conta e algo que o aluno pode abrir sem entender por que. */}
      {planos.length > 1 && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-sm mb-5">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <span>
            Este aluno tem <strong>{planos.length} treinos</strong> na conta. O app dele abre no
            mais recente, mostrado aqui — mas ele consegue trocar para os antigos.
          </span>
        </div>
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
