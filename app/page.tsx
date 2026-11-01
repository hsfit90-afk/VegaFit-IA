"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { Dumbbell, Flame, ChevronRight, Activity, Zap, LayoutList, PlayCircle, Timer, Waves, StretchHorizontal, TrendingUp, TrendingDown, Scale, Shuffle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { motion, type Variants } from 'motion/react';
import { musculosEmFadiga, escolherSessao, sessaoSeguinte, minutosDaSessao } from '@/lib/proximoTreino';
import { diasSeguidos } from '@/lib/sequenciaDeTreinos';
import { letraDaSessao, semanaDoAluno, cargaDaSemana, treinosNoMes, pesoAtual } from '@/lib/painelDeHoje';
import { FaixaDaSemana } from '@/components/ui/FaixaDaSemana';
import { Rotulo } from '@/components/ui/Rotulo';
import { nomeDoMetodo } from '@/lib/metodosDeTreino';
import { AvisoDeAssinatura } from '@/components/AvisoDeAssinatura';
import { CardPersonalizado } from '@/components/CardPersonalizado';
import { PADDING_TELA, LARGURA_CONTEUDO, RODAPE_SEGURO } from '@/lib/layout';
import { createClient } from '@/utils/supabase/client';

/**
 * REDESENHADA EM 31/10/2026 — e o que mudou foi só a camada visual.
 *
 * A estrutura nova é a da direção "Pulso": o treino de hoje num cartão inteiro na cor de
 * marca, a semana em sete quadrados, e um resumo de três números. A lógica de qual treino
 * aparece, de fadiga, de rotação e de mídia é a MESMA, linha por linha — tudo o que decide
 * prescrição continua em `lib/proximoTreino.ts`, como desde 19/10/2026.
 *
 * O QUE O DESENHO PEDIA E NÃO ENTROU, PORQUE O DADO NÃO EXISTE
 *
 * - **Meta de peso.** Não há campo de meta no perfil nem no banco. O peso atual entra; a meta
 *   não, porque mostrar um alvo que ninguém definiu é inventar informação.
 * - **Dia de descanso na semana.** O app não guarda calendário de descanso. O quarto estado da
 *   faixa é "sem treino", que é o que o dado diz. Ver `lib/painelDeHoje.ts`.
 * - **"Última vez" em cada exercício.** Exigiria uma consulta nova ao banco, e o pedido era
 *   explicitamente não mexer em consulta.
 *
 * A COR CONTINUA A DE CASA. A direção Pulso vinha com um limão #C6F432; o profissional
 * escolheu manter o verde #05D590 da reforma de 28/10/2026, para o app seguir sendo um só.
 * O que veio da direção é a FORMA: cartão cheio, raios maiores, Unbounded nos números.
 */
