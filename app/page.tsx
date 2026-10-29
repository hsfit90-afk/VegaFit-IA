"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Dumbbell, Flame, ChevronRight, Activity, Zap, LayoutList, PlayCircle, Timer , Waves, StretchHorizontal} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { motion, type Variants } from 'motion/react';
import { musculosEmFadiga, escolherSessao, sessaoSeguinte, minutosDaSessao } from '@/lib/proximoTreino';
import { diasSeguidos } from '@/lib/sequenciaDeTreinos';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinhaDeLista } from '@/components/ui/LinhaDeLista';
import { Rotulo } from '@/components/ui/Rotulo';
import { nomeDoMetodo } from '@/lib/metodosDeTreino';
import { AvisoDeAssinatura } from '@/components/AvisoDeAssinatura';
import { CardPersonalizado } from '@/components/CardPersonalizado';
import { PADDING_TELA, LARGURA_CONTEUDO, RODAPE_SEGURO } from '@/lib/layout';
import { createClient } from '@/utils/supabase/client';

export default function Dashboard() {
  // setActivePlan NÃO entra aqui: o dashboard mostra só o plano ativo, sem seletor. Estava
  // sendo desestruturado sem nunca ser chamado, e foi o que me fez afirmar que o aluno
  // trocava de treino — ele não troca. Quem troca é o profissional, pelo /admin/preview.
  const { profile, history, workoutPlans, activePlanId, currentSessionIndex } = useAppContext();
  const router = useRouter();
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

  // Removed strict redirect so trainers can also use their own dashboard for working out.
  // Trainers have "Meus Alunos" in the navigation if they want to manage clients.
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
  // A conta mora em lib/sequenciaDeTreinos.ts desde 29/10/2026: o Progresso precisa da mesma,
  // para as conquistas, e duas cópias dariam duas respostas possíveis para "dias seguidos".
  const streak = useMemo(() => diasSeguidos(history, now), [history, now]);



  /** Data por extenso no cabeçalho: dá contexto sem gastar uma faixa da tela. */
  const hoje = () =>
    new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

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

  /**
   * As três informações que o cartão não dava: nível, equipamento e estrutura.
   *
   * Os dois números grandes acima respondem "quanto tem" e "quanto demora". Faltava o que
   * o aluno pergunta logo depois: é para quem? com o quê? como é o treino?
   *
   * MONTADA COM O QUE EXISTE, SEM CHUTE. Item sem dado sai da lista em vez de aparecer vazio
   * ou com um traço: plano antigo não guarda método, e dizer "Tradicional" por padrão seria
   * descrever ao aluno um treino que ele não recebeu (ver lib/metodosDeTreino.ts).
   *
   * Por isso a linha some inteira quando nada sobra — é o caso do plano montado à mão pelo
   * profissional, que não passa pelo gerador.
   */
  const metaDoTreino = [
    profile?.level ? { Icone: Activity, texto: profile.level } : null,
    activePlan?.equipment ? { Icone: Dumbbell, texto: activePlan.equipment } : null,
    nomeDoMetodo(activePlan?.trainingMethod)
      ? { Icone: LayoutList, texto: nomeDoMetodo(activePlan?.trainingMethod)! }
      : null,
  ].filter((i): i is { Icone: typeof Activity; texto: string } => i !== null);

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
              <div className="flex items-end gap-8 mb-4">
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

              {/* Nível, equipamento e estrutura, em uma linha só.

                  Quebra em duas no celular estreito (flex-wrap) em vez de cortar o texto:
                  "Academia completa" não cabe ao lado de "Intermediário" em tela de 360px, e
                  truncar aqui esconderia justamente a palavra que diferencia os planos. */}
              {metaDoTreino.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-7">
                  {metaDoTreino.map(({ Icone, texto }) => (
                    <span key={texto} className="inline-flex items-center gap-1.5 text-micro text-foreground-muted">
                      <Icone className="w-3.5 h-3.5 shrink-0 text-foreground-subtle" />
                      {texto}
                    </span>
                  ))}
                </div>
              )}

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
