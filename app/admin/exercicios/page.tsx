"use client";

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useSomenteMaster } from '@/components/useSomenteMaster';
import { useToast } from '@/components/ui/Toast';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Loader2, Search, Heart, Ban, Minus, ImageOff } from 'lucide-react';
import { PADDING_TELA, LARGURA_CONTEUDO, RODAPE_SEGURO } from '@/lib/layout';

/**
 * Exercícios fixos e proibidos por aluno, na mão do profissional.
 *
 * O PROBLEMA QUE RESOLVE
 *
 * O aluno já marcava coração e lixeira na tela de treino, mas quem tem o CREF não tinha como
 * marcar por ele. Para garantir um exercício específico, a única saída era montar o treino
 * inteiro à mão no /admin/montar — quarenta minutos para resolver uma linha.
 *
 * TRÊS ESTADOS, UM BOTÃO CADA
 *
 * Sempre, nunca e neutro. Clicar em "sempre" tira de "nunca" e vice-versa, porque o mesmo
 * exercício nas duas listas seria descartado em silêncio: a geração filtra os banidos antes
 * de olhar os favoritos.
 *
 * O QUE CADA MARCA GARANTE, DE FATO
 *
 * Banido é regra dura — o exercício sai do catálogo em código, antes do prompt. Favorito é
 * pedido: entra no prompt como preferência, e pode não aparecer se o dia não tiver o grupo
 * muscular dele. A tela diz isso em voz alta, porque prometer garantia que não existe é o
 * tipo de coisa que quebra a confiança no app.
 */

interface Aluno { id: string; name: string | null; role: string | null }
interface Exercicio { id: string; name: string; muscle_group: string | null; mediaUrl: string | null }

type Marca = 'favorito' | 'banido' | 'nenhum';

const MOSTRAR_NA_BUSCA = 40;

