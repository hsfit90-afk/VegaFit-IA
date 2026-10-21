"use client";

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSomenteMaster } from '@/components/useSomenteMaster';
import { useToast } from '@/components/ui/Toast';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Trash2, Sparkles, Save, GripVertical, Search, AlertTriangle, Maximize2, ImageOff, BookmarkPlus, Bookmark, Eye, Pencil, ChevronUp, ChevronDown, Home } from 'lucide-react';
import { VisualizadorDeMidia } from '@/components/workout/VisualizadorDeMidia';
import { EditorDePreparo, type ItemDePreparo } from '@/components/admin/EditorDePreparo';
import {
  classificarTipo,
  selecionarMobilidade,
  selecionarAbdominal,
  articulacoesDoExercicio,
  chaveDeMobilidade,
  chaveDeAbdominal,
  sementeDaChave,
  type ExercicioSimples,
} from '@/lib/preparoFinalizacao';
import { moverNaLista, ajustarCargas, aplicarCargaEmTodas } from '@/lib/edicaoDePlano';

import { prescrever, normalizarObjetivo } from '@/lib/protocolo';
import { PADDING_TELA, LARGURA_CONTEUDO, RODAPE_SEGURO } from '@/lib/layout';
import { traduzirErro } from '@/utils/mensagensDeErro';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

/**
 * Montador manual de treino, só para o master.
 *
 * Existe para o Treino do Personal: o aluno paga R$ 147 por um treino montado à mão, e sem
 * esta tela não havia onde montar.
 *
 * A ORDEM DOS BOTÕES NÃO É ACIDENTE. "Gerar com IA" vem antes de "Começar do zero" porque
 * revisar um plano gerado leva uns dez minutos e montar do zero leva quarenta — e é essa
 * diferença que decide se dez treinos por mês cabem na agenda de alguém que também atende
 * aluno presencial. O plano gerado já respeita a anamnese, o nível e a academia do aluno; o
 * trabalho vira ajustar o que o profissional discorda, não digitar tudo.
 */

interface ExercicioLinha {
  id: string;
  exerciseId: string;
  name: string;
  muscleGroup: string;
  sets: number;
  reps: string;
  restSeconds: number;
  tips: string;

  /** Carga sugerida por série, editável desde 19/10/2026. */
  targetWeights?: number[];

  /**
   * A periodização de 4 semanas que a geração escreve ("Semana 1: 3 séries… Semana 4: Deload").
   *
   * NÃO é editável aqui — está no tipo só para ATRAVESSAR a tela. Sem isto, gerar um plano e
   * salvar apagava a progressão de todos os exercícios: o editor devolve a sessão inteira, e o
   * que não está no formulário não volta. No plano que já existe o servidor remonta a partir do
   * que está salvo (ver lib/edicaoDePlano.ts); num plano NOVO não há o que remontar, então
   * quem tem que carregar é a tela.
   */
  method?: string;
}

interface SessaoLinha {
  id: string;
  name: string;
  exercises: ExercicioLinha[];
  /**
   * undefined = o servidor monta sozinho (o padrão, e o que serve na maioria dos dias).
   * Array, inclusive vazio = o profissional decidiu. Ver normalizarSessoes na rota.
   */
  warmup?: ItemDePreparo[];
  alongamento?: ItemDePreparo[];
  /**
   * O abdominal do dia, prescrito à mão.
   *
   * Mesma convenção dos outros dois: undefined deixa o automático escolher, array (mesmo
   * vazio) é decisão do profissional. Até 19/10/2026 o abdominal só existia do lado do aluno,
   * sorteado na tela dele — o profissional não via nem opinava.
   */
  abdominal?: ItemDePreparo[];
}

interface Aluno { id: string; name: string | null; role: string | null }

/** Um dia de treino salvo para reuso, organizado por objetivo. */
interface ModeloDeSessao {
  id: string;
  nome: string;
  objetivo: string;
  nota: string | null;
  exercicios: { name: string; muscleGroup: string; sets: number; reps: string; restSeconds: number; tips: string }[];
  created_at: string;
}

/** O que /api/admin/aluno devolve para a tela mostrar. */
interface ResumoDoAluno {
  local: string | null;
  equipamentosCasa: string[];
  objetivo: string | null;
  nivel: string | null;
  frequencia: string | null;
  tempoSessao: string | null;
  dias: string | null;
  lesoes: string | null;
  condicoes: string | null;
  liberacao: string | null;
}
/**
 * Um exercício do catálogo, JÁ julgado contra o inventário deste aluno.
 *
 * `cabe` vem do servidor e sai do mesmo filtro que a geração usa — não de uma regra escrita
 * aqui. Ver app/api/admin/catalogo/route.ts.
 */
interface ExercicioCatalogo {
  id: string;
  name: string;
  muscle_group: string;
  media_url: string | null;
  cabe: boolean;
  /** Como improvisar, quando cabe só por improvisação ("dá para usar uma cadeira"). */
  dica: string | null;
  /** O que falta, quando não cabe. Rótulos legíveis, já traduzidos pelo servidor. */
  exige: string[];
}

/** O que /api/admin/catalogo diz sobre o lugar onde o aluno treina. */
interface LocalDoAluno {
  emCasa: boolean;
  local: string | null;
  rotulosDoEquipamento: string[];
}

const novaLinha = (): ExercicioLinha => ({
  id: crypto.randomUUID(),
  exerciseId: '',
  name: '',
  muscleGroup: '',
  sets: 3,
  reps: '8-12',
  restSeconds: 60,
  tips: '',
});

