"use client";

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Timer, Play, Pause, Check, ChevronLeft, Info } from 'lucide-react';
import { useAppContext } from '@/app/context/AppContext';
import { useWorkoutTimer } from '@/hooks/useWorkoutTimer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { WorkoutHistoryEntry } from '@/lib/types';
import { createClient } from '@/utils/supabase/client';

/**
 * Sessão de aeróbico, fora do rodízio A/B/C.
 *
 * Tela própria em vez de um modo dentro de /active porque as duas não compartilham quase nada:
 * lá o aluno registra série, carga, RIR e PR; aqui existe um cronômetro e um botão de concluir.
 * Misturar significaria condicional em cima de condicional num arquivo de 1.100 linhas.
 *
 * O aeróbico é prescrito por TEMPO TOTAL, não por exercício — por isso não há série, repetição
 * nem carga em lugar nenhum desta tela.
 */
/** Nome comparavel: sem acento, sem caixa, sem espaco sobrando. */
function chaveDeNome(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export default function CardioPage() {
  const router = useRouter();
  const toast = useToast();
  const { workoutPlans, activePlanId, addHistoryEntry } = useAppContext();

  const [startTime, setStartTime] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [pausadoEm, setPausadoEm] = useState(0);
  const [aparelho, setAparelho] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const plano = useMemo(
    () => workoutPlans.find(p => p.id === activePlanId) || workoutPlans[0],
    [workoutPlans, activePlanId]
  );
  const cardio = plano?.cardioSession;

  /**
   * O catálogo de cardio, só para ilustrar as opções.
   *
   * Busca separada e sem bloqueio: se falhar ou demorar, a tela funciona igual, só sem
   * imagem. Aeróbico que não começa porque um GIF não carregou seria péssimo negócio.
   */
  const [midias, setMidias] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('exercises')
        .select('name, media_url, muscle_group')
        .limit(1000);
      const mapa = new Map<string, string>();
      for (const e of data ?? []) {
        if (e.media_url) mapa.set(chaveDeNome(e.name), e.media_url);
      }
      setMidias(mapa);
    })();
  }, []);

  /**
   * Casa o nome da opção com o catálogo.
   *
   * Tolerante de propósito: a opção foi escrita pela IA a partir do pool, então costuma bater
   * exato — mas um acento a mais ou uma caixa diferente não podem custar a imagem. Primeiro
   * tenta o nome inteiro; depois, só o que vem antes do parêntese, porque "Alpinista (Mountain
   * Climber)" e "Alpinista" são o mesmo movimento.
   */
  const midiaDaOpcao = (opcao: string): string | undefined =>
    midias.get(chaveDeNome(opcao)) ?? midias.get(chaveDeNome(opcao.split('(')[0]));

  const decorridos = useWorkoutTimer(startTime, pausado);
  const alvoSegundos = (cardio?.durationMinutes || 0) * 60;
  const progresso = alvoSegundos > 0 ? Math.min(100, (decorridos / alvoSegundos) * 100) : 0;
  const atingiuAlvo = alvoSegundos > 0 && decorridos >= alvoSegundos;

  const formatar = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  if (!plano || !cardio) {
    return (
      <div className="min-h-screen p-5 md:p-8 max-w-3xl mx-auto">
        <EmptyState
          icone={<Timer className="w-10 h-10" />}
          titulo="Nenhum aeróbico no seu plano"
          descricao="Gere um treino novo para receber também uma sessão de aeróbico."
          acao={<Button onClick={() => router.push('/generator')}>Gerar treino</Button>}
        />
      </div>
    );
  }

  const iniciar = () => {
    setStartTime(Date.now());
    setPausado(false);
  };

  // Pausa desloca o startTime pelo tempo parado, em vez de guardar um acumulador: assim o
  // cronômetro continua derivando de um timestamp absoluto e sobrevive à tela bloqueada.
  const alternarPausa = () => {
    if (pausado) {
      setStartTime(prev => prev + (Date.now() - pausadoEm));
      setPausado(false);
    } else {
      setPausadoEm(Date.now());
      setPausado(true);
    }
  };

  const concluir = async () => {
    if (salvando) return;
    setSalvando(true);

    const entrada: WorkoutHistoryEntry = {
      id: crypto.randomUUID(),
      date: Date.now(),
      workoutPlanId: plano.id,
      workoutPlanName: plano.name,
      // Marcador que separa aeróbico de treino de força no histórico. O gráfico de volume
      // filtra por ele — 0 kg num gráfico de carga seria um buraco sem significado.
      sessionId: 'cardio',
      sessionName: aparelho ? `${cardio.name} — ${aparelho}` : cardio.name,
      durationSeconds: decorridos,
      // Volume em kg não existe aqui. O que importa é o tempo, gravado em durationSeconds.
      totalVolume: 0,
      exercises: [],
    };

    try {
      await addHistoryEntry(entrada);
      toast.sucesso(`Aeróbico concluído: ${Math.round(decorridos / 60)} min`);
      router.push('/');
    } catch {
      toast.erro('Não conseguimos salvar o aeróbico. Tente novamente.');
      setSalvando(false);
    }
  };

  const rodando = startTime > 0;

  return (
    <div className="min-h-screen p-5 md:p-8 max-w-3xl mx-auto pb-28 md:pb-12">
      <button
        onClick={() => router.push('/')}
        className="flex items-center gap-1 text-sm text-foreground-muted hover:text-primary transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" /> Voltar
      </button>

      <div className="mb-6">
        {/* "Depois do treino" no lugar de "Sessão avulsa": a prescrição é que o aeróbico
            venha SEMPRE depois da força, e o rótulo antigo não dizia nada sobre isso. Quem
            faz antes chega no treino principal sem carga — que é o que o aluno veio buscar. */}
        <p className="text-xs text-primary uppercase tracking-wider font-semibold mb-1">
          Depois do treino de força
        </p>
        <h1 className="text-3xl font-outfit font-bold text-white">{cardio.name}</h1>
        <p className="text-foreground-muted mt-1">
          {cardio.durationMinutes} minutos · {cardio.intensity}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface p-3.5 mb-5 text-sm text-foreground-muted">
        Faça este aeróbico <strong className="text-foreground">depois</strong> do treino de
        força, ou num dia separado. Antes, ele compromete a carga que você consegue levantar.
      </div>

      {/* GIF quando existe, nome quando não.
          Os 49 exercícios de cardio do catálogo têm mídia (medido em 11/10/2026), mas a
          sessão guarda só o NOME da opção, em texto — então a tela não tinha como mostrar
          nada. Agora ela procura o nome no catálogo e ilustra o que achar.

          Importa mais no aeróbico sem aparelho: "Corda Imaginária (Sem Corda)" e "Alpinista"
          não se explicam pelo nome, ao contrário de "Esteira Ergométrica". Quem nunca viu o
          movimento não tem como fazer certo.

          Degrada para texto por decisão, não por acidente: nome que não casa com o catálogo
          vira o chip de antes. Melhor uma opção sem imagem do que uma opção que some. */}
      {!rodando && cardio.options?.length > 0 && (
        <Card className="p-5 mb-5" glass>
          <p className="text-sm font-semibold text-white mb-3">Escolha o aparelho</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {cardio.options.map(opcao => {
              const ilustracao = midiaDaOpcao(opcao);
              const escolhido = aparelho === opcao;
              return (
                <button
                  key={opcao}
                  onClick={() => setAparelho(escolhido ? null : opcao)}
                  aria-pressed={escolhido}
                  className={`rounded-2xl border overflow-hidden text-left transition-colors ${
                    escolhido
                      ? 'bg-primary/15 border-primary'
                      : 'bg-surface/60 border-white/10 hover:border-primary/40'
                  }`}
                >
                  {ilustracao && (
                    <span className="block w-full aspect-square bg-black/40 grid place-items-center overflow-hidden">
                      {ilustracao.endsWith('.mp4') ? (
                        <video src={ilustracao} autoPlay loop muted playsInline
                          className="w-full h-full object-contain" />
                      ) : (
                        <img src={ilustracao} alt="" className="w-full h-full object-contain" />
                      )}
                    </span>
                  )}
                  <span className={`block px-3 py-2.5 text-sm leading-tight ${
                    escolhido ? 'text-primary font-semibold' : 'text-foreground-muted'
                  }`}>
                    {opcao}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {cardio.notes && !rodando && (
        <Card className="p-4 mb-5 flex gap-3 items-start" glass>
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/80">{cardio.notes}</p>
        </Card>
      )}

      <Card className="p-8 text-center mb-5" glass>
        <p className="text-xs text-foreground-muted uppercase tracking-wider font-semibold mb-2">
          {atingiuAlvo ? 'Meta atingida' : 'Tempo'}
        </p>
        <p
          className={`font-outfit font-bold tabular-nums text-6xl md:text-7xl ${
            atingiuAlvo ? 'text-primary' : 'text-white'
          }`}
        >
          {formatar(decorridos)}
        </p>
        <p className="text-sm text-foreground-muted mt-2">meta de {cardio.durationMinutes} min</p>

        <div className="mt-6 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-500"
            style={{ width: `${progresso}%` }}
          />
        </div>

        {aparelho && <p className="text-sm text-foreground-muted mt-4">{aparelho}</p>}
      </Card>

      {!rodando ? (
        <Button size="lg" className="w-full" onClick={iniciar}>
          <Play className="w-5 h-5 mr-2" /> INICIAR AERÓBICO
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full"
            onClick={concluir}
            disabled={salvando || decorridos < 1}
          >
            <Check className="w-5 h-5 mr-2" />
            {salvando ? 'SALVANDO...' : 'CONCLUIR'}
          </Button>
          <Button size="sm" variant="outline" className="w-full" onClick={alternarPausa}>
            {pausado ? (
              <>
                <Play className="w-4 h-4 mr-2" /> Retomar
              </>
            ) : (
              <>
                <Pause className="w-4 h-4 mr-2" /> Pausar
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
