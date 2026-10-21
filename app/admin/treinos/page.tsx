"use client";

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSomenteMaster } from '@/components/useSomenteMaster';
import { useToast } from '@/components/ui/Toast';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Search, Pencil, Eye, AlertTriangle, Plus } from 'lucide-react';
import { PADDING_TELA, LARGURA_CONTEUDO, RODAPE_SEGURO } from '@/lib/layout';
import { traduzirErro } from '@/utils/mensagensDeErro';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Os treinos dos alunos, numa lista só.
 *
 * O QUE FALTAVA
 *
 * Dava para montar e editar o treino de qualquer aluno — o montador abre plano existente e
 * salva no lugar desde 15/10/2026 — mas só depois de achar a pessoa num `<select>` de até 200
 * nomes, sem busca e sem nenhuma informação ao lado. Quem está sem treino, quem parou de
 * treinar e quem acabou de receber um plano eram perguntas sem resposta na tela: a única forma
 * de saber era abrir aluno por aluno.
 *
 * A ORDEM NÃO É ALFABÉTICA, E É DE PROPÓSITO
 *
 * Primeiro quem precisa de atenção: ponteiro de plano quebrado, depois sem treino ativo,
 * depois quem está há mais tempo sem treinar. Lista de trabalho se ordena por urgência; ordem
 * alfabética serve para procurar um nome, e para isso existe a busca.
 *
 * ESTA TELA NÃO EDITA NADA. Ela leva ao montador, que é onde a edição mora — duplicar o editor
 * aqui seria manter duas telas que precisam concordar sobre o que é um plano válido.
 */

interface AlunoNaLista {
  id: string;
  nome: string | null;
  role: string | null;
  assinatura: string | null;
  planos: number;
  temTreinoAtivo: boolean;
  planoAtivoId: string | null;
  planoAtivoNome: string | null;
  ponteiroQuebrado: boolean;
  ultimoTreino: string | null;
  diasSemTreinar: number | null;
}

/** A partir de quantos dias parado o app considera que o ciclo reinicia. */
const DIAS_PARA_RESET = 14;

function textoDoUltimoTreino(dias: number | null): string {
  if (dias === null) return 'Nunca treinou';
  if (dias === 0) return 'Treinou hoje';
  if (dias === 1) return 'Treinou ontem';
  return `Há ${dias} dias`;
}