export default function MontarTreino() {
  const ehMaster = useSomenteMaster();
  const toast = useToast();
  const params = useSearchParams();

  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [catalogo, setCatalogo] = useState<ExercicioCatalogo[]>([]);
  const [localDoAluno, setLocalDoAluno] = useState<LocalDoAluno | null>(null);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(false);
  /**
   * Ver o catálogo inteiro, incluindo o que não cabe no que o aluno tem.
   *
   * Existe porque quem tem CREF pode querer prescrever um exercício fora do inventário com
   * nota de improviso — e porque há grupo muscular que fica VAZIO no filtro: bíceps não tem
   * nenhum exercício de peso corporal puro no catálogo (medido em 19/10/2026: 0 de 61). Sem
   * esta válvula, montar bíceps para quem não tem nada seria impossível pela tela.
   *
   * Começa desligado de propósito: o padrão é o que o aluno consegue executar.
   */
  const [mostrarTudo, setMostrarTudo] = useState(false);
  const [alunoId, setAlunoId] = useState('');
  const [nome, setNome] = useState('');
  const [sessoes, setSessoes] = useState<SessaoLinha[]>([]);
  const [gerando, setGerando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const [ampliado, setAmpliado] = useState<ExercicioCatalogo | null>(null);
  const [modelos, setModelos] = useState<ModeloDeSessao[]>([]);
  const [salvandoModelo, setSalvandoModelo] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  /**
   * O plano que esta sendo EDITADO, se houver.
   *
   * Com id, "Salvar" atualiza o plano existente no lugar; sem id, cria um novo. A diferenca
   * nao e cosmetica: a periodizacao e por plano (computePeriodization filtra o historico por
   * workoutPlanId), entao salvar um ajuste como plano novo zeraria o ciclo do aluno -- ele
   * voltaria para a semana 1 estando na terceira. Mexer em dois exercicios nao pode custar
   * isso.
   */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [planosDoAluno, setPlanosDoAluno] = useState<{ id: string; name: string; sessions: any[]; created_at: string }[]>([]);
  /** Qual plano o aluno REALMENTE abre. Editar outro não muda nada para ele. */
  const [ativoId, setAtivoId] = useState<string | null>(null);
  /** Quando ele treinou por último, para avisar sobre treino possivelmente em andamento. */
  const [ultimoTreino, setUltimoTreino] = useState<string | null>(null);
  const [resumo, setResumo] = useState<ResumoDoAluno | null>(null);
  const [temAnamnese, setTemAnamnese] = useState(false);
  const [carregandoAluno, setCarregandoAluno] = useState(false);

  /**
   * A configuração da geração.
   *
   * ERA CHUMBADA NO CÓDIGO até 09/10/2026: 'Academia completa', 'Hipertrofia',
   * 'Intermediário', 3 dias, 60 min, para todo aluno. A rota de geração decide casa x academia
   * por este objeto, então um treino montado para quem treina na sala vinha com leg press e
   * cadeira extensora. Agora o padrão é a anamnese do aluno, e o profissional ajusta.
   */
  const [config, setConfig] = useState({
    equipment: 'Academia completa',
    goal: 'Hipertrofia',
    level: 'Intermediário',
    daysPerWeek: 3,
    duration: 60,
  });

  /**
   * O catálogo NÃO vem mais aqui.
   *
   * Vinha, direto do navegador e sem filtro nenhum — e por isso o campo de busca oferecia os
   * 882 exercícios a quem treina na sala de casa, leg press incluído. O filtro depende do
   * perfil do aluno, que decide prescrição e por isso é lido no servidor; então o catálogo só
   * pode ser buscado DEPOIS de saber de quem é o treino. Ver o efeito da troca de aluno.
   */
  useEffect(() => {
    (async () => {
      const r = await fetch('/api/admin/plano');
      if (r.ok) setAlunos((await r.json()).alunos ?? []);
      setCarregando(false);
    })();
  }, []);

  /**
   * Abrir já no aluno certo, e já no plano certo.
   *
   * É o que liga a lista de /admin/treinos a esta tela: um clique lá chega aqui com o treino
   * aberto, em vez de obrigar a reencontrar o aluno num seletor de 200 nomes.
   */
  useEffect(() => {
    const vindo = params.get('userId');
    if (vindo) setAlunoId(vindo);
  }, [params]);

  const alunoEscolhido = alunos.find(a => a.id === alunoId);

  /**
   * Catálogos separados para cada lista.
   *
   * Mobilidade e alongamento são coisas diferentes e o catálogo mistura as duas —
   * lib/preparoFinalizacao.ts já sabe separar. Oferecer o catálogo inteiro faria o
   * profissional escolher supino como aquecimento sem querer.
   */
  /**
   * O que os campos de busca oferecem.
   *
   * Por padrão, só o que o aluno consegue executar com o que ele tem. A válvula de ver tudo é
   * global: ela vale para exercício, mobilidade e alongamento ao mesmo tempo, porque um
   * seletor filtrado ao lado de outro aberto é a situação em que ninguém sabe o que está vendo.
   */
  const catalogoVisivel = useMemo(
    () => (mostrarTudo ? catalogo : catalogo.filter(c => c.cabe)),
    [catalogo, mostrarTudo]
  );

  const quantosCabem = useMemo(() => catalogo.filter(c => c.cabe).length, [catalogo]);

  const catalogoDeMobilidade = useMemo(
    () => catalogoVisivel.filter(c => classificarTipo(c.name, c.muscle_group) === 'mobilidade'),
    [catalogoVisivel]
  );
  const catalogoDeAlongamento = useMemo(
    () => catalogoVisivel.filter(c => classificarTipo(c.name, c.muscle_group) === 'alongamento'),
    [catalogoVisivel]
  );
  const catalogoDeAbdominal = useMemo(
    () => catalogoVisivel.filter(c => /core|abd/i.test(c.muscle_group ?? '')),
    [catalogoVisivel]
  );

  /** O julgamento do catálogo sobre um exercício já escolhido, para a linha avisar. */
  const noCatalogo = (ex: ExercicioLinha): ExercicioCatalogo | undefined =>
    catalogo.find(c => (ex.exerciseId && c.id === ex.exerciseId) || c.name === ex.name);

  /**
   * A SUGESTÃO AUTOMÁTICA SAI SEMPRE DO QUE CABE, mesmo com a válvula de ver tudo ligada.
   *
   * A válvula serve para o profissional ESCOLHER algo fora do inventário de propósito. Deixar
   * ela contaminar a sugestão faria a prévia mostrar rolo de espuma para quem não tem — que é
   * exatamente o que esta tela passou a existir para evitar.
   */
  const poolParaSugestao = useMemo<ExercicioSimples[]>(
    () => catalogo.filter(c => c.cabe).map(c => ({ id: c.id, name: c.name, muscle_group: c.muscle_group })),
    [catalogo]
  );

  const gruposDaSessao = (s: SessaoLinha): string[] =>
    [...new Set(s.exercises.map(e => e.muscleGroup).filter(Boolean))];

  const paraPreparo = (lista: ExercicioSimples[], segundos?: number): ItemDePreparo[] =>
    lista.map(e => ({
      exerciseId: e.id ?? '',
      name: e.name,
      muscleGroup: e.muscle_group ?? '',
      ...(segundos === undefined ? {} : { segundos }),
    }));

  /**
   * As MESMAS chaves que o servidor usa (lib/preparoFinalizacao.ts).
   *
   * É o que faz a prévia do modo automático valer: os dois lados sorteiam com a mesma semente,
   * então o que aparece aqui é literalmente o que vai ser gravado. Uma chave só daqui
   * transformaria a prévia em ficção.
   */
  const chaveDaMobilidade = (s: SessaoLinha) => chaveDeMobilidade(s.id, gruposDaSessao(s));
  const chaveDoAbdominal = (s: SessaoLinha) => chaveDeAbdominal(s.id);

  /** O que o roletar produziu, por chave. Tem precedência sobre o sorteio estável. */
  const [roletados, setRoletados] = useState<Record<string, ItemDePreparo[]>>({});

  /**
   * O que o aluno receberia AGORA se o bloco ficasse no automático.
   *
   * Calculado com as MESMAS funções do servidor (selecionarMobilidade e selecionarAbdominal).
   * Uma prévia por outra regra seria pior que nenhuma: mostraria três e entregaria outros três.
   */
  const sugestoes = useMemo(() => {
    const mapa: Record<string, ItemDePreparo[]> = {};
    if (poolParaSugestao.length === 0) return mapa;
    for (const s of sessoes) {
      const kMob = chaveDaMobilidade(s);
      const kAbd = chaveDoAbdominal(s);
      mapa[kMob] = roletados[kMob]
        ?? paraPreparo(selecionarMobilidade(poolParaSugestao, gruposDaSessao(s), 3, { semente: sementeDaChave(kMob) }), 40);
      mapa[kAbd] = roletados[kAbd]
        ?? paraPreparo(selecionarAbdominal(poolParaSugestao, 3, { semente: sementeDaChave(kAbd) }));
    }
    return mapa;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessoes, poolParaSugestao, roletados]);

  /**
   * Sorteia outro conjunto, evitando o que está na tela.
   *
   * ROLETAR É DECISÃO, e por isso FIXA a lista — mesmo partindo do automático.
   *
   * No automático o servidor remonta o bloco na hora de salvar, a partir da semente da sessão.
   * Se o sorteio ficasse só na tela, o profissional roletaria até gostar, salvaria, e o
   * servidor devolveria o conjunto da semente — jogando fora exatamente a escolha que o botão
   * existe para permitir. Fixar transforma o clique em prescrição, que é o que ele significa.
   *
   * "Voltar ao automático" continua ali para desfazer.
   */
  const roletar = (sessao: SessaoLinha, bloco: 'warmup' | 'abdominal') => {
    const chave = bloco === 'warmup' ? chaveDaMobilidade(sessao) : chaveDoAbdominal(sessao);
    const atual = sugestoes[chave] ?? [];
    const excluir = atual.map(i => i.name);

    const novo = bloco === 'warmup'
      ? paraPreparo(selecionarMobilidade(poolParaSugestao, gruposDaSessao(sessao), 3, { excluir }), 40)
      : paraPreparo(selecionarAbdominal(poolParaSugestao, 3, { excluir }));

    setRoletados(r => ({ ...r, [chave]: novo }));
    mudaSessao(sessao.id, bloco, novo);
    setSalvo(false);

    // O catálogo pode não ter de onde variar: 3 mobilidades de ombro para um aluno de casa
    // são 3, e roletar devolve as mesmas. Melhor dizer do que deixar o botão parecer quebrado.
    const repetiuTudo = novo.length > 0 && novo.every(n => excluir.includes(n.name));
    if (repetiuTudo) {
      toast.aviso(`São os únicos ${novo.length} que servem para este dia e para o que o aluno tem.`);
    }
  };

  /** A articulação que cada mobilidade prepara, para a linha dizer por que foi escolhida. */
  const legendaDaMobilidade = (item: ItemDePreparo): string | null => {
    const art = articulacoesDoExercicio(item.muscleGroup);
    return art.length > 0 ? art.join(' · ') : 'geral';
  };

  /**
   * Ao escolher o aluno, busca a anamnese dele e pré-preenche a geração.
   *
   * Recarrega do banco a cada troca, sem guardar em memória por aluno: o aluno pode ter
   * refeito a anamnese entre uma montagem e outra, e aqui o custo de estar desatualizado é
   * entregar um treino que não serve.
   */
  useEffect(() => {
    if (!alunoId) {
      setResumo(null);
      setTemAnamnese(false);
      setCatalogo([]);
      setLocalDoAluno(null);
      setAtivoId(null);
      return;
    }
    let cancelado = false;
    (async () => {
      setCarregandoAluno(true);
      setCarregandoCatalogo(true);
      // Troca de aluno reseta a válvula: o que cabia para o anterior não cabe para este, e
      // deixar o catálogo aberto esconderia justamente a informação que importa.
      setMostrarTudo(false);
      try {
        const [r, rPlanos, rCatalogo] = await Promise.all([
          fetch(`/api/admin/aluno?userId=${encodeURIComponent(alunoId)}`),
          fetch(`/api/admin/plano?userId=${encodeURIComponent(alunoId)}`),
          fetch(`/api/admin/catalogo?userId=${encodeURIComponent(alunoId)}`),
        ]);
        if (rPlanos.ok) setPlanosDoAluno((await rPlanos.json()).planos ?? []);

        // O catálogo filtrado. Falhar aqui é sério: sem ele a tela não tem o que oferecer, e
        // oferecer o catálogo inteiro como "melhor que nada" é o bug que isto corrige.
        if (rCatalogo.ok) {
          const dc = await rCatalogo.json();
          if (!cancelado) {
            setCatalogo((dc.exercicios ?? []).map((e: any) => ({
              id: e.id,
              name: e.name,
              muscle_group: e.muscleGroup,
              media_url: e.mediaUrl,
              cabe: Boolean(e.cabe),
              dica: e.dica ?? null,
              exige: e.exige ?? [],
            })));
            setLocalDoAluno({
              emCasa: Boolean(dc.aluno?.emCasa),
              local: dc.aluno?.local ?? null,
              rotulosDoEquipamento: dc.aluno?.rotulosDoEquipamento ?? [],
            });
          }
        } else if (!cancelado) {
          setCatalogo([]);
          setLocalDoAluno(null);
          toast.erro('Não consegui carregar o catálogo deste aluno.');
        }

        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Não consegui carregar o aluno.');
        if (cancelado) return;
        setResumo(d.resumo);
        setTemAnamnese(Boolean(d.aluno?.temAnamnese));
        setAtivoId(d.aluno?.activePlanId ?? null);
        setUltimoTreino(d.aluno?.ultimoTreino ?? null);
        setConfig(c => ({ ...c, ...d.sugestao }));
      } catch (e) {
        if (!cancelado) {
          setResumo(null);
          setTemAnamnese(false);
          toast.erro(traduzirErro(e, e instanceof Error ? e.message : 'Não consegui carregar o aluno.'));
        }
      } finally {
        if (!cancelado) {
          setCarregandoAluno(false);
          setCarregandoCatalogo(false);
        }
      }
    })();
    // Troca rápida de aluno: a resposta antiga não pode sobrescrever a nova.
    return () => { cancelado = true; };
  }, [alunoId]);

  // ---- montagem ----

  const addSessao = () => setSessoes(s => [...s, {
    id: crypto.randomUUID(),
    name: `Treino ${String.fromCharCode(65 + s.length)}`,
    exercises: [novaLinha()],
  }]);

  const removeSessao = (id: string) => setSessoes(s => s.filter(x => x.id !== id));

  const mudaSessao = (id: string, campo: keyof SessaoLinha, valor: any) =>
    setSessoes(s => s.map(x => (x.id === id ? { ...x, [campo]: valor } : x)));

  const addExercicio = (sessaoId: string) =>
    setSessoes(s => s.map(x => (x.id === sessaoId ? { ...x, exercises: [...x.exercises, novaLinha()] } : x)));

  const removeExercicio = (sessaoId: string, exId: string) =>
    setSessoes(s => s.map(x => (x.id === sessaoId
      ? { ...x, exercises: x.exercises.filter(e => e.id !== exId) }
      : x)));

  const mudaExercicio = (sessaoId: string, exId: string, campo: keyof ExercicioLinha, valor: any) => {
    // Editar depois de salvar invalida o "ver como o aluno": o que está na tela deixou de ser
    // o que está na conta dele, e oferecer a prévia ali enganaria quem confia nela.
    setSalvo(false);
    setSessoes(s => s.map(x => (x.id === sessaoId
      ? {
          ...x,
          exercises: x.exercises.map(e => {
            if (e.id !== exId) return e;
            const novo = { ...e, [campo]: valor };

            /**
             * Mexer em "séries" arrasta a carga junto.
             *
             * `limparAlvosPorSerie` DESCARTA o array de carga quando o tamanho não bate com
             * `sets` — e está certo, porque rótulo desalinhado faz o aluno descansar na hora
             * errada no drop set. Só que descartar seria a resposta errada aqui: quem subiu de
             * 3 para 4 séries perderia a carga que acabou de digitar por mexer num campo
             * vizinho. Ver ajustarCargas em lib/edicaoDePlano.ts.
             */
            if (campo === 'sets') novo.targetWeights = ajustarCargas(e.targetWeights, Number(valor));
            return novo;
          }),
        }
      : x)));
  };

  /** Carga sugerida de UMA série. Campo vazio ou zero limpa a prescrição daquela série. */
  const mudaCarga = (sessaoId: string, exId: string, serie: number, valor: number) => {
    setSalvo(false);
    setSessoes(s => s.map(x => (x.id === sessaoId
      ? {
          ...x,
          exercises: x.exercises.map(e => {
            if (e.id !== exId) return e;
            const base = ajustarCargas(e.targetWeights, e.sets) ?? Array(e.sets).fill(0);
            const cargas = [...base];
            cargas[serie] = Number.isFinite(valor) && valor > 0 ? valor : 0;
            // Tudo zerado é "sem prescrição de carga", não "prescrevi zero quilo".
            return { ...e, targetWeights: cargas.some(c => c > 0) ? cargas : undefined };
          }),
        }
      : x)));
  };

  /**
   * Repete a carga da primeira série nas outras.
   *
   * O caso comum é "20 kg nas quatro"; progressão por série é exceção. Digitar o mesmo número
   * quatro vezes é o tipo de atrito que faz o campo não ser usado.
   */
  const igualarCarga = (sessaoId: string, exId: string) => {
    setSalvo(false);
    setSessoes(s => s.map(x => (x.id === sessaoId
      ? {
          ...x,
          exercises: x.exercises.map(e => (e.id === exId
            ? { ...e, targetWeights: aplicarCargaEmTodas(e.targetWeights?.[0] ?? 0, e.sets) }
            : e)),
        }
      : x)));
  };

  /** Sobe ou desce um exercício dentro do dia. A ordem na tela é a ordem da execução. */
  const moveExercicio = (sessaoId: string, de: number, para: number) => {
    setSalvo(false);
    setSessoes(s => s.map(x => (x.id === sessaoId
      ? { ...x, exercises: moverNaLista(x.exercises, de, para) }
      : x)));
  };

  /** Ao escolher um exercício do catálogo, traz o grupo muscular junto — um campo a menos. */
  /**
   * Traz um plano que o aluno já tem para a tela, para editar no lugar.
   *
   * O id fica guardado: salvar vai ATUALIZAR este plano, não criar outro. Assim a
   * periodização e o histórico continuam apontando para ele.
   */
  const editarPlano = (pl: { id: string; name: string; sessions: any[] }) => {
    if (sessoes.length > 0 && !confirm('Isso descarta o que está na tela. Continuar?')) return;
    setEditandoId(pl.id);
    setNome(pl.name);
    setSalvo(false);
    /**
     * OS IDS ORIGINAIS SÃO MANTIDOS, e isso não é detalhe.
     *
     * Aqui se gerava `crypto.randomUUID()` para cada dia e cada exercício, jogando fora o id
     * que o plano tinha. Com o id perdido, o servidor não consegue reencontrar o exercício no
     * plano salvo para devolver o que o formulário não edita — e a mesclagem de
     * lib/edicaoDePlano.ts cairia no nome, que é ambíguo quando o mesmo exercício aparece duas
     * vezes no dia com séries diferentes.
     *
     * O uuid novo continua valendo para plano antigo que não tem id, e para linha nova.
     */
    setSessoes((pl.sessions ?? []).map((sx: any, i: number) => ({
      id: String(sx.id || crypto.randomUUID()),
      name: sx.name || `Treino ${String.fromCharCode(65 + i)}`,
      warmup: Array.isArray(sx.warmup) ? sx.warmup : undefined,
      alongamento: Array.isArray(sx.alongamento) ? sx.alongamento : undefined,
      abdominal: Array.isArray(sx.abdominal) ? sx.abdominal : undefined,
      exercises: (sx.exercises ?? []).map((e: any) => ({
        id: String(e.id || crypto.randomUUID()),
        // Reencontra o id no catálogo pelo nome, como os modelos fazem: plano antigo pode ter
        // sido salvo antes de um recadastro de exercício.
        exerciseId: e.exerciseId || catalogo.find(c => c.name === e.name)?.id || '',
        name: e.name ?? '',
        muscleGroup: e.muscleGroup ?? '',
        sets: Number(e.sets) || 3,
        reps: String(e.reps || '8-12'),
        restSeconds: Number(e.restSeconds) || 60,
        tips: String(e.tips || ''),
        targetWeights: Array.isArray(e.targetWeights) ? e.targetWeights : undefined,
        method: typeof e.method === 'string' ? e.method : undefined,
      })),
    })));
    toast.sucesso(`"${pl.name}" aberto para edição. Salvar atualiza este treino.`);
  };

  /**
   * Abre o plano pedido na URL, uma vez, quando os dados já chegaram.
   *
   * Espera o catálogo: `editarPlano` reencontra o id do exercício nele, e abrir antes deixaria
   * as linhas sem miniatura e sem o aviso de equipamento — justamente o que a tela ganhou.
   */
  const [abriuDaUrl, setAbriuDaUrl] = useState(false);
  useEffect(() => {
    if (abriuDaUrl) return;
    const pedido = params.get('planoId');
    if (!pedido || planosDoAluno.length === 0 || catalogo.length === 0) return;
    const achado = planosDoAluno.find(p => p.id === pedido);
    setAbriuDaUrl(true);
    if (achado) {
      editarPlano(achado);
    } else {
      toast.erro('Esse treino não está mais na conta deste aluno.');
    }
    // editarPlano e toast mudam a cada render e reabririam o plano em loop; o que de fato
    // dispara isto é a chegada dos dados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, planosDoAluno, catalogo, abriuDaUrl]);

  // ---- modelos de sessão ----

  /**
   * Recarrega os modelos do objetivo escolhido.
   *
   * Depende de `config.goal`: trocar o objetivo no topo troca a lista aqui embaixo. É a razão
   * de organizar por objetivo — o profissional vê só o que serve para este aluno, em vez de
   * rolar uma lista que mistura hipertrofia com emagrecimento.
   */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/admin/modelos?objetivo=${encodeURIComponent(config.goal)}`);
        if (!r.ok) return;
        setModelos((await r.json()).modelos ?? []);
      } catch {
        // Silencioso de propósito: modelo é conveniência. Falhar ao carregar não pode
        // atrapalhar quem só quer montar o treino na mão.
      }
    })();
  }, [config.goal]);

  const salvarComoModelo = async (sessao: SessaoLinha) => {
    const exercicios = sessao.exercises.filter(e => e.name.trim());
    if (exercicios.length === 0) { toast.erro('Este dia não tem exercício para salvar.'); return; }

    const nome = prompt('Nome do modelo:', sessao.name || `Modelo de ${config.goal}`);
    if (!nome?.trim()) return;

    setSalvandoModelo(sessao.id);
    try {
      const r = await fetch('/api/admin/modelos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), objetivo: config.goal, exercicios }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Não consegui salvar.');
      setModelos(m => [d.modelo, ...m]);
      toast.sucesso(`Modelo "${d.modelo.nome}" salvo em ${config.goal}.`);
    } catch (e) {
      toast.erro(traduzirErro(e, e instanceof Error ? e.message : 'Não consegui salvar o modelo.'));
    } finally {
      setSalvandoModelo(null);
    }
  };

  /**
   * Carrega um modelo como um dia novo do plano.
   *
   * O modelo guarda o NOME do exercício, não o id — então o id é reencontrado no catálogo
   * aqui. É o que faz um modelo antigo sobreviver a recadastro de exercício: no pior caso a
   * linha vem sem id e quem monta reescolhe, em vez de o modelo inteiro virar lixo.
   */
  const carregarModelo = (modelo: ModeloDeSessao) => {
    setSessoes(s => [...s, {
      id: crypto.randomUUID(),
      name: modelo.nome,
      exercises: modelo.exercicios.map(e => ({
        id: crypto.randomUUID(),
        exerciseId: catalogo.find(c => c.name === e.name)?.id ?? '',
        name: e.name,
        muscleGroup: e.muscleGroup,
        sets: e.sets,
        reps: e.reps,
        restSeconds: e.restSeconds,
        tips: e.tips,
      })),
    }]);
    const semId = modelo.exercicios.filter(e => !catalogo.some(c => c.name === e.name)).length;
    toast.sucesso(semId > 0
      ? `"${modelo.nome}" carregado. ${semId} exercício(s) saíram do catálogo — reescolha.`
      : `"${modelo.nome}" carregado como novo dia.`);
  };

  const apagarModelo = async (modelo: ModeloDeSessao) => {
    if (!confirm(`Apagar o modelo "${modelo.nome}"?`)) return;
    try {
      const r = await fetch(`/api/admin/modelos?id=${modelo.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('Não consegui apagar.');
      setModelos(m => m.filter(x => x.id !== modelo.id));
    } catch {
      toast.erro('Não consegui apagar o modelo.');
    }
  };

  /** O GIF do exercicio, pelo id que a escolha no catalogo gravou. */
  const midiaDoExercicio = (exerciseId: string): string | null =>
    (exerciseId ? catalogo.find(c => c.id === exerciseId)?.media_url : null) ?? null;

  /**
   * Preenche series, reps e descanso com o protocolo do app.
   *
   * Usa o OBJETIVO escolhido para a geracao, nao um valor fixo: montar a mao para um aluno de
   * emagrecimento com numeros de hipertrofia e o tipo de divergencia que ninguem percebe
   * revisando, porque os campos estao preenchidos e parecem certos.
   */
  const aplicarProtocolo = (sessaoId: string, exId: string, tipo: 'composto' | 'isolado') => {
    const r = prescrever(tipo, normalizarObjetivo(config.goal));
    setSessoes(s => s.map(x => (x.id === sessaoId
      ? { ...x, exercises: x.exercises.map(e => (e.id === exId
          ? { ...e, sets: r.series, reps: r.reps, restSeconds: r.descansoSegundos }
          : e)) }
      : x)));
  };

  const escolheExercicio = (sessaoId: string, exId: string, nomeEscolhido: string) => {
    const achado = catalogo.find(c => c.name === nomeEscolhido);
    setSessoes(s => s.map(x => (x.id === sessaoId
      ? { ...x, exercises: x.exercises.map(e => (e.id === exId ? {
          ...e,
          name: nomeEscolhido,
          exerciseId: achado?.id ?? '',
          muscleGroup: achado?.muscle_group ?? e.muscleGroup,
        } : e)) }
      : x)));
  };

  // ---- gerar com IA como ponto de partida ----

  const gerarComIA = async () => {
    if (!alunoId) { toast.erro('Escolha o aluno primeiro.'); return; }
    setGerando(true);
    try {
      const res = await fetch('/api/treino', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // profile.id manda a rota gerar PARA este aluno: ela lê a anamnese, o histórico e o
        // nível dele do banco, e confere no servidor que quem pede é master.
        body: JSON.stringify({
          profile: {
            id: alunoId,
            name: alunoEscolhido?.name || 'Aluno',
            level: config.level,
            goal: config.goal,
          },
          config: {
            ...config,
            priorities: [],
            limitations: '',
            trainingMethod: 'tradicional',
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não consegui gerar.');

      setSessoes((data.sessions || []).map((s: any, i: number) => ({
        id: crypto.randomUUID(),
        name: s.name || `Treino ${String.fromCharCode(65 + i)}`,
        exercises: (s.exercises || []).map((e: any) => ({
          id: crypto.randomUUID(),
          exerciseId: catalogo.find(c => c.name === e.name)?.id ?? '',
          name: e.name ?? '',
          muscleGroup: e.muscleGroup ?? '',
          sets: Number(e.sets) || 3,
          reps: String(e.reps || '8-12'),
          restSeconds: Number(e.restSeconds) || 60,
          tips: String(e.tips || ''),
          // Carga e periodização vêm da geração e precisam atravessar a tela: num plano NOVO
          // não há plano salvo de onde o servidor as remonte.
          targetWeights: Array.isArray(e.targetWeights) ? e.targetWeights : undefined,
          method: typeof e.method === 'string' ? e.method : undefined,
        })),
      })));
      if (!nome) setNome(`Treino de ${alunoEscolhido?.name || 'aluno'}`);
      toast.sucesso('Plano gerado. Agora é só ajustar o que você mudaria.');
    } catch (e) {
      toast.erro(traduzirErro(e, e instanceof Error ? e.message : 'Não consegui gerar.'));
    } finally {
      setGerando(false);
    }
  };

  // ---- salvar ----

  const salvar = async () => {
    if (!alunoId) { toast.erro('Escolha o aluno.'); return; }
    if (!nome.trim()) { toast.erro('Dê um nome ao treino.'); return; }
    const semExercicio = sessoes.filter(s => s.exercises.every(e => !e.name.trim()));
    if (sessoes.length === 0 || semExercicio.length === sessoes.length) {
      toast.erro('Adicione ao menos um exercício.'); return;
    }

    /**
     * EDITAR UM PLANO QUE NÃO É O ATIVO NÃO CHEGA AO ALUNO.
     *
     * O aluno abre UM plano. Salvar alterações em outro é trabalho que não aparece do lado
     * dele — e o pior é sair da tela achando que apareceu. Então pergunta, aqui, enquanto dá
     * para decidir, em vez de avisar depois.
     */
    let ativar = false;
    if (editandoId && ativoId && editandoId !== ativoId) {
      ativar = confirm(
        `Este não é o treino que ${alunoEscolhido?.name || 'o aluno'} abre hoje. ` +
        `Salvar sem ativar não muda nada para ele.\n\nOK ativa este treino agora. ` +
        `Cancelar salva só as alterações.`
      );
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/admin/plano', {
        method: editandoId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: alunoId,
          planoId: editandoId ?? undefined,
          ativar,
          name: nome,
          split: `${sessoes.length} dias`,
          sessions: sessoes.map(s => ({
            ...s,
            exercises: s.exercises.filter(e => e.name.trim()),
            // Vão como estão: undefined deixa o servidor preencher, array manda respeitar.
            warmup: s.warmup,
            alongamento: s.alongamento,
            abdominal: s.abdominal,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não consegui salvar.');
      if (data.ativo) setAtivoId(data.planoId ?? editandoId);
      toast.sucesso(editandoId
        ? `Treino atualizado na conta de ${alunoEscolhido?.name || 'aluno'} (${data.dias} dias).`
        : `Treino salvo na conta de ${alunoEscolhido?.name || 'aluno'} (${data.dias} dias).`);
      // Conferir o que chegou do outro lado e parte da entrega, nao um extra.
      setSalvo(true);
    } catch (e) {
      toast.erro(traduzirErro(e, e instanceof Error ? e.message : 'Não consegui salvar.'));
    } finally {
      setSalvando(false);
    }
  };

  const totalExercicios = useMemo(
    () => sessoes.reduce((n, s) => n + s.exercises.filter(e => e.name.trim()).length, 0),
    [sessoes]
  );

  /**
   * Pode haver um treino EM ANDAMENTO no aparelho deste aluno agora.
   *
   * O treino em andamento vive no localStorage dele, e o servidor não tem cópia nem como
   * consultar — então isto é probabilidade, não certeza, e o aviso diz isso com essas
   * palavras.
   *
   * A janela é de 8 horas porque é exatamente a validade do cache (MAX_AGE_MS em
   * utils/workoutCache.ts): passado esse prazo não existe mais sessão restaurável, e avisar
   * seria assustar à toa.
   *
   * O que acontece de fato se houver: a tela aberta dele não muda (não há atualização em
   * tempo real), e se ele recarregar, retoma a sessão antiga que já está no aparelho. Não
   * corrompe nada — no pior caso ele termina um dia que você acabou de tirar do plano.
   */
  const JANELA_DO_CACHE_MS = 8 * 60 * 60 * 1000;
  const talvezTreinandoAgora = useMemo(() => {
    if (!ultimoTreino) return false;
    const quando = Date.parse(ultimoTreino);
    return Number.isFinite(quando) && Date.now() - quando < JANELA_DO_CACHE_MS;
  }, [ultimoTreino, JANELA_DO_CACHE_MS]);

  if (!ehMaster || carregando) {
    return <LoadingSpinner tela tamanho="lg" />;
  }

  return (
    <div className={`${PADDING_TELA} ${LARGURA_CONTEUDO} mx-auto animate-fade-in ${RODAPE_SEGURO}`}>
      <VisualizadorDeMidia
        midia={ampliado?.media_url ?? null}
        titulo={ampliado?.name ?? ''}
        subtitulo={ampliado?.muscle_group}
        onFechar={() => setAmpliado(null)}
      />
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-outfit font-bold">Montar treino</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Para entregar o Treino do Personal. O treino vai direto para a conta do aluno.
        </p>
      </header>

      {/* Aluno e nome */}
      <Card className="mb-5">
        <CardContent className="p-5 grid md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="aluno" className="text-sm font-semibold">Para quem é</label>
            <select
              id="aluno"
              value={alunoId}
              onChange={e => setAlunoId(e.target.value)}
              className="w-full bg-surface border border-border rounded-xl p-3 text-sm focus:outline-none focus:border-primary/50"
            >
              <option value="">Escolha o aluno…</option>
              {alunos.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name || 'Sem nome'}{a.role === 'master' ? ' (master)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="nomeplano" className="text-sm font-semibold">Nome do treino</label>
            <Input id="nomeplano" value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Ex: Hipertrofia — outubro" maxLength={120} />
          </div>
        </CardContent>
      </Card>

      {/* A anamnese do aluno, na tela.
          Antes disto o montador gerava com tudo chumbado no código: sempre "Academia
          completa", sempre Hipertrofia, sempre Intermediário. Como a rota decide casa x
          academia pelo que o corpo da requisição manda, um treino montado para quem treina na
          sala saía com leg press — e não havia como perceber, porque a anamnese não aparecia
          em lugar nenhum. Agora aparece, e é ela que pré-preenche a geração. */}
      {alunoId && carregandoAluno && (
        <Card className="mb-5">
          <CardContent className="p-5 flex items-center gap-2 text-sm text-foreground-muted">
            <LoadingSpinner tamanho="sm" rotulo="Buscando a anamnese do aluno…" mostrarRotulo />
          </CardContent>
        </Card>
      )}

      {alunoId && !carregandoAluno && resumo && (
        <Card className="mb-5">
          <CardContent className="p-5">
            {/* Nome de aluno é texto de tamanho imprevisível ("Sandro Camilo da Silva"), e a
                tarja ao lado não pode encolher — `shrink-0` nela, `min-w-0` no título. */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="font-outfit font-bold min-w-0">O que {alunoEscolhido?.name || 'o aluno'} respondeu</p>
              {!temAnamnese && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-warning/15 text-warning font-semibold shrink-0">
                  Sem anamnese
                </span>
              )}
            </div>

            {!temAnamnese ? (
              <p className="text-sm text-foreground-muted">
                Este aluno ainda não preencheu a anamnese. Os campos abaixo vieram do perfil dele
                e valem como chute — confirme com ele antes de entregar, principalmente o local
                de treino e as lesões.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                {([
                  ['Local de treino', resumo.local],
                  ['Tem em casa', resumo.equipamentosCasa.length > 0 ? resumo.equipamentosCasa.join(', ') : (resumo.local === 'Em casa' ? 'Nada marcado — só peso do corpo' : null)],
                  ['Objetivo', resumo.objetivo],
                  ['Nível', resumo.nivel],
                  ['Frequência atual', resumo.frequencia],
                  ['Tempo por sessão', resumo.tempoSessao],
                  ['Dias possíveis', resumo.dias],
                  ['Liberação médica', resumo.liberacao],
                ] as [string, string | null][])
                  .filter(([, v]) => v)
                  .map(([rotulo, valor]) => (
                    <div key={rotulo} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                      <span className="text-foreground-muted shrink-0">{rotulo}</span>
                      <span className="text-right">{valor}</span>
                    </div>
                  ))}
              </div>
            )}

            {/* Saúde separada e em destaque: é o que não pode passar batido na hora de montar. */}
            {(resumo.lesoes || resumo.condicoes) && (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-sm space-y-1.5">
                {resumo.lesoes && (
                  <p><AlertTriangle className="w-4 h-4 inline mr-1.5 text-destructive" /><strong>Lesões:</strong> {resumo.lesoes}</p>
                )}
                {resumo.condicoes && (
                  <p className="pl-[22px]"><strong>Condições:</strong> {resumo.condicoes}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* O CARD NÃO SOME MAIS depois de gerar.
          Ele estava dentro de `sessoes.length === 0`, então os quatro campos desapareciam no
          instante em que o plano chegava. Resultado: dava para gerar com o local errado, ver
          leg press num treino de casa, e não ter onde corrigir — só apagando tudo. Aconteceu
          com o treino do Joel em 09/10/2026. Os campos ficam, e o botão vira "Gerar de novo". */}
      <Card className="mb-5 border-primary/30">
        <CardContent className="p-6 flex flex-col gap-4">
            <div>
              <p className="font-outfit font-bold mb-1">
                {sessoes.length === 0 ? 'Por onde começar' : 'Gerar de novo'}
              </p>
              <p className="text-sm text-foreground-muted">
                {sessoes.length === 0
                  ? 'Gerar com IA traz um plano que já respeita a anamnese, o nível e a academia do aluno. Aí você ajusta o que mudaria — leva uns 10 minutos, contra 40 montando do zero.'
                  : 'Confira os campos abaixo. Gerar de novo descarta o plano que está na tela e monta outro — nada foi salvo na conta do aluno ainda.'}
              </p>
            </div>

            {/* Sem anamnese e sem local no perfil, o padrão é academia — e padrão silencioso
                foi exatamente o que entregou leg press para quem treina na sala. Aqui ele
                para de ser silencioso. */}
            {alunoId && !temAnamnese && config.equipment === 'Academia completa' && (
              <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-sm">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                <span>
                  Ninguém informou onde {alunoEscolhido?.name || 'este aluno'} treina, então está
                  valendo <strong>academia completa</strong>. Se ele treina em casa, troque abaixo
                  antes de gerar — senão o treino sai com aparelho que ele não tem.
                </span>
              </div>
            )}

            {/* Editáveis de propósito: o aluno às vezes te conta por WhatsApp algo que não
                está na anamnese ("essa semana vou viajar e treinar no hotel"). O padrão é o
                que ele respondeu; a palavra final é sua. */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="g-local" className="text-xs font-semibold text-foreground-muted">Onde vai treinar</label>
                <select id="g-local" value={config.equipment}
                  onChange={e => setConfig({ ...config, equipment: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl p-2.5 text-sm focus:outline-none focus:border-primary/50">
                  <option>Academia completa</option>
                  <option>Em casa</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="g-objetivo" className="text-xs font-semibold text-foreground-muted">Objetivo</label>
                <select id="g-objetivo" value={config.goal}
                  onChange={e => setConfig({ ...config, goal: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl p-2.5 text-sm focus:outline-none focus:border-primary/50">
                  <option>Hipertrofia</option>
                  <option>Emagrecimento</option>
                  <option>Performance</option>
                  <option>Saúde geral</option>
                  <option>Definição muscular</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="g-nivel" className="text-xs font-semibold text-foreground-muted">Nível</label>
                <select id="g-nivel" value={config.level}
                  onChange={e => setConfig({ ...config, level: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl p-2.5 text-sm focus:outline-none focus:border-primary/50">
                  <option>Iniciante</option>
                  <option>Intermediário</option>
                  <option>Avançado</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="g-dias" className="text-xs font-semibold text-foreground-muted">Dias por semana</label>
                <select id="g-dias" value={config.daysPerWeek}
                  onChange={e => setConfig({ ...config, daysPerWeek: Number(e.target.value) })}
                  className="w-full bg-surface border border-border rounded-xl p-2.5 text-sm focus:outline-none focus:border-primary/50">
                  {[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => {
                  // Confirmação só quando há trabalho na tela para perder. Perguntar sempre
                  // vira clique automático, e aí a pergunta não protege mais nada.
                  if (sessoes.length > 0 &&
                      !confirm('Isso descarta o plano que está na tela e gera outro. Continuar?')) return;
                  gerarComIA();
                }}
                disabled={gerando || !alunoId}
                className="flex-1"
              >
                {gerando
                  ? <LoadingSpinner tamanho="sm" cor="herdada" rotulo="Gerando o treino…" />
                  : <><Sparkles className="w-4 h-4" /> {sessoes.length === 0 ? 'Gerar com IA e ajustar' : 'Gerar de novo'}</>}
              </Button>
              {/* Só enquanto não há plano: depois de gerar, o rodapé já tem "Adicionar dia",
                  e dois botões com a mesma função em telas diferentes confundem. */}
              {sessoes.length === 0 && (
                <Button variant="outline" onClick={addSessao} className="flex-1">
                  <Plus className="w-4 h-4" /> Começar do zero
                </Button>
              )}
            </div>

            {/* O TREINO QUE O ALUNO JÁ TEM, para editar no lugar.
                Abrir e salvar ATUALIZA o plano existente — a periodização é por plano, e
                salvar um ajuste como plano novo devolveria o aluno para a semana 1 do ciclo. */}
            {planosDoAluno.length > 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-xs uppercase tracking-wider font-semibold text-foreground-muted mb-2.5">
                  Treinos que {alunoEscolhido?.name || 'o aluno'} já tem
                </p>
                <div className="flex flex-wrap gap-2">
                  {planosDoAluno.map(pl => (
                    <button
                      key={pl.id}
                      onClick={() => editarPlano(pl)}
                      title={`Abrir "${pl.name}" para editar — salvar atualiza este treino`}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-colors ${
                        editandoId === pl.id
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-white/10 bg-surface-light hover:text-primary hover:border-primary/40'
                      }`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {pl.name}
                      <span className="text-[11px] text-foreground-muted">
                        ({pl.sessions?.length ?? 0}d)
                      </span>
                    </button>
                  ))}
                </div>
                {editandoId && (
                  <p className="text-[11px] text-primary mt-2.5">
                    Editando um treino existente. Salvar atualiza ele — a periodização e o
                    histórico do aluno continuam de onde estão.
                  </p>
                )}
              </div>
            )}

            {/* OS MODELOS DO OBJETIVO ESCOLHIDO.
                Filtrados por objetivo de propósito: o profissional vê só o que serve para
                este aluno, em vez de rolar uma lista que mistura hipertrofia com
                emagrecimento. Trocar o objetivo acima troca a lista aqui.

                Carregar ACRESCENTA um dia, não substitui o plano: montar um treino de quatro
                dias a partir de quatro modelos é o caso que mais economiza tempo. */}
            {modelos.length > 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-xs uppercase tracking-wider font-semibold text-foreground-muted mb-2.5">
                  Seus modelos de {config.goal.toLowerCase()}
                </p>
                <div className="flex flex-wrap gap-2">
                  {modelos.map(m => (
                    <span
                      key={m.id}
                      className="inline-flex items-center rounded-xl border border-white/10 bg-surface-light overflow-hidden"
                    >
                      <button
                        onClick={() => carregarModelo(m)}
                        title={`Acrescentar "${m.nome}" como um novo dia (${m.exercicios.length} exercícios)`}
                        className="flex items-center gap-1.5 pl-3 pr-2.5 py-2 text-sm hover:text-primary transition-colors"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        {m.nome}
                        <span className="text-[11px] text-foreground-muted">({m.exercicios.length})</span>
                      </button>
                      <button
                        onClick={() => apagarModelo(m)}
                        aria-label={`Apagar modelo ${m.nome}`}
                        className="px-2 py-2 border-l border-white/10 text-foreground-muted hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      {/* O QUE OS CAMPOS DE BUSCA ESTÃO OFERECENDO.
          O montador carregava o catálogo inteiro e sem filtro: montando para quem treina na
          sala, o campo oferecia leg press e cadeira extensora, e não havia nada na tela que
          dissesse o contrário. Agora o número está à vista, e abrir o resto é um ato
          explícito — não o padrão. */}
      {alunoId && sessoes.length > 0 && (
        <div className="mb-4 rounded-xl border border-border bg-surface/60 p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {carregandoCatalogo ? (
            <p className="text-sm text-foreground-muted flex items-center gap-2">
              <LoadingSpinner tamanho="sm" rotulo="Conferindo o que cabe no que este aluno tem…" mostrarRotulo />
            </p>
          ) : (
            <>
              <div className="flex-1 min-w-[220px]">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  {localDoAluno?.emCasa && <Home className="w-4 h-4 text-secondary" />}
                  {mostrarTudo
                    ? `Mostrando os ${catalogo.length} exercícios do catálogo`
                    : `${quantosCabem} de ${catalogo.length} exercícios`}
                </p>
                <p className="text-xs text-foreground-muted mt-0.5">
                  {localDoAluno?.emCasa
                    ? `Treina em casa com: ${localDoAluno.rotulosDoEquipamento.length > 0
                        ? localDoAluno.rotulosDoEquipamento.join(', ')
                        : 'nada marcado — só peso do corpo'}.`
                    : `Treina em academia${localDoAluno?.local ? ` (${localDoAluno.local})` : ''}.`}
                  {mostrarTudo && ' Os que não cabem aparecem marcados na linha.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMostrarTudo(v => !v)}
                className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors flex-none ${
                  mostrarTudo
                    ? 'border-warning/50 bg-warning/10 text-warning'
                    : 'border-white/10 bg-surface-light text-foreground-muted hover:text-primary hover:border-primary/40'
                }`}
              >
                {mostrarTudo ? 'Voltar ao que cabe' : 'Mostrar o catálogo todo'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Sessões */}
      <div className="flex flex-col gap-4">
        {sessoes.map((sessao, si) => (
          <Card key={sessao.id}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <GripVertical className="w-4 h-4 text-foreground-muted flex-none" />
                <Input
                  value={sessao.name}
                  onChange={e => mudaSessao(sessao.id, 'name', e.target.value)}
                  className="font-outfit font-bold"
                  maxLength={80}
                  aria-label={`Nome do dia ${si + 1}`}
                />
                {/* Salvar o dia como modelo. Fica no cabeçalho do dia, e não no rodapé da
                    tela, porque o que se salva é ESTE dia — e quem monta decide isso olhando
                    para ele, não para o plano inteiro. */}
                <button
                  onClick={() => salvarComoModelo(sessao)}
                  disabled={salvandoModelo === sessao.id}
                  title="Salvar este dia como modelo, para reusar em outro aluno"
                  className="p-2 text-foreground-muted hover:text-primary transition-colors flex-none disabled:opacity-40"
                >
                  {salvandoModelo === sessao.id
                    ? <LoadingSpinner tamanho="sm" rotulo="Salvando o modelo…" />
                    : <BookmarkPlus className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => removeSessao(sessao.id)}
                  aria-label={`Remover ${sessao.name}`}
                  className="p-2 text-foreground-muted hover:text-destructive transition-colors flex-none"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {sessao.exercises.map((ex, ei) => (
                  <div key={ex.id} className="grid grid-cols-12 gap-2 items-start bg-surface/60 rounded-xl p-2.5 border border-border">
                    {/* A MINIATURA. Montar treino às cegas significa digitar um nome e torcer
                        para ser o movimento que você tem na cabeça — e o catálogo tem
                        "Puxada Alta", "Puxada Alta Invertida" e "Puxada Alta com Triângulo".
                        Ver o GIF ao lado confirma na hora, e o toque amplia. */}
                    <div className="col-span-2 md:col-span-1">
                      <button
                        type="button"
                        onClick={() => midiaDoExercicio(ex.exerciseId) && setAmpliado(catalogo.find(c => c.id === ex.exerciseId)!)}
                        disabled={!midiaDoExercicio(ex.exerciseId)}
                        aria-label={ex.name ? `Ver ${ex.name} ampliado` : undefined}
                        className="w-full aspect-square rounded-lg bg-black/40 grid place-items-center overflow-hidden relative"
                      >
                        {midiaDoExercicio(ex.exerciseId) ? (
                          <>
                            <img src={midiaDoExercicio(ex.exerciseId)!} alt="" className="w-full h-full object-contain opacity-90" />
                            <span className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded bg-black/60 grid place-items-center">
                              <Maximize2 className="w-2 h-2 text-white/80" />
                            </span>
                          </>
                        ) : (
                          <ImageOff className="w-4 h-4 text-foreground-muted/30" />
                        )}
                      </button>
                    </div>

                    <div className="col-span-10 md:col-span-4 flex flex-col gap-1">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
                        <input
                          list="catalogo-exercicios"
                          value={ex.name}
                          onChange={e => escolheExercicio(sessao.id, ex.id, e.target.value)}
                          placeholder="Digite para buscar no catálogo…"
                          className="w-full bg-black/30 border border-border rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-primary/50"
                        />
                      </div>
                      {ex.muscleGroup && (
                        <span className="text-[11px] text-foreground-muted pl-1">{ex.muscleGroup}</span>
                      )}

                      {/* O AVISO NA LINHA, e não só no contador lá em cima.
                          Um exercício fora do inventário pode entrar de propósito — e aí a
                          linha tem que dizer o que falta, para a observação ao aluno explicar
                          o improviso. O que não pode é entrar sem ninguém perceber, que era o
                          que acontecia. */}
                      {ex.name.trim() && noCatalogo(ex)?.cabe === false && (
                        <span className="text-[11px] text-warning pl-1 flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 mt-0.5 flex-none" />
                          <span>
                            Fora do que o aluno tem
                            {(noCatalogo(ex)?.exige.length ?? 0) > 0
                              ? `: precisa de ${noCatalogo(ex)!.exige.join(', ').toLowerCase()}`
                              : ''}
                          </span>
                        </span>
                      )}

                      {/* A dica de improviso vem do mesmo lugar que a geração usa, então é a
                          mesma que o aluno veria no treino gerado. */}
                      {ex.name.trim() && noCatalogo(ex)?.dica && (
                        <span className="text-[11px] text-secondary pl-1">{noCatalogo(ex)!.dica}</span>
                      )}

                      {/* PRESETS DO PROTOCOLO.
                          Os padrões da linha eram 3 / 8-12 / 60, que não são o protocolo do
                          app: hipertrofia pede 3×6-10 com 75s no composto e 4×12-15 no
                          isolado. Digitar isso a cada linha é o grosso do tempo de montagem,
                          e é onde escapa a divergência entre o que o app prescreve sozinho e
                          o que o profissional monta à mão. Um toque resolve os três campos. */}
                      <div className="flex gap-1.5 pt-0.5">
                        {(['composto', 'isolado'] as const).map(tipo => (
                          <button
                            key={tipo}
                            type="button"
                            onClick={() => aplicarProtocolo(sessao.id, ex.id, tipo)}
                            title={`Preenche séries, reps e descanso do protocolo para ${tipo}`}
                            className="text-[11px] px-2 py-1 rounded-md bg-surface-light border border-white/5 text-foreground-muted hover:text-primary hover:border-primary/40 transition-colors capitalize"
                          >
                            {tipo}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="col-span-3 md:col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider text-foreground-muted pl-1">Séries</label>
                      <input type="number" min={1} max={10} value={ex.sets}
                        onChange={e => mudaExercicio(sessao.id, ex.id, 'sets', Number(e.target.value))}
                        className="w-full bg-black/30 border border-border rounded-lg py-2 px-2 text-sm text-center tabular-nums focus:outline-none focus:border-primary/50" />
                    </div>

                    <div className="col-span-4 md:col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider text-foreground-muted pl-1">Reps</label>
                      <input value={ex.reps} maxLength={20}
                        onChange={e => mudaExercicio(sessao.id, ex.id, 'reps', e.target.value)}
                        className="w-full bg-black/30 border border-border rounded-lg py-2 px-2 text-sm text-center focus:outline-none focus:border-primary/50" />
                    </div>

                    <div className="col-span-4 md:col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider text-foreground-muted pl-1">Desc. (s)</label>
                      <input type="number" min={0} max={600} step={15} value={ex.restSeconds}
                        onChange={e => mudaExercicio(sessao.id, ex.id, 'restSeconds', Number(e.target.value))}
                        className="w-full bg-black/30 border border-border rounded-lg py-2 px-2 text-sm text-center tabular-nums focus:outline-none focus:border-primary/50" />
                    </div>

                    {/* REORDENAR, que o ícone de alça prometia sem cumprir.
                        A ordem na tela é a ordem em que o aluno executa, e composto antes de
                        isolado não é preferência: é a prescrição. Subir e descer em vez de
                        arrastar porque isto é usado no celular, onde arrastar numa lista que
                        rola é a interação que mais erra. */}
                    <div className="col-span-1 flex flex-col items-center justify-end h-full gap-0.5 pb-1">
                      <button
                        onClick={() => moveExercicio(sessao.id, ei, ei - 1)}
                        disabled={ei === 0}
                        aria-label={`Subir ${ex.name || 'exercício'}`}
                        className="p-1 text-foreground-muted hover:text-primary transition-colors disabled:opacity-20 disabled:hover:text-foreground-muted"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveExercicio(sessao.id, ei, ei + 1)}
                        disabled={ei === sessao.exercises.length - 1}
                        aria-label={`Descer ${ex.name || 'exercício'}`}
                        className="p-1 text-foreground-muted hover:text-primary transition-colors disabled:opacity-20 disabled:hover:text-foreground-muted"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeExercicio(sessao.id, ex.id)}
                        aria-label={`Remover ${ex.name || 'exercício'}`}
                        className="p-1 text-foreground-muted hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* A CARGA SUGERIDA, que a tela não tinha e o salvamento apagava.
                        O plano guarda `targetWeights` — uma carga por série —, e a tela do
                        aluno lê isso para mostrar o alvo. O montador não tinha o campo, então
                        editar um plano gerado zerava a carga de todos os exercícios.
                        Fica em linha própria porque são até 10 campos: num celular eles não
                        caberiam na mesma linha das séries. */}
                    {ex.name.trim() && (
                      <div className="col-span-12 border-t border-border/60 pt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <span className="text-[10px] uppercase tracking-wider text-foreground-muted">
                          Carga sugerida (kg)
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from({ length: ex.sets }, (_, i) => (
                            <input
                              key={i}
                              type="number"
                              min={0}
                              step={0.5}
                              value={ex.targetWeights?.[i] || ''}
                              onChange={e => mudaCarga(sessao.id, ex.id, i, Number(e.target.value))}
                              placeholder={`S${i + 1}`}
                              aria-label={`Carga da série ${i + 1} de ${ex.name}`}
                              className="w-14 bg-black/30 border border-border rounded-lg py-1 px-1.5 text-xs text-center tabular-nums focus:outline-none focus:border-primary/50"
                            />
                          ))}
                        </div>
                        {ex.sets > 1 && (ex.targetWeights?.[0] ?? 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => igualarCarga(sessao.id, ex.id)}
                            title="Repetir a carga da primeira série nas outras"
                            className="text-[11px] px-2 py-1 rounded-md bg-surface-light border border-white/5 text-foreground-muted hover:text-primary hover:border-primary/40 transition-colors"
                          >
                            igualar
                          </button>
                        )}
                        <span className="text-[10px] text-foreground-muted">
                          Em branco: o aluno registra a carga dele.
                        </span>
                      </div>
                    )}

                    <div className="col-span-12">
                      <input
                        value={ex.tips}
                        onChange={e => mudaExercicio(sessao.id, ex.id, 'tips', e.target.value)}
                        placeholder="Observação para o aluno (opcional) — ex: controle a descida em 3 segundos"
                        maxLength={500}
                        className="w-full bg-transparent border-0 border-t border-border/60 rounded-none pt-2 px-1 text-xs text-foreground-muted focus:outline-none focus:text-foreground"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => addExercicio(sessao.id)}
                className="mt-3 text-sm font-semibold text-primary hover:text-primary-hover transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Adicionar exercício
              </button>

              {/* ANTES e DEPOIS do treino, por dia.
                  O aquecimento vinha montado só pelo servidor; agora dá para escolher. O
                  alongamento não existia na sessão — a tela livre continua livre para todo
                  aluno, e isto é para quem pagou por prescrição. */}
              <EditorDePreparo
                titulo="Aquecimento · mobilidade"
                ajuda="Antes do treino, para preparar as articulações que este dia vai carregar. A escolha é pela ARTICULAÇÃO, não pelo grupo muscular: dia de peito pede ombro, dia de perna pede quadril, joelho e tornozelo."
                itens={sessao.warmup}
                catalogo={catalogoDeMobilidade}
                listaId="catalogo-mobilidade"
                classesDaMoldura="border-secondary/25 bg-secondary/5"
                onMudar={novos => mudaSessao(sessao.id, 'warmup', novos)}
                sugestao={sugestoes[chaveDaMobilidade(sessao)]}
                onRoletar={() => roletar(sessao, 'warmup')}
                legendaDe={legendaDaMobilidade}
              />

              {/* ABDOMINAL, que até 19/10/2026 só existia do lado do aluno.
                  Era sorteado na tela dele e o profissional não via nem opinava — num produto
                  em que ele paga pela escolha de quem tem CREF, isso era o bloco errado para
                  deixar no automático sem prévia. */}
              <EditorDePreparo
                titulo="Abdominal · depois do treino"
                ajuda="Aparece no fim do treino, em dias alternados (no plano A-B-C, cai no A e no C). Deixe no automático para o app sortear do que o aluno pode fazer, ou escolha à mão."
                itens={sessao.abdominal}
                catalogo={catalogoDeAbdominal}
                listaId="catalogo-abdominal"
                classesDaMoldura="border-accent/25 bg-accent/5"
                onMudar={novos => mudaSessao(sessao.id, 'abdominal', novos)}
                sugestao={sugestoes[chaveDoAbdominal(sessao)]}
                onRoletar={() => roletar(sessao, 'abdominal')}
                semSegundos
                rodape={`Séries e repetições vêm do protocolo do objetivo (${config.goal}), como no resto do treino.`}
              />

              <EditorDePreparo
                titulo="Alongamento · no fim"
                ajuda="Depois do treino. Fica vazio por padrão: no app, alongar é livre e o aluno escolhe o que quiser. Prescreva aqui quando quiser que ele faça algo específico."
                itens={sessao.alongamento ?? []}
                catalogo={catalogoDeAlongamento}
                listaId="catalogo-alongamento"
                classesDaMoldura="border-primary/25 bg-primary/5"
                onMudar={novos => mudaSessao(sessao.id, 'alongamento', novos)}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ESTE NÃO É O TREINO QUE O ALUNO ABRE.
          O aluno vê UM plano: o que o perfil dele aponta. Editar outro é trabalho que não
          chega do outro lado. O aviso fica ANTES do botão de salvar, enquanto ainda dá para
          decidir — avisar depois de salvar seria contar o que já aconteceu. */}
      {sessoes.length > 0 && editandoId && ativoId && editandoId !== ativoId && (
        <div className="mt-5 rounded-xl border border-warning/40 bg-warning/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-sm">
            Este não é o treino que <strong>{alunoEscolhido?.name || 'o aluno'}</strong> abre
            hoje. Salvar guarda as alterações, mas ele continua no treino ativo — ao salvar,
            você escolhe se quer ativar este.
          </p>
        </div>
      )}

      {/* PODE HAVER ALGUÉM TREINANDO AGORA.
          O treino em andamento fica no aparelho do aluno, e daqui não dá para ver. O que dá
          para saber é que ele treinou há pouco — então o aviso fala em possibilidade, não em
          certeza, e diz o que de fato acontece. */}
      {sessoes.length > 0 && editandoId && editandoId === ativoId && talvezTreinandoAgora && (
        <div className="mt-5 rounded-xl border border-secondary/40 bg-secondary/10 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
          <p className="text-sm">
            <strong>{alunoEscolhido?.name || 'Este aluno'}</strong> treinou nas últimas horas e
            pode estar com um treino aberto no celular. Salvar não interrompe nem corrompe o
            que ele está fazendo: ele termina a sessão que já começou e vê as mudanças na
            próxima.
          </p>
        </div>
      )}

      {sessoes.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mt-5">
          <Button variant="outline" onClick={addSessao} className="sm:w-auto">
            <Plus className="w-4 h-4" /> Adicionar dia
          </Button>
          <div className="flex-1" />
          <Button onClick={salvar} disabled={salvando} className="sm:w-auto">
            {salvando ? <LoadingSpinner tamanho="sm" cor="herdada" rotulo="Salvando…" /> : <><Save className="w-4 h-4" /> Salvar na conta do aluno</>}
          </Button>
        </div>
      )}

      {/* Aparece DEPOIS de salvar, e some ao editar de novo: a prévia mostra o que está na
          conta do aluno, não o que está na tela. Oferecê-la com edição pendente enganaria
          quem confia nela — que é o ponto de ela existir. */}
      {salvo && alunoId && (
        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-wrap items-center gap-3">
          <Eye className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm flex-1 min-w-[200px]">
            Treino na conta de <strong>{alunoEscolhido?.name || 'aluno'}</strong>. Confira como
            ele vai receber antes de avisar.
          </p>
          <a
            href={`/admin/preview?userId=${alunoId}`}
            className="text-sm font-semibold bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors"
          >
            Ver como o aluno
          </a>
        </div>
      )}

      {sessoes.length > 0 && (
        <p className="text-xs text-foreground-muted mt-4 text-center">
          {sessoes.length} {sessoes.length === 1 ? 'dia' : 'dias'} · {totalExercicios} exercícios ·
          {alunoEscolhido ? ` vai para ${alunoEscolhido.name || 'o aluno'}` : ' escolha o aluno acima'}
        </p>
      )}

      {/* Um datalist só, compartilhado por todas as linhas: 882 opções repetidas por linha
          deixariam a tela pesada sem necessidade.

          Sai de `catalogoVisivel` e não de `catalogo`: é aqui que o filtro de equipamento
          chega ao campo de busca. Sem o aluno escolhido a lista fica vazia, e isso está certo
          — não existe "o que cabe" antes de saber para quem é o treino. */}
      <datalist id="catalogo-exercicios">
        {catalogoVisivel.map(c => <option key={c.id} value={c.name} />)}
      </datalist>
      <datalist id="catalogo-mobilidade">
        {catalogoDeMobilidade.map(c => <option key={c.id} value={c.name} />)}
      </datalist>
      <datalist id="catalogo-alongamento">
        {catalogoDeAlongamento.map(c => <option key={c.id} value={c.name} />)}
      </datalist>
      <datalist id="catalogo-abdominal">
        {catalogoDeAbdominal.map(c => <option key={c.id} value={c.name} />)}
      </datalist>
    </div>
  );
}
