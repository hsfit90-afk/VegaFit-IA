"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Dumbbell, Loader2, Check } from 'lucide-react';
import { EQUIPAMENTOS, resumirAusentes } from '@/lib/equipamentoAusente';

/**
 * "O que a minha academia não tem" — opcional, no Perfil.
 *
 * POR QUE NÃO ESTÁ NA ANAMNESE
 *
 * A anamnese já tem 48 perguntas. Somar doze caixas ali aumentaria a desistência no cadastro
 * para resolver um problema que nem todo aluno tem. Aqui fica para quem quiser ajustar depois
 * de perceber, na prática, que um aparelho não existe na academia dele — que é quando a
 * pessoa realmente sabe a resposta.
 *
 * POR QUE MARCA O QUE FALTA
 *
 * Não preencher nada significa "recebo tudo", que é o comportamento de hoje e o certo para a
 * maioria. Se a lista fosse do que TEM, quem ignorasse a tela ficaria sem treino nenhum.
 *
 * NÃO CUSTA IA: o corte acontece no servidor, antes de montar o prompt.
 */
export function MinhaAcademia() {
  const toast = useToast();
  const [ausentes, setAusentes] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('equipamentos_ausentes')
        .eq('id', user.id)
        .maybeSingle();
      if (!vivo) return;
      setAusentes(data?.equipamentos_ausentes ?? []);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, []);

  const alternar = (id: string) =>
    setAusentes(a => (a.includes(id) ? a.filter(x => x !== id) : [...a, id]));

  const salvar = async () => {
    setSalvando(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sessão expirada.');
      const { error } = await supabase
        .from('profiles')
        .update({ equipamentos_ausentes: ausentes })
        .eq('id', user.id);
      if (error) throw new Error(error.message);
      toast.sucesso('Pronto. Seus próximos treinos já respeitam isso.');
    } catch (e) {
      toast.erro(e instanceof Error ? e.message : 'Não consegui salvar.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return null;

  return (
    <Card>
      <CardContent className="p-6">
        <button
          onClick={() => setAberto(a => !a)}
          aria-expanded={aberto}
          className="w-full flex items-center gap-4 text-left"
        >
          <div className="w-11 h-11 rounded-xl bg-surface-light flex items-center justify-center flex-none">
            <Dumbbell className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-outfit font-bold">Minha academia</p>
            <p className="text-xs text-foreground-muted mt-0.5">
              {ausentes.length === 0
                ? 'Falta algum aparelho? Marque para não aparecer nos seus treinos.'
                : `${ausentes.length} ${ausentes.length === 1 ? 'aparelho marcado' : 'aparelhos marcados'}`}
            </p>
          </div>
          <span className="text-xs font-semibold text-primary flex-none">
            {aberto ? 'Fechar' : 'Ajustar'}
          </span>
        </button>

        {aberto && (
          <div className="mt-5 pt-5 border-t border-border flex flex-col gap-4 animate-fade-in">
            <p className="text-sm text-foreground-muted">
              Marque o que a sua academia <strong className="text-foreground">não tem</strong>.
              Deixar tudo desmarcado é o normal — você recebe o catálogo completo.
            </p>

            <div className="grid sm:grid-cols-2 gap-2">
              {EQUIPAMENTOS.map(eq => {
                const marcado = ausentes.includes(eq.id);
                return (
                  <button
                    key={eq.id}
                    onClick={() => alternar(eq.id)}
                    aria-pressed={marcado}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      marcado
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border bg-surface hover:bg-surface-hover'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md flex-none flex items-center justify-center mt-0.5 border ${
                      marcado ? 'bg-primary border-primary' : 'border-border-light'
                    }`}>
                      {marcado && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-tight">{eq.rotulo}</span>
                      {eq.ajuda && (
                        <span className="block text-[11px] text-foreground-muted mt-0.5 leading-snug">{eq.ajuda}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-foreground-muted">{resumirAusentes(ausentes)}</p>

            <Button onClick={salvar} disabled={salvando} className="w-full sm:w-auto sm:self-start">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
