"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Dumbbell, Flame, Trophy, Calendar, Lightbulb, ChevronRight, Activity, Zap, Star, LayoutList, Trash2, CheckCircle2, PlayCircle, Timer , Waves, StretchHorizontal} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { motion, type Variants } from 'motion/react';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { WorkoutPlan } from '@/lib/types';
import { musculosEmFadiga, escolherSessao, sessaoSeguinte, minutosDaSessao } from '@/lib/proximoTreino';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinhaDeLista } from '@/components/ui/LinhaDeLista';
import { Rotulo } from '@/components/ui/Rotulo';
import { AvisoDeAssinatura } from '@/components/AvisoDeAssinatura';
import { CardPersonalizado } from '@/components/CardPersonalizado';
import { PADDING_TELA, LARGURA_CONTEUDO, RODAPE_SEGURO } from '@/lib/layout';
import { createClient } from '@/utils/supabase/client';

export default function Dashboard() {
  // setActivePlan NÃO entra aqui: o dashboard mostra só o plano ativo, sem seletor. Estava
  // sendo desestruturado sem nunca ser chamado, e foi o que me fez afirmar que o aluno
  // trocava de treino — ele não troca. Quem troca é o profissional, pelo /admin/preview.
  const { profile, history, workoutPlans, activePlanId, deleteWorkoutPlan, currentSessionIndex } = useAppContext();
  const router = useRouter();
  const confirmar = useConfirm();
  const [dailyTip, setDailyTip] = useState<string>('Carregando dica do dia...');
  const [manualSessionIndex, setManualSessionIndex] = useState<number | null>(null);
  
  // Resolve o bug do "tempo congelado" quando o app fica aberto em background
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setNow(Date.now());
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    const interval = setInterval(() => setNow(Date.now()), 60000); // Atualiza a cada 1 minuto
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, []);

  // Métricas
  const currentWeekWorkouts = history.filter(h => {
    const today = new Date(now);
    const workoutDate = new Date(h.date);
    const diffDays = Math.ceil(Math.abs(today.getTime() - workoutDate.getTime()) / (1000 * 60 * 60 * 24)); 
    return diffDays <= 7;
  });

  const totalVolume = currentWeekWorkouts.reduce((sum, h) => sum + h.totalVolume, 0);

  // Removed strict redirect so trainers can also use their own dashboard for working out.
  // Trainers have "Meus Alunos" in the navigation if they want to manage clients.
  useEffect(() => {
    const fetchTip = async () => {
      const today = new Date().toDateString();
      const savedTip = localStorage.getItem('dailyTip');
      const savedDate = localStorage.getItem('dailyTipDate');

      if (savedTip && savedDate === today) {
        setDailyTip(savedTip);
        return;
      }

      try {
        const res = await fetch('/api/daily-tip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: profile?.geminiApiKey,
            profile: profile
          })
        });
        const data = await res.json();
        if (data.tip) {
          setDailyTip(data.tip);
          localStorage.setItem('dailyTip', data.tip);
          localStorage.setItem('dailyTipDate', today);
        }
      } catch (err) {
        setDailyTip('Mantenha a constância. A hidratação e um bom descanso são tão importantes quanto o treino.');
      }
    };

    if (profile) fetchTip();
  }, [profile]);

  const greeting = () => {
    const hour = new Date(now).getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // --- Active Plan Logic ---
  const activePlan = useMemo(() => {
    if (!workoutPlans.length) return null;
    if (activePlanId) {
      const plan = workoutPlans.find(p => p.id === activePlanId);
      if (plan) return plan;
    }
    return workoutPlans[0];
  }, [workoutPlans, activePlanId]);

  /**
   * A REGRA SAIU DAQUI em 19/10/2026 — agora mora em lib/proximoTreino.ts.
   *
   * Qual dia o aluno abre, e quando o app desvia por fadiga, É PRESCRIÇÃO. Morava nesta tela
   * como três `useMemo` sem teste, então nenhuma outra podia dizer "o próximo treino dele é o
   * Treino A" sem reimplementar a conta — e é assim que duas versões da mesma regra nascem e
   * divergem, como já aconteceu com o filtro de equipamento e com a escolha do abdominal.
   *
   * A prévia do profissional precisa do MESMO número que o aluno vê. Agora as duas telas
   * chamam a mesma função.
   *
   * O comportamento é idêntico ao de antes, de propósito: extrair não pode mudar nada na tela
   * que todo aluno abre. Até um caso de borda conhecido foi preservado — ver o teste
   * 'COMPORTAMENTO PRESERVADO' em tests/proximoTreino.test.ts.
   */
  const fatigueMuscleSets = useMemo(() => musculosEmFadiga(history, now), [history, now]);

  const escolhaDeHoje = useMemo(
    () => escolherSessao(activePlan?.sessions, currentSessionIndex, fatigueMuscleSets),
    [activePlan, currentSessionIndex, fatigueMuscleSets]
  );
  const smartSessionIndex = escolhaDeHoje.indice;

  const displaySessionIndex = manualSessionIndex !== null ? manualSessionIndex : smartSessionIndex;

  const suggestedSession = activePlan?.sessions[displaySessionIndex % (activePlan?.sessions.length || 1)];
  const originalSession = activePlan?.sessions[currentSessionIndex % (activePlan?.sessions.length || 1)];
  const wasRedirectedDueToFatigue = manualSessionIndex === null && escolhaDeHoje.desviadoPorFadiga;

  const cycleNextSession = () => {
    if (!activePlan) return;
    const nextIdx = (displaySessionIndex + 1) % activePlan.sessions.length;
    setManualSessionIndex(nextIdx);
  };

  // Próximo treino com músculos recuperados (pula o smartSessionIndex atual)
  const nextSmartSessionIndex = useMemo(
    () => sessaoSeguinte(activePlan?.sessions, smartSessionIndex, fatigueMuscleSets),
    [activePlan, smartSessionIndex, fatigueMuscleSets]
  );

  const nextSuggestedSession = activePlan?.sessions[nextSmartSessionIndex % (activePlan?.sessions.length || 1)];

  // --- Streak Logic ---
  const streak = useMemo(() => {
    if (history.length === 0) return 0;
    
    // Agrupar treinos por dia (ignorando horário)
    const uniqueDays = Array.from(new Set(
      history.map(h => new Date(h.date).setHours(0,0,0,0))
    )).sort((a, b) => b - a); // Decrescente

    let currentStreak = 0;
    const today = new Date(now).setHours(0,0,0,0);
    const yesterday = today - 86400000;

    // Se o último treino não foi hoje nem ontem, streak zerou
    if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) {
      return 0;
    }

    let expectedDay = uniqueDays[0];
    for (const day of uniqueDays) {
      if (day === expectedDay) {
        currentStreak++;
        expectedDay -= 86400000; // Subtrai 1 dia em ms
      } else {
        break; // Quebrou a sequência
      }
    }

    return currentStreak;
  }, [history]);

  // --- Achievements Logic ---
  const achievements = useMemo(() => {
    const list = [];
    if (history.length >= 1) list.push({ icon: <CheckCircle2 className="w-5 h-5 text-success"/>, title: "Primeiro Passo", desc: "Completou seu 1º treino!" });
    if (streak >= 3) list.push({ icon: <Flame className="w-5 h-5 text-flame"/>, title: "No Ritmo", desc: "3 dias seguidos treinando!" });
    if (history.length >= 10) list.push({ icon: <Star className="w-5 h-5 text-warning"/>, title: "Dedicado", desc: "10 treinos concluídos" });
    
    const totalVol = history.reduce((acc, h) => acc + h.totalVolume, 0);
    if (totalVol >= 10000) list.push({ icon: <Trophy className="w-5 h-5 text-info"/>, title: "Monstro", desc: "10 Toneladas levantadas" });

    return list.slice(0, 3); // Mostra os 3 mais relevantes (primeiros da fila)
  }, [history, streak]);



  /** Data por extenso no cabeçalho: dá contexto sem gastar uma faixa da tela. */
  const hoje = () =>
    new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  /**
   * A meta da semana, para a barra de progresso.
   *
   * Sai do número de dias do plano, que é o que o próprio treino prescreve. Não inventa uma
   * meta nem pergunta de novo o que a anamnese já respondeu.
   */
  const metaSemanal = activePlan?.sessions.length ?? 0;

  /**
   * A mídia dos exercícios do treino de hoje: a do primeiro vira o fundo do cartão, e todas
   * viram a miniatura da lista abaixo dele.
   *
   * ERA UMA SÓ, E O MOTIVO ESCRITO AQUI DEIXOU DE VALER.
   *
   * O comentário anterior dizia que buscar mais de uma seria "pagar caro por nada", porque só
   * uma aparecia. Em 29/10/2026 a lista passou a mostrar todas, e o argumento caiu junto.
   *
   * Continua UMA consulta: o que mudou foi `.eq` virar `.in`, com os ids da sessão —
   * tipicamente 5 a 8, nunca o catálogo de 882. Uma viagem ao banco, como antes.
   *
   * Falhar aqui não quebra nada: sem mídia, o cartão fica só com o gradiente e a linha mostra
   * um ícone no lugar do vídeo.
   */
  const [midiaPorExercicio, setMidiaPorExercicio] = useState<Record<string, string>>({});

  /** Os ids da sessão como texto, para o efeito não disparar a cada render. */
  const idsDaSessao = (suggestedSession?.exercises ?? [])
    .map(e => e.exerciseId)
    .filter(Boolean)
    .join(',');

  useEffect(() => {
    if (!idsDaSessao) { setMidiaPorExercicio({}); return; }
    let cancelado = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('exercises')
          .select('id, media_url')
          .in('id', idsDaSessao.split(','));
        if (cancelado) return;
        const mapa: Record<string, string> = {};
        for (const linha of data ?? []) {
          if (linha.media_url) mapa[linha.id] = linha.media_url;
        }
        setMidiaPorExercicio(mapa);
      } catch {
        if (!cancelado) setMidiaPorExercicio({});
      }
    })();
    return () => { cancelado = true; };
  }, [idsDaSessao]);

  const idDoPrimeiro = suggestedSession?.exercises?.[0]?.exerciseId;
  const midiaDoPrimeiro = idDoPrimeiro ? midiaPorExercicio[idDoPrimeiro] ?? null : null;

  /** Apagar o plano, com a mesma confirmação e as mesmas perdas listadas de antes. */
  const apagarPlano = async (plano: WorkoutPlan) => {
    const ok = await confirmar({
      titulo: 'Excluir este plano?',
      mensagem: `O plano "${plano.name}" será apagado da sua conta.`,
      perdas: [
        `As ${plano.sessions.length} sessões montadas neste plano`,
        'A periodização em andamento (semana e ciclo atuais)',
      ],
      textoConfirmar: 'Excluir plano',
    });
    if (ok) deleteWorkoutPlan(plano.id);
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div
      className={`${PADDING_TELA} ${LARGURA_CONTEUDO} mx-auto min-h-screen ${RODAPE_SEGURO}`}
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* CABEÇALHO EM UMA LINHA.
          Data à esquerda, constância à direita. A saudação não ganha faixa própria: ela não é
          motivo de ninguém abrir o app, e cada linha gasta aqui empurra o treino para baixo
          da dobra no celular. */}
      <motion.header variants={itemVariants} className="flex items-end justify-between gap-4 mb-6 mt-1">
        <div className="min-w-0">
          <Rotulo className="mb-1">
            {hoje()}
          </Rotulo>
          <h1 className="text-2xl md:text-3xl font-outfit font-bold tracking-tight truncate">
            {greeting()}, <span className="text-primary">{profile?.name || 'Atleta'}</span>
          </h1>
        </div>

        {streak > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface border border-border shrink-0">
            <Flame className="w-4 h-4 text-flame" />
            <span className="text-sm font-bold tabular-nums">{streak}</span>
            <span className="text-xs text-foreground-muted">{streak === 1 ? 'dia' : 'dias'}</span>
          </div>
        )}
      </motion.header>

      {/* O TREINO DE HOJE, EM TELA CHEIA.
          O dashboard antigo dividia a atenção entre quinze cards de mesmo peso. Aqui existe
          um protagonista: o aluno abre o app para saber o que treinar hoje, e é isso que
          ocupa a primeira dobra.

          O GIF do primeiro exercício entra como fundo. São 882 exercícios com vídeo no
          catálogo — o ativo mais forte do produto — e nenhum aparecia na tela inicial. */}
      <motion.section variants={itemVariants} className="mb-5">
        {activePlan ? (
          <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-b from-surface to-background-deep">
            {/* Brilho de marca, só aqui. Usado em tudo vira ruído; usado uma vez vira foco. */}
            <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full bg-primary/15 blur-[90px]" />

            {midiaDoPrimeiro && (
              <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-[0.18] md:opacity-25">
                {midiaDoPrimeiro.endsWith('.mp4') ? (
                  <video
                    src={midiaDoPrimeiro}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img src={midiaDoPrimeiro} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-background-deep via-background-deep/70 to-transparent" />
              </div>
            )}

            <div className="relative z-10 p-5 md:p-8">
              {wasRedirectedDueToFatigue && (
                <div className="flex items-start gap-2 mb-4 text-flame/90">
                  <Flame className="w-4 h-4 shrink-0 mt-0.5 text-flame" />
                  <p className="text-xs leading-relaxed">
                    <span className="font-bold text-flame">Treino trocado.</span>{' '}
                    {originalSession?.name} usa músculo que ainda está se recuperando.
                  </p>
                </div>
              )}

              <Rotulo className="!text-primary font-semibold mb-2">
                {wasRedirectedDueToFatigue ? 'Sugestão de hoje' : 'Seu treino de hoje'}
              </Rotulo>

              <h2 className="text-3xl md:text-5xl font-outfit font-bold leading-[1.05] tracking-tight mb-4 max-w-[18ch]">
                {suggestedSession?.name}
              </h2>

              {/* Os dois números que decidem se a pessoa treina agora: quanto tem para fazer e
                  quanto tempo leva. Grandes, tabulares, sem moldura em volta. */}
              <div className="flex items-end gap-8 mb-7">
                <div>
                  <p className="text-2xl md:text-3xl font-bold tabular-nums leading-none">
                    {suggestedSession?.exercises?.length || 0}
                  </p>
                  <p className="text-nano font-semibold uppercase tracking-widest text-foreground-muted mt-1.5">
                    exercícios
                  </p>
                </div>
                <div>
                  <p className="text-2xl md:text-3xl font-bold tabular-nums leading-none">
                    {minutosDaSessao(suggestedSession)}
                    <span className="text-base font-medium text-foreground-muted ml-1">min</span>
                  </p>
                  <p className="text-nano font-semibold uppercase tracking-widest text-foreground-muted mt-1.5">
                    estimados
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  onClick={() => router.push(`/active?sessionIndex=${displaySessionIndex}`)}
                  className="group shadow-[0_8px_30px_rgb(var(--color-primary-rgb)/0.25)]"
                >
                  <PlayCircle className="w-5 h-5 mr-2" />
                  COMEÇAR TREINO
                  <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>

                {activePlan.sessions.length > 1 && (
                  <button
                    onClick={cycleNextSession}
                    className="text-sm text-foreground-muted hover:text-primary transition-colors underline-offset-4 hover:underline"
                  >
                    Ver outro treino
                  </button>
                )}

                {/* QUEM JA TEM TREINO NAO TINHA COMO PEDIR OUTRO, NO CELULAR.

                    Os tres links para /generator no app estavam todos dentro de estado
                    vazio: este cartao no ramo "sem plano", app/active no `if
                    (!currentSession)` e app/cardio no `if (!plano || !cardio)`. O quarto
                    caminho e a barra lateral, que e `hidden md:flex`.

                    Resultado medido: com plano ativo, no celular, o Gerador nao tinha
                    NENHUMA porta. E a mesma armadilha do conserto de 09/10/2026, quando
                    Check-in e Historico so existiam naquela barra lateral.

                    Fica aqui, e nao como sexta aba do rodape: a barra usa `min-w-[70px]`
                    por item e ja soma 350px com cinco. Um sexto pede 420px, e nao cabe em
                    tela de 360px -- a maioria dos celulares Android. */}
                <Link
                  href="/generator"
                  className="inline-flex items-center gap-1.5 min-h-[44px] py-2 text-sm text-foreground-muted hover:text-primary transition-colors underline-offset-4 hover:underline"
                >
                  <Zap className="w-4 h-4" />
                  Gerar um treino novo
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Zap className="w-10 h-10 text-primary/40 mx-auto mb-4" />
            <h2 className="text-xl font-outfit font-bold mb-2">Você ainda não tem um treino</h2>
            <p className="text-sm text-foreground-muted mb-5 max-w-sm mx-auto">
              A IA monta um plano a partir da sua anamnese: seu objetivo, seu nível e o que
              você tem disponível para treinar.
            </p>
            <Link href="/generator">
              <Button size="lg">
                GERAR MEU TREINO
                <Zap className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </motion.section>

      {/* OS EXERCÍCIOS DO DIA, COM A MINIATURA DO VÍDEO.

          Até 29/10/2026 o painel dizia "5 exercícios" e não mostrava nenhum, enquanto o app
          guardava 882 vídeos e tinha o componente desta linha parado, sem uso em tela
          nenhuma. A pessoa só descobria o que ia fazer depois de apertar COMEÇAR.

          A lista NÃO é clicável de propósito: é prévia, e o único destino possível seria a
          própria tela de treino, que o botão acima já abre. Linha que parece botão e não
          leva a lugar nenhum é pior que linha parada.

          O vídeo toca sozinho, como já tocava em /abdominal e no painel do equipamento —
          mesmo padrão, para não inventar um terceiro jeito de mostrar a mesma coisa. */}
      {suggestedSession?.exercises?.length ? (
        <motion.section variants={itemVariants} className="mb-8">
          <Rotulo className="mb-2">Exercícios</Rotulo>

          {suggestedSession.exercises.map((ex) => {
            const midia = midiaPorExercicio[ex.exerciseId];
            return (
              <LinhaDeLista
                key={ex.id}
                midia={
                  midia ? (
                    midia.endsWith('.mp4') ? (
                      <video
                        src={midia}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <img src={midia} alt="" className="w-full h-full object-cover" />
                    )
                  ) : (
                    <Dumbbell className="w-5 h-5 text-foreground-subtle" />
                  )
                }
                titulo={ex.name}
                meta={`${ex.sets} séries · ${ex.reps} reps`}
              />
            );
          })}
        </motion.section>
      ) : null}

      {/* OS COMPLEMENTOS, EM UMA LINHA.
          Eram quatro cards empilhados, cada um com moldura, ícone e três linhas de texto —
          mais espaço que o treino em si. Viraram uma faixa rolável: o nome basta, porque quem
          procura mobilidade já sabe o que é mobilidade. */}
      <motion.nav variants={itemVariants} className="flex gap-2 overflow-x-auto barra-fina pb-2 mb-8 -mx-1 px-1">
        {activePlan?.cardioSession && (
          <AtalhoDaSessao
            href="/cardio"
            icone={<Timer className="w-4 h-4" />}
            quando="Depois"
            nome={activePlan.cardioSession.name}
          />
        )}
        <AtalhoDaSessao href="/mobilidade" icone={<Waves className="w-4 h-4" />} quando="Antes" nome="Mobilidade" />
        <AtalhoDaSessao href="/abdominal" icone={<Flame className="w-4 h-4" />} quando="No fim" nome="Abdominal" />
        <AtalhoDaSessao href="/alongamento" icone={<StretchHorizontal className="w-4 h-4" />} quando="Quando quiser" nome="Alongamento" />
      </motion.nav>

      {/* A SEMANA, EM NÚMEROS GRANDES.
          Eram quatro cards de métrica com ícone colorido, moldura e valor em 20px. O ícone
          não informava nada que o rótulo já não dissesse, e a moldura competia com o treino.
          Agora o número é o elemento, e a barra mostra a semana sem precisar de outro card. */}
      <motion.section variants={itemVariants} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <Rotulo as="h3">
            Esta semana
          </Rotulo>
          <Link href="/progress" className="text-xs text-foreground-muted hover:text-primary transition-colors">
            ver progresso
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-6">
          <Numero valor={currentWeekWorkouts.length.toString()} rotulo="treinos" />
          <Numero valor={totalVolume.toLocaleString('pt-BR')} unidade="kg" rotulo="levantados" />
          <Numero valor={streak.toString()} rotulo={streak === 1 ? 'dia seguido' : 'dias seguidos'} />
          <Numero valor={history.length.toString()} rotulo="no total" />
        </div>

        {/* A barra existe porque "2 treinos" sozinho não diz se é pouco ou muito. Contra a
            meta, diz. */}
        {metaSemanal > 0 && (
          <div className="mt-6">
            <div className="flex justify-between text-micro text-foreground-muted mb-2">
              <span>{currentWeekWorkouts.length} de {metaSemanal} na semana</span>
              <span className="tabular-nums">
                {Math.min(100, Math.round((currentWeekWorkouts.length / metaSemanal) * 100))}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-secondary to-primary transition-all duration-700"
                style={{ width: `${Math.min(100, (currentWeekWorkouts.length / metaSemanal) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </motion.section>

      {/* Avisa quantos dias faltam do teste. Não aparece para cortesia nem para assinatura
          ativa — `empty:hidden` tira o espaço quando o componente não renderiza nada. */}
      <motion.div variants={itemVariants} className="mb-6 empty:hidden">
        <AvisoDeAssinatura somenteUrgente />
      </motion.div>

      {/* No celular a barra inferior nao tem esta tela; sem o card o produto de maior
          valor ficaria sem porta de entrada. */}
      <motion.div variants={itemVariants} className="mb-8 empty:hidden">
        <CardPersonalizado />
      </motion.div>

      {/* RECUPERAÇÃO MUSCULAR, em faixa.
          Eram seis cards quadrados numa grade. A informação é um estado por músculo — um
          ponto colorido e um nome bastam, e numa linha dá para ler os seis de uma vez. */}
      <motion.section variants={itemVariants} className="mb-8">
        <Rotulo as="h3" className="mb-4">
          Recuperação muscular
        </Rotulo>
        <div className="flex gap-2 overflow-x-auto barra-fina pb-2 -mx-1 px-1">
          {['Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps', 'Pernas (quadríceps)'].map((muscle) => {
            const latestWorkout = [...history].sort((a, b) => b.date - a.date).find(h =>
              h.exercises.some(ex => ex.muscleGroup === muscle)
            );

            let statusColor = 'bg-success';
            let label = 'Recuperado';

            if (latestWorkout) {
              const diffHours = (now - latestWorkout.date) / (1000 * 60 * 60);
              if (diffHours < 24) {
                statusColor = 'bg-destructive';
                label = 'Em fadiga';
              } else if (diffHours < 48) {
                statusColor = 'bg-warning';
                label = 'Recuperando';
              }
            }

            return (
              <div
                key={muscle}
                className="flex items-center gap-2.5 px-3 py-2 rounded-full bg-surface border border-border shrink-0"
              >
                <span className={`w-2 h-2 rounded-full ${statusColor}`} aria-hidden="true" />
                <span className="text-sm whitespace-nowrap">
                  {muscle === 'Pernas (quadríceps)' ? 'Pernas' : muscle}
                </span>
                <span className="text-micro text-foreground-muted whitespace-nowrap">{label}</span>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* CONQUISTAS E DICA, abaixo da dobra.
          Estavam no topo, dividindo a primeira tela com o treino. Nenhum dos dois é motivo
          de alguém abrir o app — são recompensa e leitura, e ficam onde se lê depois. */}
      <motion.section variants={itemVariants} className="grid md:grid-cols-2 gap-5 mb-8">
        <div>
          <Rotulo as="h3" className="mb-4">
            Suas conquistas
          </Rotulo>
          {achievements.length > 0 ? (
            <div className="flex flex-col gap-2">
              {achievements.map((ach, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-surface border border-border">
                  <span className="shrink-0">{ach.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{ach.title}</p>
                    <p className="text-xs text-foreground-muted truncate">{ach.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground-muted">
              Conclua o primeiro treino para desbloquear.
            </p>
          )}
        </div>

        <div>
          <Rotulo as="h3" className="mb-4">
            Dica do dia
          </Rotulo>
          <div className="flex items-start gap-3 p-5 rounded-xl bg-primary/5 border border-primary/15">
            <Lightbulb className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed text-foreground/90">{dailyTip}</p>
          </div>
        </div>
      </motion.section>

      {/* O PLANO NA CONTA.
          Um só, de propósito: o aluno enxerga o ativo e nada mais. Quem troca é o
          profissional, pelo /admin/preview. */}
      {activePlan && (
        <motion.section variants={itemVariants}>
          <Rotulo as="h3" className="mb-4">
            Seu plano
          </Rotulo>
          <div className="flex flex-wrap items-center gap-4 p-5 rounded-xl bg-surface border border-border">
            <div className="min-w-0 flex-1">
              <p className="font-outfit font-bold truncate">{activePlan.name}</p>
              <p className="text-xs text-foreground-muted mt-0.5">
                {activePlan.split || `${activePlan.sessions.length} dias`} ·{' '}
                {activePlan.sessions.length} {activePlan.sessions.length === 1 ? 'treino' : 'treinos'}
              </p>
            </div>
            <button
              onClick={() => apagarPlano(activePlan)}
              className="p-3 rounded-lg text-foreground-muted hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
              aria-label={`Apagar ${activePlan.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </motion.section>
      )}
    </motion.div>
  );
}

/** Um complemento do treino, na faixa de atalhos. */
function AtalhoDaSessao({
  href,
  icone,
  quando,
  nome,
}: {
  href: string;
  icone: React.ReactNode;
  quando: string;
  nome: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border hover:border-primary/40 transition-colors shrink-0"
    >
      <span className="text-primary">{icone}</span>
      <span className="min-w-0">
        <span className="block text-nano font-semibold uppercase tracking-widest text-foreground-muted leading-none mb-1">
          {quando}
        </span>
        <span className="block text-sm font-medium whitespace-nowrap group-hover:text-primary transition-colors">
          {nome}
        </span>
      </span>
    </Link>
  );
}

/**
 * Um número da semana.
 *
 * Sem ícone e sem moldura, de propósito: o ícone colorido que havia antes não dizia nada que
 * o rótulo já não dissesse, e seis molduras numa faixa cancelam uma à outra. O que informa é
 * o número, então é ele que fica grande.
 */
function Numero({ valor, unidade, rotulo }: { valor: string; unidade?: string; rotulo: string }) {
  return (
    <div>
      <p className="text-2xl md:text-3xl font-outfit font-bold tabular-nums leading-none">
        {valor}
        {unidade && <span className="text-base font-medium text-foreground-muted ml-1">{unidade}</span>}
      </p>
      <p className="text-nano font-semibold uppercase tracking-widest text-foreground-muted mt-1.5">{rotulo}</p>
    </div>
  );
}