export default function ExerciciosPorAluno() {
  const ehMaster = useSomenteMaster();
  const toast = useToast();

  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [catalogo, setCatalogo] = useState<Exercicio[]>([]);
  const [alunoId, setAlunoId] = useState('');
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const [banidos, setBanidos] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [carregandoAluno, setCarregandoAluno] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [r, cat] = await Promise.all([
        fetch('/api/admin/plano'),
        supabase.from('exercises').select('id, name, muscle_group, media_url').order('name').limit(1000),
      ]);
      if (r.ok) setAlunos((await r.json()).alunos ?? []);
      setCatalogo(
        (cat.data ?? []).map(e => ({
          id: e.id, name: e.name, muscle_group: e.muscle_group, mediaUrl: e.media_url,
        }))
      );
      setCarregando(false);
    })();
  }, []);

  // Troca de aluno recarrega as listas DO BANCO. Guardar em memória por aluno pareceria mais
  // rápido, mas o aluno pode ter marcado algo no celular dele nesse meio-tempo.
  useEffect(() => {
    if (!alunoId) { setFavoritos([]); setBanidos([]); return; }
    (async () => {
      setCarregandoAluno(true);
      try {
        const r = await fetch(`/api/admin/exercicios?userId=${encodeURIComponent(alunoId)}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Não consegui carregar.');
        setFavoritos(d.favoritos ?? []);
        setBanidos(d.banidos ?? []);
      } catch (e) {
        toast.erro(e instanceof Error ? e.message : 'Não consegui carregar.');
        setFavoritos([]); setBanidos([]);
      } finally {
        setCarregandoAluno(false);
      }
    })();
  }, [alunoId]);

  const marcaDe = (id: string): Marca =>
    favoritos.includes(id) ? 'favorito' : banidos.includes(id) ? 'banido' : 'nenhum';

  const marcar = async (ex: Exercicio, lista: Marca) => {
    if (!alunoId) { toast.erro('Escolha o aluno primeiro.'); return; }
    setSalvando(ex.id);
    try {
      const r = await fetch('/api/admin/exercicios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: alunoId, exerciseId: ex.id, lista }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Não consegui alterar.');

      // As listas vêm da resposta, não de palpite local: se a rota recusou algo (teto por
      // lista) ou ajustou mais do que foi pedido, a tela mostra o estado real.
      setFavoritos(d.favoritos ?? []);
      setBanidos(d.banidos ?? []);

      toast.sucesso(
        lista === 'favorito' ? `${ex.name}: priorizar.`
        : lista === 'banido' ? `${ex.name}: nunca prescrever.`
        : `${ex.name}: sem marca.`
      );
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : 'Não consegui alterar.');
    } finally {
      setSalvando(null);
    }
  };

  // Marcados primeiro, sempre visíveis, mesmo fora da busca — é o que responde "o que eu já
  // defini para este aluno?" sem obrigar a procurar nome por nome.
  const marcados = useMemo(() => {
    const ids = [...favoritos, ...banidos];
    return catalogo.filter(e => ids.includes(e.id));
  }, [catalogo, favoritos, banidos]);

  const resultados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (t.length < 2) return [];
    return catalogo
      .filter(e =>
        e.name.toLowerCase().includes(t) || (e.muscle_group ?? '').toLowerCase().includes(t)
      )
      .slice(0, MOSTRAR_NA_BUSCA);
  }, [catalogo, busca]);

  if (!ehMaster || carregando) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  const linha = (ex: Exercicio) => {
    const marca = marcaDe(ex.id);
    const ocupado = salvando === ex.id;
    return (
      <div
        key={ex.id}
        className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
          marca === 'favorito' ? 'border-primary/40 bg-primary/5'
          : marca === 'banido' ? 'border-destructive/40 bg-destructive/5'
          : 'border-border bg-surface'
        }`}
      >
        <span className="w-14 h-14 rounded-xl bg-black/40 grid place-items-center overflow-hidden flex-none">
          {ex.mediaUrl ? (
            ex.mediaUrl.endsWith('.mp4') ? (
              <video src={ex.mediaUrl} muted playsInline className="w-full h-full object-contain opacity-90" />
            ) : (
              <img src={ex.mediaUrl} alt="" className="w-full h-full object-contain opacity-90" />
            )
          ) : (
            <ImageOff className="w-4 h-4 text-foreground-muted/40" />
          )}
        </span>

        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium leading-tight truncate">{ex.name}</span>
          <span className="block text-xs text-foreground-muted mt-0.5 truncate">{ex.muscle_group || '--'}</span>
        </span>

        <div className="flex gap-1.5 flex-none">
          <button
            onClick={() => marcar(ex, 'favorito')}
            disabled={ocupado || marca === 'favorito'}
            title="Priorizar: pedir à IA que inclua quando o dia tiver esse grupo muscular"
            className={`p-2 rounded-xl border transition-colors ${
              marca === 'favorito'
                ? 'bg-primary/20 text-primary border-primary/40'
                : 'bg-surface-light border-white/5 text-foreground-muted hover:text-primary hover:bg-primary/10 disabled:opacity-40'
            }`}
          >
            <Heart className={`w-4 h-4 ${marca === 'favorito' ? 'fill-primary' : ''}`} />
          </button>
          <button
            onClick={() => marcar(ex, 'banido')}
            disabled={ocupado || marca === 'banido'}
            title="Nunca prescrever: sai do catálogo deste aluno antes da geração"
            className={`p-2 rounded-xl border transition-colors ${
              marca === 'banido'
                ? 'bg-destructive/20 text-destructive border-destructive/40'
                : 'bg-surface-light border-white/5 text-foreground-muted hover:text-destructive hover:bg-destructive/10 disabled:opacity-40'
            }`}
          >
            <Ban className="w-4 h-4" />
          </button>
          <button
            onClick={() => marcar(ex, 'nenhum')}
            disabled={ocupado || marca === 'nenhum'}
            title="Tirar a marca"
            className="p-2 rounded-xl border bg-surface-light border-white/5 text-foreground-muted hover:text-foreground disabled:opacity-30 transition-colors"
          >
            {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`${PADDING_TELA} ${LARGURA_CONTEUDO} mx-auto animate-fade-in ${RODAPE_SEGURO} space-y-6`}>
      <header>
        <h1 className="text-3xl md:text-4xl font-outfit font-bold mb-2">Exercícios por aluno</h1>
        <p className="text-foreground-muted text-sm leading-relaxed max-w-prose">
          Fixe o que este aluno deve fazer e proíba o que ele não deve. Vale para todo treino
          gerado daqui em diante — o plano que ele já tem não muda.
        </p>
      </header>

      <Card>
        <CardContent className="p-4 space-y-3">
          <label className="block text-sm font-medium">Aluno</label>
          <select
            value={alunoId}
            onChange={e => setAlunoId(e.target.value)}
            className="w-full bg-surface-light border border-border rounded-xl px-4 py-3 text-sm"
          >
            <option value="">Escolha um aluno...</option>
            {alunos.map(a => (
              <option key={a.id} value={a.id}>{a.name || 'Sem nome'}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {alunoId && carregandoAluno && (
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando as marcas deste aluno...
        </div>
      )}

      {alunoId && !carregandoAluno && (
        <>
          {/* A diferença de peso entre as duas marcas precisa estar escrita na tela. Banido é
              garantia; favorito é preferência, e um profissional que confunde os dois promete
              ao aluno algo que o app não cumpre. */}
          <div className="text-xs text-foreground-muted bg-surface rounded-xl p-4 border border-border space-y-1.5">
            <p>
              <Ban className="w-3.5 h-3.5 inline mr-1.5 text-destructive" />
              <strong className="text-foreground">Nunca prescrever</strong> é garantido: o exercício é
              removido antes da geração.
            </p>
            <p>
              <Heart className="w-3.5 h-3.5 inline mr-1.5 text-primary" />
              <strong className="text-foreground">Priorizar</strong> é preferência: entra se o dia tiver o
              grupo muscular e couber no volume. Para garantir exercício e ordem, use o montador.
            </p>
          </div>

          {marcados.length > 0 && (
            <section>
              <h2 className="text-lg font-outfit font-bold mb-3">Já definidos ({marcados.length})</h2>
              <div className="flex flex-col gap-2">{marcados.map(linha)}</div>
            </section>
          )}

          <section>
            <h2 className="text-lg font-outfit font-bold mb-3">Procurar no catálogo</h2>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
              <Input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Nome do exercício ou grupo muscular"
                className="pl-9"
              />
            </div>

            {busca.trim().length < 2 ? (
              <p className="text-sm text-foreground-muted">
                Digite ao menos duas letras. São {catalogo.length} exercícios no catálogo.
              </p>
            ) : resultados.length === 0 ? (
              <p className="text-sm text-foreground-muted">Nada com esse nome.</p>
            ) : (
              <>
                <div className="flex flex-col gap-2">{resultados.map(linha)}</div>
                {resultados.length === MOSTRAR_NA_BUSCA && (
                  <p className="text-xs text-foreground-muted mt-3">
                    Mostrando os {MOSTRAR_NA_BUSCA} primeiros. Refine a busca para ver o resto.
                  </p>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
