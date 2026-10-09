"use client";

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/app/context/AppContext';
import { useToast } from '@/components/ui/Toast';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Upload, Loader2, AlertTriangle, Check, FileText, Camera } from 'lucide-react';
import type { ExercicioCasado } from '@/lib/importarTreino';
import { PADDING_TELA, LARGURA_FOCO, RODAPE_SEGURO } from '@/lib/layout';

/**
 * Importa a ficha de treino que o aluno já tem — foto ou PDF.
 *
 * O FLUXO TEM TRÊS PASSOS, E O DO MEIO É O QUE IMPORTA. Ficha de academia é escrita à mão,
 * com abreviação e letra ruim. Salvar direto o que o modelo leu seria entregar um treino que
 * ninguém prescreveu. Então: envia, CONFERE, salva.
 *
 * Os exercícios que não casaram com o catálogo aparecem destacados: eles entram no plano como
 * texto, sem vídeo e sem passar pelos filtros, e o aluno precisa saber disso antes de salvar.
 */

interface SessaoLida {
  nome: string;
  exercicios: ExercicioCasado[];
}

export default function ImportarTreino() {
  const router = useRouter();
  const toast = useToast();
  const { addWorkoutPlan } = useAppContext();
  const inputRef = useRef<HTMLInputElement>(null);

  const [lendo, setLendo] = useState(false);
  const [sessoes, setSessoes] = useState<SessaoLida[] | null>(null);
  const [nome, setNome] = useState('Meu treino importado');
  const [salvando, setSalvando] = useState(false);

  const enviar = async (arquivo: File) => {
    setLendo(true);
    try {
      const form = new FormData();
      form.append('arquivo', arquivo);
      const res = await fetch('/api/importar-treino', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não consegui ler a ficha.');

      setSessoes(data.sessoes);
      const aviso = data.precisamConferencia > 0
        ? ` ${data.precisamConferencia} precisam da sua conferência.`
        : '';
      toast.sucesso(`Li ${data.total} exercícios.${aviso}`);
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : 'Não consegui ler a ficha.');
    } finally {
      setLendo(false);
    }
  };

  const removerExercicio = (si: number, ei: number) =>
    setSessoes(s => (s ?? []).map((sessao, i) =>
      i === si ? { ...sessao, exercicios: sessao.exercicios.filter((_, j) => j !== ei) } : sessao
    ).filter(sessao => sessao.exercicios.length > 0));

  const salvar = async () => {
    if (!sessoes?.length) return;
    setSalvando(true);
    try {
      await addWorkoutPlan({
        id: crypto.randomUUID(),
        name: nome.trim() || 'Meu treino importado',
        split: `${sessoes.length} dias`,
        createdAt: Date.now(),
        sessions: sessoes.map((s, i) => ({
          id: `s${i + 1}`,
          name: s.nome,
          exercises: s.exercicios.map((e, j) => ({
            id: `${i}-${j}`,
            exerciseId: e.exerciseId ?? '',
            // Prefere o nome do CATÁLOGO: é ele que o resto do app reconhece para achar vídeo
            // e aplicar filtro. Só cai no nome lido quando não houve correspondente.
            name: e.nomeNoCatalogo ?? e.name,
            muscleGroup: e.muscleGroup ?? '',
            sets: e.sets ?? 3,
            reps: e.reps ?? '8-12',
            restSeconds: e.restSeconds ?? 60,
            tips: '',
            youtubeSearchTerm: `${e.nomeNoCatalogo ?? e.name} como executar`,
          })),
        })),
      });
      toast.sucesso('Treino importado. Ele já está na sua lista.');
      router.push('/');
    } catch {
      toast.erro('Não consegui salvar o treino.');
    } finally {
      setSalvando(false);
    }
  };

  const semCorrespondente = (sessoes ?? []).reduce(
    (n, s) => n + s.exercicios.filter(e => !e.exerciseId).length, 0
  );

  return (
    <div className={`${PADDING_TELA} ${LARGURA_FOCO} mx-auto animate-fade-in ${RODAPE_SEGURO}`}>
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-outfit font-bold">Importar treino</h1>
        <p className="text-foreground-muted mt-2 leading-relaxed">
          Já tem uma ficha do seu personal ou da academia? Tire uma foto ou envie o PDF, e eu
          transformo em treino aqui dentro — com vídeo de cada exercício e o cronômetro.
        </p>
      </header>

      {!sessoes && (
        <Card>
          <CardContent className="p-6 flex flex-col gap-4">
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) enviar(f); }}
            />

            <button
              onClick={() => inputRef.current?.click()}
              disabled={lendo}
              className="border-2 border-dashed border-border hover:border-primary/50 rounded-2xl p-8 flex flex-col items-center gap-3 transition-colors disabled:opacity-60"
            >
              {lendo ? (
                <>
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <span className="text-sm text-foreground-muted">Lendo sua ficha…</span>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-primary" />
                  <span className="font-outfit font-bold">Escolher foto ou PDF</span>
                  <span className="text-xs text-foreground-muted">JPG, PNG ou PDF · até 8 MB</span>
                </>
              )}
            </button>

            <div className="grid sm:grid-cols-2 gap-3 text-xs text-foreground-muted">
              <p className="flex gap-2"><Camera className="w-4 h-4 text-primary flex-none mt-0.5" />
                Foto de frente, com boa luz e sem sombra em cima do papel.</p>
              <p className="flex gap-2"><FileText className="w-4 h-4 text-primary flex-none mt-0.5" />
                PDF funciona melhor que foto, quando você tiver.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {sessoes && (
        <>
          {semCorrespondente > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/40 bg-warning/5 mb-5">
              <AlertTriangle className="w-5 h-5 text-warning flex-none mt-0.5" />
              <p className="text-sm text-foreground-muted">
                <strong className="text-foreground">
                  {semCorrespondente} {semCorrespondente === 1 ? 'exercício' : 'exercícios'} sem
                  correspondente no catálogo.
                </strong>{' '}
                Eles entram no treino, mas sem vídeo. Confira se o nome está certo, ou remova o
                que você não reconhecer.
              </p>
            </div>
          )}

          <Card className="mb-4">
            <CardContent className="p-4">
              <label htmlFor="nome" className="text-sm font-semibold block mb-2">Nome do treino</label>
              <input
                id="nome"
                value={nome}
                onChange={e => setNome(e.target.value)}
                maxLength={120}
                className="w-full bg-surface border border-border rounded-xl p-3 text-sm focus:outline-none focus:border-primary/50"
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            {sessoes.map((sessao, si) => (
              <Card key={si}>
                <CardContent className="p-5">
                  <p className="font-outfit font-bold mb-3">{sessao.nome}</p>
                  <div className="flex flex-col gap-2">
                    {sessao.exercicios.map((ex, ei) => (
                      <div
                        key={ei}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${
                          ex.exerciseId ? 'border-border bg-surface' : 'border-warning/40 bg-warning/5'
                        }`}
                      >
                        <span className="flex-none">
                          {ex.exerciseId
                            ? <Check className="w-4 h-4 text-primary" />
                            : <AlertTriangle className="w-4 h-4 text-warning" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm leading-tight">
                            {ex.nomeNoCatalogo ?? ex.name}
                          </span>
                          {/* Mostra o que estava escrito na ficha quando o nome mudou — assim
                              o aluno confere se a correspondência faz sentido. */}
                          {ex.nomeNoCatalogo && ex.nomeNoCatalogo !== ex.name && (
                            <span className="block text-[11px] text-foreground-muted mt-0.5">
                              na sua ficha: “{ex.name}”
                            </span>
                          )}
                          {!ex.exerciseId && (
                            <span className="block text-[11px] text-warning mt-0.5">
                              sem vídeo — não encontrei no catálogo
                            </span>
                          )}
                        </span>
                        <span className="text-xs font-mono text-foreground-muted flex-none tabular-nums">
                          {ex.sets}×{ex.reps}
                        </span>
                        <button
                          onClick={() => removerExercicio(si, ei)}
                          aria-label={`Remover ${ex.name}`}
                          className="text-xs text-foreground-muted hover:text-destructive transition-colors flex-none"
                        >
                          remover
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <Button variant="outline" onClick={() => setSessoes(null)} className="sm:w-auto">
              Enviar outra ficha
            </Button>
            <div className="flex-1" />
            <Button onClick={salvar} disabled={salvando} className="sm:w-auto">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar este treino'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
