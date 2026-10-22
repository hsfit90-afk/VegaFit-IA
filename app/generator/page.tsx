"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '@/app/context/AppContext';
import { computeUnlock, textoBloqueio, type MethodId } from '@/lib/trainingUnlock';
import { Zap } from 'lucide-react';
import { Exercise as DbExercise } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { getExercises } from '@/lib/db/exercises';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getHistorical1RM, calculateTargetWeight } from '@/utils/loadCalculator';
import { mapAnamneseLocationToEquipment, treinaEmCasa } from '@/lib/trainingLocation';
import { tratarBloqueioDeAssinatura } from "@/utils/assinatura";
import Link from 'next/link';
import { LIMITE_PREFERENCIAS } from '@/lib/aiHealthContext';
import { faltamEssenciais, ROTULO_ESSENCIAL } from '@/lib/anamneseEssencial';
import { createClient } from '@/utils/supabase/client';
import { traduzirErro } from '@/utils/mensagensDeErro';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PADDING_TELA, LARGURA_FOCO, RODAPE_SEGURO } from '@/lib/layout';

export default function Generator() {
  const { addWorkoutPlan, profile, history, atualizarLocalDeTreino } = useAppContext();

  /**
   * Local escolhido aqui que ainda não vale, esperando confirmação.
   *
   * O seletor abaixo oferecia "Academia completa" e o servidor descartava em silêncio: o
   * perfil ganha do corpo da requisição (lib/localEfetivo.ts, para que ninguém em casa receba
   * Leg Press). Quem marcasse academia recebia o treino de casa sem explicação nenhuma — foi
   * a primeira coisa que o profissional estranhou ao testar.
   *
   * Em vez de afrouxar a trava, a escolha vai para o perfil, que é a fonte da verdade. Aí não
   * sobra contradição para o servidor resolver.
   */
  const [localPendente, setLocalPendente] = useState<string | null>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Db exercises para cruzar nomes com IDs reais
  const [dbExercises, setDbExercises] = useState<DbExercise[]>([]);

  useEffect(() => {
    getExercises().then(setDbExercises);
  }, []);

  /**
   * A anamnese mais recente, só para saber o que ainda falta.
   *
   * Vem do histórico e não das colunas do perfil porque objetivo e nível também são
   * preenchidos no onboarding: quem passou só por ele teria os dois, e o portão deixaria
   * passar sem nunca ter perguntado sobre LESÃO — que é a resposta de segurança.
   *
   * Fica nulo enquanto carrega, para o portão não piscar na tela de quem já respondeu.
   */
  const [respostas, setRespostas] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('anamnese_history')
        .select('answers')
        .order('created_at', { ascending: false })
        .limit(1);
      setRespostas(data?.[0]?.answers ?? {});
    })();
  }, []);

  const faltam = respostas === null ? [] : faltamEssenciais(respostas);

  const TRAINING_METHODS = [
    { id: 'tradicional', label: 'Tradicional', icon: '🏋️', desc: 'Séries e repetições padrão com descanso entre séries' },
    { id: 'superset', label: 'Superset', icon: '⚡', desc: 'Dois exercícios alternados sem descanso entre eles' },
    { id: 'drop_set', label: 'Drop Set', icon: '📉', desc: 'Reduz a carga ao falhar para continuar a série' },
    { id: 'piramide', label: 'Pirâmide', icon: '🔺', desc: 'Aumenta a carga e reduz reps a cada série' },
    { id: 'rest_pause', label: 'Rest-Pause', icon: '⏸️', desc: 'Microdescansos dentro da própria série' },
    { id: 'circuito', label: 'Circuito', icon: '🔄', desc: 'Exercícios em sequência com mínimo descanso' },
  ];

  const [form, setForm] = useState({
    goal: profile?.goal || 'Hipertrofia',
    level: profile?.level || 'Intermediário',
    daysPerWeek: 4,
    duration: 60,
    equipment: mapAnamneseLocationToEquipment(profile?.trainingLocation),
    priorities: [] as string[],
    // NÃO vem de profile.intent: aquele campo guarda o TEXTO INTEIRO da anamnese
    // ("*ANAMNESE DE TREINO* — SEU OBJETIVO — ..."), não o que o aluno quer dizer. Ele
    // aparecia aqui pré-preenchido, o aluno nunca escrevia nada de si, e o teto de 600
    // caracteres ainda cortava o despejo no meio — o Joel perdia 667 caracteres.
    //
    // A anamnese continua chegando à IA, pelo bloco estruturado de saúde que a rota monta a
    // partir de anamnese_history. Este campo é só para o que ela não pergunta.
    limitations: '',
    trainingMethod: 'tradicional',
  });

  /**
   * SINCRONIZA O FORMULÁRIO QUANDO O PERFIL CHEGA.
   *
   * O bug que isto corrige, achado em 15/10/2026 olhando planos reais: o perfil dizia "Em
   * casa" e o treino saía com Leg Press, Mesa flexora e Cadeira extensora.
   *
   * A cadeia era esta. O `useState` acima roda na MONTAGEM, e nessa hora `profile` ainda é
   * null — o AppContext busca do Supabase de forma assíncrona. Então o campo nascia em
   * "Academia completa" (o padrão de mapAnamneseLocationToEquipment para entrada vazia), o
   * perfil chegava depois e nada corrigia o formulário. O aluno clicava em gerar e o corpo da
   * requisição levava "Academia completa" EXPLÍCITO.
   *
   * E por isso a rede de segurança da rota não salvava: ela só busca o local no banco quando
   * `config.equipment` vem vazio, e aqui vinha preenchido com o valor errado. Uma rede de
   * segurança embaixo do lugar errado.
   *
   * SÓ HIDRATA UMA VEZ, e só o que o aluno ainda não tocou: sincronizar a cada render
   * desfaria a escolha dele no meio do preenchimento. `hidratado` é a trava.
   */
  const [hidratado, setHidratado] = useState(false);
  useEffect(() => {
    if (hidratado || !profile) return;
    setForm(prev => ({
      ...prev,
      goal: profile.goal || prev.goal,
      level: profile.level || prev.level,
      equipment: mapAnamneseLocationToEquipment(profile.trainingLocation),
      // limitations fica de fora: é do aluno, não do perfil. Ver o comentário acima.
    }));
    setHidratado(true);
  }, [profile, hidratado]);

  // Métodos liberados pela constância real do aluno (lib/trainingUnlock.ts). O master vê tudo,
  // pra conseguir testar os métodos sem esperar 6 meses.
  const unlock = useMemo(
    () => computeUnlock(history || [], Date.now(), profile?.role),
    [history, profile?.role]
  );

  // Salvaguarda: se um método deixou de estar liberado (ex: plano antigo, reset de histórico),
  // volta pro tradicional em vez de mandar pro gerador um método que o aluno não pode usar.
  useEffect(() => {
    if (!unlock.liberados.includes(form.trainingMethod as MethodId)) {
      setForm(prev => ({ ...prev, trainingMethod: 'tradicional' }));
    }
  }, [unlock, form.trainingMethod]);

  const handlePriorityToggle = (muscle: string) => {
    setForm(prev => {
      if (prev.priorities.includes(muscle)) {
        return { ...prev, priorities: prev.priorities.filter(p => p !== muscle) };
      }
      return { ...prev, priorities: [...prev.priorities, muscle] };
    });
  };

  /**
   * Mínimo de texto no campo de intenção.
   *
   * Decisão do profissional (CREF, 15/10/2026): não gerar treino sem o aluno escrever nada
   * ali. A anamnese responde o que o app pergunta; este campo é o único lugar onde ele conta
   * o que ninguém perguntou — horário, tempo real, o que odeia, o que quer voltar a
   * conseguir. Gerar sem isso devolve um treino genérico, que é o que o app existe para não
   * ser.
   *
   * Vinte caracteres, e não "não vazio": um ponto ou um "ok" passariam numa checagem de
   * vazio e não informam nada. Vinte é uma frase curta — "treino 6h antes do trabalho" tem
   * vinte e seis.
   */
  const MINIMO_DE_INTENCAO = 20;
  const intencaoCurta = form.limitations.trim().length < MINIMO_DE_INTENCAO;

  /**
   * Se o aluno já tentou gerar e foi barrado.
   *
   * Existe porque a primeira versão disto, de 15/10/2026, era inutilizável: a mensagem de
   * erro renderiza no TOPO do formulário e o campo fica no fim, e eu rolava a tela até o
   * campo. O aluno clicava em "Gerar", a tela se mexia e ele não via mensagem nenhuma — o
   * app parecia simplesmente não responder. Nenhuma tentativa chegou sequer ao servidor.
   *
   * A mensagem agora nasce ao lado do campo, onde a pessoa está olhando.
   */
  const [tentouGerar, setTentouGerar] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (intencaoCurta) {
      setTentouGerar(true);
      document.getElementById('limitacoes')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('limitacoes')?.focus();
      return;
    }
    setTentouGerar(false);

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/treino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: profile?.geminiApiKey,
          profile,
          config: form
        })
      });

      const data = await res.json();

      if (tratarBloqueioDeAssinatura(res, data)) return;
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar treino');

      // BUG FIX: Validação do schema do JSON retornado pela IA
      if (!data.sessions || !Array.isArray(data.sessions) || data.sessions.length === 0) {
        throw new Error('A IA não gerou sessões de treino válidas. Por favor, tente novamente.');
      }

      // BUG FIX: Fallback para exercícios inventados pela IA
      // Se a IA criar um exercício que não existe na biblioteca, buscamos um real do mesmo músculo
      const findFallbackExercise = (muscleGroup: string, excludeName: string): DbExercise | null => {
        const normalize = (s: string) => s ? s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() : '';
        const targetMuscle = normalize(muscleGroup);
        if (!targetMuscle || targetMuscle === 'geral') return null;
        return dbExercises.find(dbEx =>
          normalize(dbEx.muscleGroup) === targetMuscle &&
          dbEx.name.trim().toLowerCase() !== excludeName.trim().toLowerCase()
        ) || null;
      };

      // Cruza os nomes da IA com a biblioteca local para obter os IDs reais
      const plan = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        trainingMethod: form.trainingMethod,
        equipment: form.equipment,
        sessions: data.sessions.map((session: any) => ({
          ...session,
          id: crypto.randomUUID(),
          exercises: session.exercises.map((ex: any) => {
            // Tenta encontrar por nome exato
            const matchedDbEx = dbExercises.find((dbEx: DbExercise) =>
              dbEx.name.trim().toLowerCase() === ex.name.trim().toLowerCase()
            );

            if (matchedDbEx) {
              // Exercício encontrado na biblioteca
              return {
                ...ex,
                id: crypto.randomUUID(),
                exerciseId: matchedDbEx.id,
                muscleGroup: matchedDbEx.muscleGroup
              };
            }

            // BUG FIX: A IA inventou um exercício — tenta substituir por um real do mesmo músculo
            const fallback = findFallbackExercise(ex.muscleGroup || '', ex.name);
            if (fallback) {
              console.warn(`[VegaFit] IA inventou "${ex.name}" (não encontrado na biblioteca). Substituindo por "${fallback.name}" (${fallback.muscleGroup}).`);
              return {
                ...ex,
                id: crypto.randomUUID(),
                exerciseId: fallback.id,
                name: fallback.name,
                muscleGroup: fallback.muscleGroup
              };
            }

            // Ültimo recurso: exerce o plano sem ID válido (custom)
            console.warn(`[VegaFit] Não foi possível encontrar substituto para "${ex.name}" (músculo: ${ex.muscleGroup}).`);
            return {
              ...ex,
              id: crypto.randomUUID(),
              exerciseId: 'custom-' + crypto.randomUUID(),
              muscleGroup: ex.muscleGroup || 'Desconhecido'
            };
          }).map((ex: any) => {
            // BUG FIX / FEATURE: Calcular a carga exata baseada nos protocolos científicos
            // Pega o nome do exercício (pode ter vindo da IA ou do fallback)
            const resolvedName = ex.name;
            
            // Procura o 1RM histórico
            const oneRM = getHistorical1RM(history || [], resolvedName);
            
            if (oneRM > 0) {
              const setsCount = typeof ex.sets === 'number' ? ex.sets : 3;
              // A IA retorna a string `reps` (ex: "10-12"). Pegamos o maior número
              const maxRepsStr = ex.reps?.toString().split('-').pop();
              const targetReps = parseInt(maxRepsStr) || 10;
              
              const calculatedWeight = calculateTargetWeight(oneRM, form.goal, targetReps);
              
              // Preenche targetWeights se já houver um RM calculado
              if (calculatedWeight > 0) {
                ex.targetWeights = Array(setsCount).fill(calculatedWeight);
              }
            }

            return ex;
          })
        }))
      };

      // Salva e vai direto para treinar — sem prévia desnecessária
      addWorkoutPlan(plan);
      router.push('/active');
    } catch (err: unknown) {
      // A rota de geração já responde em português; o padrão preserva essa mensagem. O
      // tradutor entra para o que ela não cobre — perder o sinal no meio de uma geração de
      // 40 segundos é o caso mais provável aqui.
      setError(traduzirErro(err, err instanceof Error ? err.message : undefined));
      setLoading(false);
    }
  };

  return (
    <div className={`${PADDING_TELA} ${LARGURA_FOCO} mx-auto animate-fade-in ${RODAPE_SEGURO}`}>
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-outfit font-bold flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl backdrop-blur-md border border-border">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          Gerador de Treino IA
        </h1>
        <p className="text-foreground-muted mt-2">
          Configure e gere seu treino. Após gerar, você irá direto para treinar!
        </p>
      </header>

      {/* O PORTÃO.
          Medido em 11/10/2026: 1 de 13 pessoas tinha preenchido a anamnese, e as outras doze
          geraram treino com o app adivinhando local, equipamento, objetivo, nível e lesão —
          ou seja, todo o filtro de segurança rodava vazio. Pedir antes de gerar é o único
          momento em que a pessoa tem motivo para responder: ela quer o treino agora.

          Três perguntas, não as quarenta e oito. O resto fica para depois. */}
      {faltam.length > 0 && (
        <Card className="mb-6 border-warning/40">
          <CardContent className="p-5">
            <h2 className="font-outfit font-bold text-lg mb-2">Faltam três respostas</h2>
            <p className="text-sm text-foreground-muted leading-relaxed mb-4 max-w-prose">
              Sem elas o treino sai genérico: o app não sabe se você treina em casa ou na
              academia, nem o que evitar por causa de lesão. São menos de dois minutos.
            </p>
            <ul className="text-sm mb-5 space-y-1.5">
              {faltam.map(campo => (
                <li key={campo} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" />
                  {ROTULO_ESSENCIAL[campo] ?? campo}
                </li>
              ))}
            </ul>
            <Link href="/anamnese?essencial=1">
              <Button size="lg">Responder agora</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5 md:p-8">
          <form onSubmit={handleGenerate} className="space-y-8">
            {/* assertive: o aluno precisa saber na hora que a geração falhou */}
            <div role="alert" aria-live="assertive">
              {error && (
                <div className="p-5 bg-destructive/10 border border-destructive/50 rounded-xl text-destructive text-sm">
                  {error}
                </div>
              )}
            </div>
            {/* Anuncia o andamento sem roubar o foco de quem está no formulário. */}
            <p aria-live="polite" className="sr-only">
              {loading ? 'Gerando seu treino com IA. Isso pode levar alguns segundos.' : ''}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm text-foreground-muted font-medium">Objetivo Principal</label>
                <select
                  value={form.goal}
                  onChange={e => setForm({ ...form, goal: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                >
                  <option>Hipertrofia</option>
                  <option>Força</option>
                  <option>Resistência</option>
                  <option>Emagrecimento</option>
                  <option>Misto</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-foreground-muted font-medium">Nível de Experiência</label>
                <select
                  value={form.level}
                  onChange={e => setForm({ ...form, level: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                >
                  <option>Iniciante</option>
                  <option>Intermediário</option>
                  <option>Avançado</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-foreground-muted font-medium">Dias por Semana</label>
                <select
                  value={form.daysPerWeek}
                  onChange={e => setForm({ ...form, daysPerWeek: Number(e.target.value) })}
                  className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                >
                  {[2, 3, 4, 5, 6].map(n => (
                    <option key={n} value={n}>{n} dias</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-foreground-muted font-medium">Duração da Sessão (min)</label>
                <select
                  value={form.duration}
                  onChange={e => setForm({ ...form, duration: Number(e.target.value) })}
                  className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                >
                  <option value="45">45 minutos</option>
                  <option value="60">60 minutos</option>
                  <option value="90">90 minutos</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-foreground-muted font-medium">Equipamentos</label>
                <select
                  value={form.equipment}
                  onChange={e => {
                    const novo = e.target.value;
                    // Só a saída de casa precisa de confirmação: é a única direção que o
                    // servidor desfaz. Ir para casa nunca contradiz o perfil.
                    const saindoDeCasa = treinaEmCasa(mapAnamneseLocationToEquipment(profile?.trainingLocation)) && !treinaEmCasa(novo);
                    if (saindoDeCasa) setLocalPendente(novo);
                    else setForm({ ...form, equipment: novo });
                  }}
                  className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                >
                  {/* Duas opções, não quatro. "Halteres em casa" e "Barra e anilhas"
                      obrigavam o aluno a traduzir o que ele tem num rótulo só: quem tem banco,
                      halteres E barra escolhia qual, e perdia equipamento nas duas. O que a
                      pessoa tem em casa é inventário, e inventário se marca numa lista — isso
                      fica na anamnese e no Perfil (ver lib/equipamentoCasa.ts). */}
                  <option>Academia completa</option>
                  <option>Em casa</option>
                </select>

                {localPendente && (
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                    <p className="text-sm text-foreground">
                      Sua anamnese diz que você treina <strong className="text-white">em casa</strong>, e é por
                      isso que os exercícios de máquina ficam de fora. Passou a treinar em academia?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          await atualizarLocalDeTreino(localPendente);
                          setForm({ ...form, equipment: localPendente });
                          setLocalPendente(null);
                        }}
                      >
                        Sim, atualizar meu perfil
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setLocalPendente(null)}>
                        Cancelar
                      </Button>
                    </div>
                    <p className="text-xs text-foreground-muted">
                      Isso muda o seu perfil, não só este treino. Os próximos também passam a
                      contar com a academia.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm text-foreground-muted font-medium">Músculos Prioritários (Opcional)</label>
                <div className="flex flex-wrap gap-2">
                  {['Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps', 'Pernas', 'Glúteos', 'Abdômen'].map(muscle => (
                    <button
                      type="button"
                      key={muscle}
                      onClick={() => handlePriorityToggle(muscle)}
                      aria-pressed={form.priorities.includes(muscle)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        form.priorities.includes(muscle)
                          ? 'bg-accent text-white'
                          : 'bg-surface border border-border text-foreground-muted hover:bg-white/10'
                      }`}
                    >
                      {muscle}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 md:col-span-2">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <label className="text-sm text-foreground-muted font-medium">Método de Treino</label>
                  {unlock.liberadoPorPapel ? (
                    <span className="text-xs text-accent/80 font-medium">
                      Master — todos os métodos liberados
                    </span>
                  ) : unlock.proximaFase ? (
                    <span className="text-xs text-foreground-muted/70">
                      {unlock.treinosFeitos} treinos concluídos
                    </span>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {TRAINING_METHODS.map(method => {
                    const bloqueio = textoBloqueio(unlock, method.id as MethodId);
                    const bloqueado = bloqueio !== null;
                    return (
                      <button
                        type="button"
                        key={method.id}
                        // Bloqueado não é só visual: o clique é ignorado, então não dá pra selecionar
                        // um método avançado sem a constância que o libera.
                        disabled={bloqueado}
                        onClick={() => !bloqueado && setForm({ ...form, trainingMethod: method.id })}
                        title={bloqueio || method.desc}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          bloqueado
                            ? 'border-border/50 bg-surface/40 text-foreground-muted/40 cursor-not-allowed'
                            : form.trainingMethod === method.id
                              ? 'border-primary bg-primary/10 text-white'
                              : 'border-border bg-surface text-foreground-muted hover:bg-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="text-xl mb-1">{bloqueado ? '🔒' : method.icon}</div>
                        <div className="font-semibold text-sm">{method.label}</div>
                        {bloqueado ? (
                          <div className="text-[11px] text-accent/70 mt-0.5 leading-tight font-medium">{bloqueio}</div>
                        ) : (
                          <div className="text-xs text-foreground-muted/70 mt-0.5 leading-tight">{method.desc}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {unlock.proximaFase && (
                  <p className="text-xs text-foreground-muted/60 leading-relaxed">
                    Técnicas avançadas levam à falha muscular e pedem base de força e técnica.
                    Elas se abrem conforme sua constância no app — treine e desbloqueie.
                  </p>
                )}
              </div>

              {/* O campo mais subaproveitado da tela. O rótulo prometia três coisas
                  ("Limitações, Foco ou Intenção") e o exemplo só mostrava a primeira, então
                  quase todo mundo escrevia uma linha seca — "Geral" — ou nada.

                  É o ÚNICO lugar onde o aluno conta o que nenhum campo estruturado pergunta:
                  quanto tempo ele tem de verdade, a que horas treina, o que odeia fazer, o
                  que quer voltar a conseguir. O exemplo agora puxa isso.

                  O aviso embaixo não é decoração. Equipamento e lesão são filtrados em
                  CÓDIGO, a partir da anamnese — escrever "tenho halteres em casa" aqui não
                  muda o catálogo que chega à IA. Sem dizer isso, o aluno escreve um parágrafo
                  caprichado, vê o pedido de equipamento ser ignorado e conclui que o app não
                  lê o que ele digita. */}
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="limitacoes" className="text-sm text-foreground-muted font-medium">
                  Limitações, Foco ou Intenção
                </label>
                <textarea
                  id="limitacoes"
                  maxLength={LIMITE_PREFERENCIAS}
                  placeholder={
                    'Quanto mais você contar, mais o treino sai com a sua cara. Por exemplo:\n\n' +
                    '• Treino 6h da manhã, antes do trabalho, e tenho 40 min de verdade\n' +
                    '• A academia lota às 18h e quase nunca consigo o rack\n' +
                    '• Odeio esteira; prefiro halter a máquina\n' +
                    '• Quero voltar a correr 5 km sem dor'
                  }
                  value={form.limitations}
                  onChange={e => setForm({ ...form, limitations: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl p-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors min-h-[150px] leading-relaxed"
                />
                {/* O ERRO NASCE AQUI, ao lado do campo.
                    O alerta geral do formulário fica lá no topo, e rolar a tela até o campo
                    deixava o aluno de frente para um campo sem explicação nenhuma. */}
                {tentouGerar && intencaoCurta && (
                  <div role="alert" className="mt-2 p-3 rounded-xl bg-destructive/10 border border-destructive/50 text-destructive text-sm">
                    Escreva aqui antes de gerar. Uma frase basta — onde e quando você treina, o
                    que você quer, o que não gosta de fazer. É o que o app não tem como
                    adivinhar sobre você.
                  </div>
                )}

                <div className="flex items-start justify-between gap-3">
                  {/* O aviso muda de tom conforme falta: dizer "obrigatório" só quando o
                      aluno tenta gerar seria descobrir a regra do jeito ruim. */}
                  <p className={`text-xs leading-relaxed ${intencaoCurta ? 'text-warning' : 'text-foreground-muted'}`}>
                    {intencaoCurta
                      ? 'Escreva ao menos uma frase aqui — é o que o app não tem como adivinhar sobre você.'
                      : <>
                          Lesões e equipamento não precisam entrar aqui — eles vêm da sua{' '}
                          <Link href="/anamnese" className="text-primary underline">anamnese</Link> e são
                          aplicados sempre.
                        </>}
                  </p>
                  <span className={`text-xs tabular-nums shrink-0 ${
                    form.limitations.length >= LIMITE_PREFERENCIAS
                      ? 'text-warning'
                      : 'text-foreground-muted/60'
                  }`}>
                    {form.limitations.length}/{LIMITE_PREFERENCIAS}
                  </span>
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              fullWidth
              size="lg"
              className="text-lg font-bold shadow-[0_0_20px_rgb(var(--color-primary-rgb)/0.2)]"
            >
              {loading
                ? <LoadingSpinner cor="herdada" rotulo="Gerando o treino…" className="mr-2" />
                : <Zap className="w-6 h-6 mr-2" />
              }
              {loading ? 'Gerando e salvando treino...' : 'Gerar Treino com IA'}
            </Button>

            {/* O botão continua CLICÁVEL de propósito. Desabilitado, ele não explicaria nada
                e o aluno ficaria olhando para um botão morto sem saber o que falta; clicável,
                o clique leva direto ao campo com a mensagem. */}
            {intencaoCurta && (
              <p className="text-xs text-foreground-muted text-center -mt-2">
                Falta escrever em “Limitações, Foco ou Intenção” logo acima.
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
