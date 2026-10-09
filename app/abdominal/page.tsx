"use client";

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAppContext } from '@/app/context/AppContext';
import { useToast } from '@/components/ui/Toast';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader2, Shuffle, Check, ImageOff, Flame } from 'lucide-react';
import { PADDING_TELA, LARGURA_FOCO, RODAPE_SEGURO } from '@/lib/layout';
import { PREFIXO_AVULSO } from '@/lib/trainingUnlock';

/**
 * Abdominal como sessão avulsa.
 *
 * SAIU DA SESSÃO DE FORÇA por medição: o abdômen aparecia 1 vez em 18 exercícios, e sempre
 * por acaso — caía no dia de perna. Com 97 exercícios de core no catálogo, isso era
 * desperdício dos dois lados: quem queria abdômen não recebia, e quem não queria levava um
 * perdido no meio do treino de perna.
 *
 * DIFERENTE DE MOBILIDADE E ALONGAMENTO: aqui é treino de verdade, com série e repetição, e
 * o que o aluno fizer entra no histórico. Por isso não usa ListaComCronometro — aquela tela é
 * para o que se faz por tempo.
 *
 * A sessão é montada no código, sem IA: cinco exercícios sorteados do catálogo. Sortear de
 * novo é um toque, e sai mais barato que qualquer geração.
 */

const QUANTIDADE = 5;
const SERIES = 3;
const REPETICOES = '12-15';

interface ExercicioCore {
  id: string;
  name: string;
  muscle_group: string | null;
  mediaUrl: string | null;
}

export default function Abdominal() {
  const toast = useToast();
  const { addHistoryEntry } = useAppContext();

  const [catalogo, setCatalogo] = useState<ExercicioCore[] | null>(null);
  const [semente, setSemente] = useState(0);
  const [feitos, setFeitos] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('exercises')
        .select('id, name, muscle_group, media_url')
        .limit(1000);
      setCatalogo(
        (data ?? [])
          .filter(e => /core|abd/i.test(e.muscle_group ?? ''))
          .map(e => ({ id: e.id, name: e.name, muscle_group: e.muscle_group, mediaUrl: e.media_url }))
      );
    })();
  }, []);

  // `semente` existe só para o useMemo recalcular quando o aluno pede outro sorteio.
  const sessao = useMemo(() => {
    if (!catalogo?.length) return [];
    return [...catalogo].sort(() => Math.random() - 0.5).slice(0, QUANTIDADE);
  }, [catalogo, semente]);

  const alternar = (id: string) =>
    setFeitos(f => {
      const novo = new Set(f);
      novo.has(id) ? novo.delete(id) : novo.add(id);
      return novo;
    });

  const sortearDeNovo = () => { setSemente(s => s + 1); setFeitos(new Set()); };

  const concluir = async () => {
    if (feitos.size === 0) { toast.erro('Marque ao menos um exercício.'); return; }
    setSalvando(true);
    try {
      // Volume zero de propósito: exercício de core é quase sempre com o peso do corpo, e
      // inventar uma carga sujaria o gráfico de volume do treino de força. O que importa
      // registrar aqui é que a sessão aconteceu.
      //
      // O prefixo "avulso-" no workoutPlanId é lido por lib/trainingUnlock.ts: a sessão
      // entra no histórico, mas NÃO conta como treino para desbloquear método avançado.
      // Cinco minutos de abdômen não são prova de constância em treino de força.
      const escolhidos = sessao.filter(e => feitos.has(e.id));
      await addHistoryEntry({
        id: crypto.randomUUID(),
        date: Date.now(),
        workoutPlanId: `${PREFIXO_AVULSO}abdominal`,
        workoutPlanName: 'Sessão avulsa',
        sessionId: 'abdominal',
        sessionName: 'Abdominal',
        durationSeconds: Math.max(300, escolhidos.length * 180),
        totalVolume: 0,
        exercises: escolhidos.map(e => ({
          workoutExerciseId: e.id,
          exerciseId: e.id,
          name: e.name,
          muscleGroup: e.muscle_group ?? 'Core/Abdômen',
          targetSets: SERIES,
          sets: Array.from({ length: SERIES }, () => ({
            reps: 12, weight: 0, completed: true,
          })),
        })),
      });
      toast.sucesso(`Sessão registrada: ${feitos.size} ${feitos.size === 1 ? 'exercício' : 'exercícios'}.`);
      setFeitos(new Set());
    } catch {
      toast.erro('Não consegui registrar.');
    } finally {
      setSalvando(false);
    }
  };

  if (!catalogo) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className={`${PADDING_TELA} ${LARGURA_FOCO} mx-auto animate-fade-in ${RODAPE_SEGURO}`}>
      <header className="mb-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center shadow-lg">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-outfit font-bold leading-none">Abdominal</h1>
            <p className="text-sm text-foreground-muted mt-1">{SERIES} séries de {REPETICOES} em cada</p>
          </div>
        </div>
        <p className="text-foreground-muted text-sm leading-relaxed max-w-prose">
          Uma sessão curta, para fazer depois do treino ou em dia livre. Não gostou de algum
          exercício? Sorteie outra combinação.
        </p>
      </header>

      <div className="flex flex-col gap-2 mb-5">
        {sessao.map(ex => {
          const feito = feitos.has(ex.id);
          return (
            <button
              key={ex.id}
              onClick={() => alternar(ex.id)}
              aria-pressed={feito}
              className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                feito ? 'border-primary/40 bg-primary/10' : 'border-border bg-surface hover:bg-surface-hover'
              }`}
            >
              <span className={`w-5 h-5 rounded-md flex-none grid place-items-center border ${
                feito ? 'bg-primary border-primary' : 'border-border-light'
              }`}>
                {feito && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
              </span>

              <span className="w-20 h-20 rounded-xl bg-black/40 grid place-items-center overflow-hidden flex-none">
                {ex.mediaUrl ? (
                  ex.mediaUrl.endsWith('.mp4') ? (
                    <video src={ex.mediaUrl} autoPlay loop muted playsInline className="w-full h-full object-contain opacity-90" />
                  ) : (
                    <img src={ex.mediaUrl} alt="" className="w-full h-full object-contain opacity-90" />
                  )
                ) : (
                  <ImageOff className="w-5 h-5 text-foreground-muted/40" />
                )}
              </span>

              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-medium leading-tight ${feito ? 'text-foreground-muted' : ''}`}>
                  {ex.name}
                </span>
                <span className="block text-xs text-primary mt-1 font-mono tabular-nums">
                  {SERIES} × {REPETICOES}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="outline" onClick={sortearDeNovo} className="sm:w-auto">
          <Shuffle className="w-4 h-4" /> Sortear outros
        </Button>
        <div className="flex-1" />
        <Button onClick={concluir} disabled={salvando || feitos.size === 0} className="sm:w-auto">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : `Concluir (${feitos.size}/${sessao.length})`}
        </Button>
      </div>
    </div>
  );
}