export default function Dashboard() {
  // setActivePlan NÃO entra aqui: o dashboard mostra só o plano ativo, sem seletor. Estava
  // sendo desestruturado sem nunca ser chamado, e foi o que me fez afirmar que o aluno
  // trocava de treino — ele não troca. Quem troca é o profissional, pelo /admin/preview.
  //
  // `bodyWeightHistory` entrou em 31/10/2026 para o resumo mostrar o peso atual. É leitura de
  // um campo que o contexto JÁ carrega (AppContext.tsx:228) — nenhuma consulta nova.
  const { profile, history, workoutPlans, activePlanId, currentSessionIndex, bodyWeightHistory } = useAppContext();
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

  /** A semana e o resumo. Contas puras, testadas em tests/painelDeHoje.test.ts. */
  const semana = useMemo(() => semanaDoAluno(history, now), [history, now]);
  const cargaSemana = useMemo(() => cargaDaSemana(history, now), [history, now]);
  const mes = useMemo(() => treinosNoMes(history, now), [history, now]);

  /**
   * O peso do check-in, com o da anamnese como reserva.
   *
   * `bodyWeightHistory` é o peso que o aluno registra no Check-in e é o número atual.
   * `profile.weight` é o que ele declarou na anamnese — fica velho, mas é um peso real que a
   * pessoa informou, e é melhor que esconder o bloco de quem nunca abriu o Check-in.
   */
  const peso = pesoAtual(bodyWeightHistory) ?? (profile?.weight && profile.weight > 0 ? profile.weight : null);

  /** Data por extenso no cabeçalho: dá contexto sem gastar uma faixa da tela. */
  const hoje = () =>
    new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  /**
   * A mídia dos exercícios do treino de hoje, para a miniatura de cada linha.
   *
   * Continua UMA consulta, com `.in` e os ids da sessão — tipicamente 5 a 8, nunca o catálogo
   * de 882. Falhar aqui não quebra nada: sem mídia, a linha mostra um ícone.
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

  /**
   * A letra do treino, separada do nome.
   *
   * O nome já vem como "Treino A - Peito e Tríceps" tanto da IA quanto do plano montado à
   * mão. A letra sai do NOME e não do índice: com o Treino A pulado por fadiga, o índice
   * exibido daria "A" em cima do nome "Treino B". Ver lib/painelDeHoje.ts.
   */
  const { letra, titulo } = letraDaSessao(suggestedSession?.name, displaySessionIndex);

  /**
   * As três informações de contexto do treino: nível, equipamento e estrutura.
   *
   * MONTADA COM O QUE EXISTE, SEM CHUTE. Item sem dado sai da lista em vez de aparecer vazio
   * ou com um traço: plano antigo não guarda método, e dizer "Tradicional" por padrão seria
   * descrever ao aluno um treino que ele não recebeu (ver lib/metodosDeTreino.ts).
   */
  const metaDoTreino = [
    profile?.level ? { Icone: Activity, texto: profile.level } : null,
    activePlan?.equipment ? { Icone: Dumbbell, texto: activePlan.equipment } : null,
    nomeDoMetodo(activePlan?.trainingMethod)
      ? { Icone: LayoutList, texto: nomeDoMetodo(activePlan?.trainingMethod)! }
      : null,
  ].filter((i): i is { Icone: typeof Activity; texto: string } => i !== null);

  /** Os três primeiros exercícios aparecem no cartão; o resto vira uma contagem. */
  const exercicios = suggestedSession?.exercises ?? [];
  const primeiros = exercicios.slice(0, 3);
  const quantosFaltam = Math.max(0, exercicios.length - primeiros.length);

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
      className={`${PADDING_TELA} ${LARGURA_CONTEUDO} mx-auto min-h-screen ${RODAPE_SEGURO} font-manrope`}
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
          <h1 className="text-2xl md:text-3xl font-unbounded font-medium tracking-tight truncate">
            {greeting()}, <span className="text-primary">{profile?.name || 'Atleta'}</span>
          </h1>
        </div>

        {streak > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface border border-border shrink-0">
            <Flame className="w-4 h-4 text-flame" aria-hidden="true" />
            <span className="text-sm font-bold tabular-nums">{streak}</span>
            <span className="text-xs text-foreground-muted">{streak === 1 ? 'dia' : 'dias'}</span>
          </div>
        )}
      </motion.header>

      {/* O TREINO DE HOJE, NA COR DA MARCA E EM TELA CHEIA.

          A direção Pulso pinta este cartão inteiro de destaque, e é a decisão mais forte do
          desenho: o aluno abre o app para saber o que treinar hoje, e agora a primeira coisa
          que a vista pega é um bloco verde, não mais um cartão escuro entre outros cartões
          escuros.

          O texto sobre o verde é PRETO, e isso é medido: #000 sobre #05D590 dá 10,93:1, contra
          1,9:1 que o branco daria. Verde de marca não aceita texto branco — é a armadilha mais
          comum de botão colorido. O apoio usa preto a 70%, que ainda dá 6,18:1.

          O GIF DE FUNDO SAIU. Ele existia porque o cartão era escuro e o vídeo aparecia por
          baixo de um gradiente; sobre o verde não há como manter contraste de texto com um
          vídeo qualquer atrás. As miniaturas continuam, agora dentro da lista do próprio
          cartão — que é onde elas informam mais, ao lado de séries e repetições. */}
      <motion.section variants={itemVariants} className="mb-5">
        {activePlan ? (
          <div className="rounded-cartao bg-primary text-primary-foreground overflow-hidden shadow-[0_12px_40px_rgb(var(--color-primary-rgb)/0.25)]">
            <div className="p-5 md:p-8">
              {wasRedirectedDueToFatigue && (
                <div className="flex items-start gap-2 mb-4">
                  <Flame className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-black/75">
                    <span className="font-bold text-black">Treino trocado.</span>{' '}
                    {originalSession?.name} usa músculo que ainda está se recuperando.
                  </p>
                </div>
              )}

              <p className="text-nano font-semibold uppercase tracking-widest text-black/65 mb-3">
                {wasRedirectedDueToFatigue ? 'Sugestão de hoje' : 'Seu treino de hoje'}
              </p>

              {/* A LETRA E O NOME, LADO A LADO.
                  Até aqui o cartão mostrava "Treino A - Peito e Tríceps" numa linha só, e a
                  letra — que é como o aluno chama o treino em voz alta — ficava perdida no
                  meio da frase. Agora ela é o objeto maior da tela e o nome é o subtítulo. */}
              <div className="flex items-start gap-4 mb-5">
                <span
                  aria-hidden="true"
                  className="shrink-0 w-14 h-14 md:w-16 md:h-16 grid place-items-center rounded-bloco bg-black/15 font-unbounded font-bold text-3xl md:text-4xl leading-none"
                >
                  {letra}
                </span>

                <div className="min-w-0 pt-0.5">
                  {titulo ? (
                    <h2 className="text-2xl md:text-4xl font-unbounded font-bold leading-[1.1] tracking-tight">
                      {titulo}
                    </h2>
                  ) : (
                    <h2 className="text-2xl md:text-4xl font-unbounded font-bold leading-[1.1] tracking-tight">
                      Treino {letra}
                    </h2>
                  )}

                  <p className="text-sm font-semibold text-black/70 mt-1.5 tabular-nums">
                    {minutosDaSessao(suggestedSession)} min · {exercicios.length}{' '}
                    {exercicios.length === 1 ? 'exercício' : 'exercícios'}
                  </p>
                </div>
              </div>

              {/* Nível, equipamento e estrutura. Quebra em duas linhas no celular estreito em
                  vez de cortar o texto: "Academia completa" não cabe ao lado de
                  "Intermediário" em tela de 360px. */}
              {metaDoTreino.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-5">
                  {metaDoTreino.map(({ Icone, texto }) => (
                    <span key={texto} className="inline-flex items-center gap-1.5 text-micro font-medium text-black/70">
                      <Icone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      {texto}
                    </span>
                  ))}
                </div>
              )}

              {/* OS TRÊS PRIMEIROS EXERCÍCIOS, COM A MINIATURA DO VÍDEO.

                  São 882 exercícios com vídeo no catálogo, o ativo mais forte do produto. Aqui
                  eles entram com séries × repetições ao lado, que é a informação que faz o
                  aluno decidir se tem tempo agora.

                  A lista NÃO é clicável: é prévia, e o único destino possível seria a própria
                  tela de treino, que o botão abaixo já abre.

                  Os que passam de três viram uma contagem em vez de desaparecerem calados. */}
              {primeiros.length > 0 && (
                <ul className="mb-6 divide-y divide-black/10 border-y border-black/10">
                  {primeiros.map(ex => {
                    const midia = midiaPorExercicio[ex.exerciseId];
                    return (
                      <li key={ex.id} className="flex items-center gap-3 py-2.5">
                        <span className="w-11 h-11 shrink-0 rounded-dia bg-black/15 overflow-hidden grid place-items-center">
                          {midia ? (
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
                            <Dumbbell className="w-5 h-5" aria-hidden="true" />
                          )}
                        </span>

                        <span className="flex-1 min-w-0 text-sm font-semibold truncate">
                          {ex.name}
                        </span>

                        <span className="shrink-0 text-sm font-bold tabular-nums text-black/70">
                          {ex.sets} × {ex.reps}
                        </span>
                      </li>
                    );
                  })}

                  {quantosFaltam > 0 && (
                    <li className="py-2.5 text-micro font-semibold text-black/60">
                      e mais {quantosFaltam} {quantosFaltam === 1 ? 'exercício' : 'exercícios'} no treino
                    </li>
                  )}
                </ul>
              )}

              {/* O BOTÃO É PRETO SOBRE O VERDE, com o texto na cor da marca.
                  Invertido assim ele continua sendo a coisa mais clicável do cartão mesmo
                  estando dentro de um bloco todo colorido — um botão verde sobre fundo verde
                  desapareceria. */}
              <button
                onClick={() => router.push(`/active?sessionIndex=${displaySessionIndex}`)}
                className="group w-full min-h-[56px] inline-flex items-center justify-center gap-2 rounded-bloco bg-background-deep text-primary font-unbounded font-bold text-base tracking-tight transition-colors duration-[120ms] hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              >
                <PlayCircle className="w-5 h-5" aria-hidden="true" />
                Iniciar treino
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </button>

              {/* AS DUAS AÇÕES SECUNDÁRIAS VIRARAM PÍLULAS CONTORNADAS (01/11/2026).

                  Eram links de texto em preto a 70%, com sublinhado só no hover. Sobre um
                  cartão inteiro de cor, texto escuro lê como FRASE, não como coisa clicável —
                  e "Gerar um treino novo" existe justamente porque no celular não havia
                  nenhum outro caminho até o gerador. Passar despercebido ali custa caro.

                  CONTORNO A 55%, E O NÚMERO FOI MEDIDO. A vontade era um contorno discreto,
                  tipo preto/25. Não serve: sobre o verde isso dá 1,75:1, e a WCAG pede 3:1
                  para a borda de um controle ser perceptível. Preto/50 é onde cruza (3,44:1)
                  e preto/55 dá 3,98:1, com folga e sem ficar pesado. Fundo preto/10 também
                  foi descartado: 1,24:1, ou seja, invisível.

                  O texto subiu de preto/70 para preto cheio: 6,18 -> 10,93:1.

                  A HIERARQUIA FICA CLARA: o principal é preenchido de preto, estes dois são
                  contornados. Mesma família, um degrau abaixo — em vez de três pesos
                  diferentes disputando a mesma área. */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {activePlan.sessions.length > 1 && (
                  <button
                    onClick={cycleNextSession}
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-dia border border-black/55 text-sm font-semibold text-black transition-colors duration-[120ms] hover:bg-black/10 hover:border-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                  >
                    <Shuffle className="w-4 h-4" aria-hidden="true" />
                    Ver outro treino
                  </button>
                )}

                {/* QUEM JÁ TEM TREINO NÃO TINHA COMO PEDIR OUTRO, NO CELULAR.
                    Os três links para /generator estavam todos dentro de estado vazio, e o
                    quarto caminho é a barra lateral, que é `hidden md:flex`. Fica aqui, e não
                    como sexta aba do rodapé, que não cabe em tela de 360px. */}
                <Link
                  href="/generator"
                  className="inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-dia border border-black/55 text-sm font-semibold text-black transition-colors duration-[120ms] hover:bg-black/10 hover:border-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                >
                  <Zap className="w-4 h-4" aria-hidden="true" />
                  Gerar um treino novo
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-cartao border border-dashed border-border p-8 text-center">
            <Zap className="w-10 h-10 text-primary/40 mx-auto mb-4" aria-hidden="true" />
            <h2 className="text-xl font-unbounded font-bold mb-2">Você ainda não tem um treino</h2>
            <p className="text-sm text-foreground-muted mb-5 max-w-sm mx-auto">
              A IA monta um plano a partir da sua anamnese: seu objetivo, seu nível e o que
              você tem disponível para treinar.
            </p>
            <Link href="/generator">
              <Button size="lg">
                GERAR MEU TREINO
                <Zap className="w-5 h-5 ml-2" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        )}
      </motion.section>

      {/* SUA SEMANA, EM SETE QUADRADOS.
          Responde "como foi a minha semana" sem abrir o Progresso. Dois quadrados acesos
          seguidos e um apagado no meio dizem mais sobre constância que o número "3 treinos". */}
      <motion.section variants={itemVariants} className="mb-5 p-4 md:p-5 rounded-bloco bg-surface border border-border">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <Rotulo as="h2">Sua semana</Rotulo>
          <p className="text-micro font-semibold text-foreground-muted tabular-nums">
            {semana.filter(d => d.treinou).length} de 7 dias
          </p>
        </div>
        <FaixaDaSemana dias={semana} />
      </motion.section>

      {/* O RESUMO, EM TRÊS NÚMEROS.
          Não é o painel de métricas que saiu daqui em 29/10/2026 — aqueles quatro blocos
          continuam no Progresso. São três números numa faixa, que é o que cabe numa tela cujo
          protagonista é o treino de hoje.

          Item sem dado SAI da faixa: quem nunca registrou peso não vê um "0 kg". */}
      <motion.section variants={itemVariants} className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <Numero
          rotulo="Carga na semana"
          valor={cargaSemana > 0 ? cargaSemana.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—'}
          unidade={cargaSemana > 0 ? 'kg' : undefined}
        />

        <Numero
          rotulo="Treinos no mês"
          valor={String(mes.esteMes)}
          /* A variação só aparece depois da primeira semana do mês: no dia 3, comparar com um
             mês inteiro é honesto e enganoso ao mesmo tempo. */
          nota={
            mes.diasDeMes >= 7 && mes.variacao !== 0
              ? { texto: `${mes.variacao > 0 ? '+' : ''}${mes.variacao} vs. mês passado`, sobe: mes.variacao > 0 }
              : undefined
          }
        />

        {peso !== null && (
          <Numero
            rotulo="Peso atual"
            valor={peso.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
            unidade="kg"
            Icone={Scale}
          />
        )}
      </motion.section>

      {/* OS COMPLEMENTOS, EM UMA LINHA.
          Eram quatro cards empilhados, cada um com moldura, ícone e três linhas de texto —
          mais espaço que o treino em si. Viraram uma faixa rolável: o nome basta, porque quem
          procura mobilidade já sabe o que é mobilidade. */}
      <motion.nav variants={itemVariants} className="flex gap-2 overflow-x-auto barra-fina pb-2 mb-8 -mx-1 px-1">
        {activePlan?.cardioSession && (
          <AtalhoDaSessao
            href="/cardio"
            icone={<Timer className="w-4 h-4" aria-hidden="true" />}
            quando="Depois"
            nome={activePlan.cardioSession.name}
          />
        )}
        <AtalhoDaSessao href="/mobilidade" icone={<Waves className="w-4 h-4" aria-hidden="true" />} quando="Antes" nome="Mobilidade" />
        <AtalhoDaSessao href="/abdominal" icone={<Flame className="w-4 h-4" aria-hidden="true" />} quando="No fim" nome="Abdominal" />
        <AtalhoDaSessao href="/alongamento" icone={<StretchHorizontal className="w-4 h-4" aria-hidden="true" />} quando="Quando quiser" nome="Alongamento" />
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

/**
 * Um número do resumo.
 *
 * O número vem em Unbounded e tabular: tabular porque ele muda sozinho (a carga da semana
 * sobe a cada treino) e sem largura fixa de dígito o bloco inteiro dança a cada atualização.
 */
function Numero({
  rotulo,
  valor,
  unidade,
  nota,
  Icone,
}: {
  rotulo: string;
  valor: string;
  unidade?: string;
  nota?: { texto: string; sobe: boolean };
  Icone?: typeof Scale;
}) {
  return (
    <div className="p-4 rounded-bloco bg-surface border border-border">
      <div className="flex items-center gap-1.5 mb-2">
        {Icone && <Icone className="w-3.5 h-3.5 text-foreground-subtle shrink-0" aria-hidden="true" />}
        <Rotulo>{rotulo}</Rotulo>
      </div>

      <p className="font-unbounded font-bold text-2xl md:text-3xl leading-none tabular-nums">
        {valor}
        {unidade && <span className="text-sm font-medium text-foreground-muted ml-1">{unidade}</span>}
      </p>

      {nota && (
        <p
          className={`flex items-center gap-1 text-micro font-semibold mt-2 tabular-nums ${
            nota.sobe ? 'text-primary' : 'text-foreground-muted'
          }`}
        >
          {nota.sobe ? (
            <TrendingUp className="w-3 h-3 shrink-0" aria-hidden="true" />
          ) : (
            <TrendingDown className="w-3 h-3 shrink-0" aria-hidden="true" />
          )}
          {nota.texto}
        </p>
      )}
    </div>
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
      className="group flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-bloco bg-surface border border-border hover:border-primary/40 transition-colors shrink-0"
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