export default function TreinosDosAlunos() {
  const ehMaster = useSomenteMaster();
  const toast = useToast();

  const [alunos, setAlunos] = useState<AlunoNaLista[] | null>(null);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/admin/alunos');
        if (!r.ok) throw new Error('Não consegui carregar os alunos.');
        setAlunos((await r.json()).alunos ?? []);
      } catch (e) {
        setAlunos([]);
        toast.erro(traduzirErro(e, e instanceof Error ? e.message : 'Não consegui carregar os alunos.'));
      }
    })();
    // toast muda a cada render e refaria a busca em loop; isto roda uma vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * A urgência de cada linha, que também decide a ordem.
   *
   * Um número só, para a ordenação e a tarja saírem da MESMA decisão — duas regras separadas
   * acabariam mostrando "tudo certo" numa linha no topo da lista de pendências.
   */
  const urgencia = (a: AlunoNaLista): number => {
    if (a.ponteiroQuebrado) return 0;
    if (!a.temTreinoAtivo) return 1;
    if (a.diasSemTreinar === null) return 2;
    if (a.diasSemTreinar >= DIAS_PARA_RESET) return 3;
    return 4;
  };

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = (alunos ?? []).filter(a =>
      !termo || (a.nome ?? '').toLowerCase().includes(termo)
    );
    return [...filtrados].sort((x, y) => {
      const u = urgencia(x) - urgencia(y);
      if (u !== 0) return u;
      // Dentro do mesmo grupo: quem está há mais tempo parado primeiro.
      const dx = x.diasSemTreinar ?? Number.MAX_SAFE_INTEGER;
      const dy = y.diasSemTreinar ?? Number.MAX_SAFE_INTEGER;
      if (dx !== dy) return dy - dx;
      return (x.nome ?? '').localeCompare(y.nome ?? '');
    });
  }, [alunos, busca]);

  const semTreino = useMemo(
    () => (alunos ?? []).filter(a => !a.temTreinoAtivo).length,
    [alunos]
  );

  /**
   * ESQUELETO COM A SILHUETA DA LISTA, e não um spinner no meio da tela.
   *
   * Spinner centralizado não diz o que vem: a tela fica vazia, pisca, e o conteúdo aparece de
   * uma vez deslocando tudo. O esqueleto já ocupa o lugar certo — cabeçalho, busca e as
   * linhas de aluno —, então a chegada do dado não mexe no layout e quem olha entende, antes
   * de qualquer texto, que o que vem é uma lista.
   *
   * O `role="status"` com o rótulo escondido é o que o spinner anterior dava a quem usa
   * leitor de tela e um esqueleto puro perderia.
   */
  if (!ehMaster || alunos === null) {
    return (
      <div className={`${PADDING_TELA} ${LARGURA_CONTEUDO} mx-auto ${RODAPE_SEGURO}`} role="status">
        <span className="sr-only">Carregando os alunos…</span>
        <Skeleton className="h-10 w-72 mb-2" />
        <Skeleton className="h-4 w-96 mb-6" />
        <div className="flex gap-3 mb-5">
          <Skeleton className="h-11 flex-1" />
          <Skeleton className="h-11 w-44" />
        </div>
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[86px] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${PADDING_TELA} ${LARGURA_CONTEUDO} mx-auto animate-fade-in ${RODAPE_SEGURO}`}>
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl font-outfit font-bold">Treinos dos alunos</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Quem está sem treino, quem parou, e o caminho para editar o treino de cada um.
        </p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
          <Input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar pelo nome…"
            aria-label="Buscar aluno pelo nome"
            className="pl-9"
          />
        </div>
        <Link
          href="/admin/montar"
          className="inline-flex items-center justify-center gap-2 text-sm font-semibold bg-primary text-primary-foreground px-4 py-2.5 rounded-xl hover:bg-primary-hover transition-colors flex-none"
        >
          <Plus className="w-4 h-4" /> Montar treino novo
        </Link>
      </div>

      {semTreino > 0 && !busca && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p>
            {semTreino === 1
              ? '1 aluno está sem treino ativo.'
              : `${semTreino} alunos estão sem treino ativo.`}{' '}
            Eles abrem o app e não têm o que fazer.
          </p>
        </div>
      )}

      {lista.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-foreground-muted">
            {busca ? `Nenhum aluno com "${busca}" no nome.` : 'Nenhum aluno cadastrado ainda.'}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {lista.map(a => {
            const u = urgencia(a);
            return (
              <Card key={a.id} className={u <= 1 ? 'border-warning/40' : ''}>
                <CardContent className="p-4 flex flex-wrap items-center gap-x-4 gap-y-3">
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-semibold leading-tight">
                      {a.nome || 'Sem nome'}
                      {a.role === 'master' && (
                        <span className="text-[11px] text-foreground-muted font-normal"> (master)</span>
                      )}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5">
                      {a.ponteiroQuebrado ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-semibold">
                          Treino ativo apagado
                        </span>
                      ) : !a.temTreinoAtivo ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-warning/15 text-warning font-semibold">
                          Sem treino ativo
                        </span>
                      ) : (
                        <span className="text-[11px] text-foreground-muted truncate max-w-[220px]">
                          {a.planoAtivoNome}
                        </span>
                      )}

                      <span
                        className={`text-[11px] ${
                          a.diasSemTreinar !== null && a.diasSemTreinar >= DIAS_PARA_RESET
                            ? 'text-warning'
                            : 'text-foreground-muted'
                        }`}
                      >
                        {textoDoUltimoTreino(a.diasSemTreinar)}
                      </span>

                      {a.planos > 0 && (
                        <span className="text-[11px] text-foreground-muted">
                          {a.planos} {a.planos === 1 ? 'treino salvo' : 'treinos salvos'}
                        </span>
                      )}
                    </div>

                    {a.diasSemTreinar !== null && a.diasSemTreinar >= DIAS_PARA_RESET && (
                      <p className="text-[11px] text-foreground-muted mt-1.5">
                        Passou de {DIAS_PARA_RESET} dias parado: ao voltar, o ciclo recomeça na
                        semana 1.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-none">
                    <Link
                      href={
                        a.planoAtivoId
                          ? `/admin/montar?userId=${a.id}&planoId=${a.planoAtivoId}`
                          : `/admin/montar?userId=${a.id}`
                      }
                      title={a.planoAtivoId
                        ? 'Abrir o treino ativo para editar'
                        : 'Montar um treino para este aluno'}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-white/10 bg-surface-light hover:text-primary hover:border-primary/40 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {a.planoAtivoId ? 'Editar' : 'Montar'}
                    </Link>
                    <Link
                      href={`/admin/preview?userId=${a.id}`}
                      title="Ver o treino como o aluno vê"
                      className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-white/10 bg-surface-light text-foreground-muted hover:text-primary hover:border-primary/40 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Ver
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-foreground-muted mt-5 text-center">
        {lista.length} {lista.length === 1 ? 'aluno' : 'alunos'}
        {busca ? ` com "${busca}" no nome` : ' · em ordem de atenção, não alfabética'}
      </p>
    </div>
  );
}
