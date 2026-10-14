"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Flame, ChevronDown, Check, ImageOff, Maximize2 } from 'lucide-react';
import { VisualizadorDeMidia } from '@/components/workout/VisualizadorDeMidia';
import { prescrever, normalizarObjetivo, temAbdominalNoDia } from '@/lib/protocolo';
import { filtrarParaCasa } from '@/lib/equipamentoCasa';
import { treinaEmCasa, mapAnamneseLocationToEquipment } from '@/lib/trainingLocation';

/**
 * Abdominal, no fim da sessão de força.
 *
 * POR QUE AQUI, se já existe a tela avulsa
 *
 * A prescrição do profissional (CREF, 12/10/2026) é que o abdominal esteja disponível DENTRO
 * do treino nos dias em que é para fazer. A tela avulsa continua existindo para o dia livre,
 * mas obrigar quem acabou de treinar a sair da sessão, achar o card no dashboard e abrir
 * outra tela é atrito suficiente para a maioria não fazer.
 *
 * Fica no FIM e não no começo porque é complemento: core cansado antes do agachamento tira
 * estabilidade de quem mais precisa dela.
 *
 * MESMO PADRÃO DO AQUECIMENTO: começa recolhido, marcar é opcional e não bloqueia nada.
 *
 * NÃO REGISTRA NO HISTÓRICO por decisão. Quem faz aqui já está dentro de um treino que vai
 * ser registrado; lançar uma segunda entrada duplicaria a sessão do dia e sujaria a contagem
 * de constância, que decide desbloqueio de método e progressão de nível. Quem quiser o
 * registro separado usa a tela avulsa, que grava com o prefixo "avulso-".
 */

const QUANTIDADE = 3;

interface ExercicioDaBiblioteca {
  id?: string;
  name: string;
  muscleGroup?: string | null;
  mediaUrl?: string | null;
}

export function BlocoAbdominal({
  biblioteca = [],
  semana = 1,
  objetivo,
  trainingLocation,
  equipamentosCasa,
  chaveDaSessao,
  indiceDaSessao,
}: {
  biblioteca?: ExercicioDaBiblioteca[];
  semana?: number;
  objetivo?: string | null;
  trainingLocation?: string | null;
  equipamentosCasa?: string[] | null;
  /** Mantém os mesmos três exercícios enquanto a sessão for a mesma. */
  chaveDaSessao?: string;
  /** Posição da sessão no plano. Decide se hoje é dia de abdominal. */
  indiceDaSessao?: number;
}) {
  const [aberto, setAberto] = useState(false);
  const [feitos, setFeitos] = useState<Set<string>>(new Set());
  const [ampliado, setAmpliado] = useState<ExercicioDaBiblioteca | null>(null);

  const receita = prescrever('isolado', normalizarObjetivo(objetivo), semana);

  const escolhidos = useMemo(() => {
    const core = biblioteca.filter(e => /core|abd/i.test(e.muscleGroup ?? ''));

    // Mesmo filtro do resto do app: 20 dos 97 exercícios de core pedem aparelho (bola, polia,
    // máquina, barra). Sobram 77 sem nada, então três fazíveis nunca faltam.
    const possiveis = treinaEmCasa(mapAnamneseLocationToEquipment(trainingLocation))
      ? filtrarParaCasa(core, equipamentosCasa)
      : core;

    // Sorteio ESTÁVEL: sem semente, cada re-render do treino trocaria os exercícios debaixo
    // da pessoa no meio da sessão. A chave da sessão basta — muda quando o dia muda.
    const semente = [...(chaveDaSessao ?? 'abd')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
    return [...possiveis]
      .sort((a, b) => {
        const ha = ([...a.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, semente)) % 1000;
        const hb = ([...b.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, semente)) % 1000;
        return ha - hb;
      })
      .slice(0, QUANTIDADE);
  }, [biblioteca, trainingLocation, equipamentosCasa, chaveDaSessao]);

  // Dias alternados: num plano A-B-C, abdominal é no A e no C. Ver temAbdominalNoDia.
  if (!temAbdominalNoDia(indiceDaSessao ?? 0)) return null;
  if (escolhidos.length === 0) return null;

  const alternar = (nome: string) =>
    setFeitos(f => {
      const novo = new Set(f);
      novo.has(nome) ? novo.delete(nome) : novo.add(nome);
      return novo;
    });

  const todosFeitos = feitos.size === escolhidos.length;

  return (
    <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/5 overflow-hidden">
      <VisualizadorDeMidia
        midia={ampliado?.mediaUrl ?? null}
        titulo={ampliado?.name ?? ''}
        subtitulo={ampliado?.muscleGroup}
        onFechar={() => setAmpliado(null)}
      />
      <button
        onClick={() => setAberto(a => !a)}
        aria-expanded={aberto}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-none transition-colors ${
          todosFeitos ? 'bg-primary/20' : 'bg-accent/20'
        }`}>
          {todosFeitos
            ? <Check className="w-4.5 h-4.5 text-primary" />
            : <Flame className="w-4.5 h-4.5 text-accent" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-outfit font-bold text-sm">Abdominal · depois do treino</p>
          <p className="text-xs text-foreground-muted mt-0.5">
            {todosFeitos
              ? 'Core feito. Pode fechar o treino.'
              : `${escolhidos.length} exercícios · ${receita.series} × ${receita.reps} em cada`}
          </p>
        </div>

        <ChevronDown className={`w-4 h-4 text-foreground-muted flex-none transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="px-4 pb-4 flex flex-col gap-2 animate-fade-in">
          {escolhidos.map(ex => {
            const feito = feitos.has(ex.name);
            // Mesma estrutura do aquecimento: a imagem abre o visualizador, o resto marca
            // como feito. Dois alvos, e botão dentro de botão é HTML inválido.
            return (
              <div
                key={ex.name}
                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                  feito ? 'border-primary/40 bg-primary/10' : 'border-border bg-surface'
                }`}
              >
                <button
                  type="button"
                  onClick={() => ex.mediaUrl && setAmpliado(ex)}
                  disabled={!ex.mediaUrl}
                  aria-label={ex.mediaUrl ? `Ver ${ex.name} ampliado` : undefined}
                  className="w-20 h-20 rounded-lg bg-black/40 flex-none grid place-items-center overflow-hidden relative"
                >
                  {ex.mediaUrl ? (
                    <>
                      {ex.mediaUrl.endsWith('.mp4') ? (
                        <video src={ex.mediaUrl} autoPlay loop muted playsInline className="w-full h-full object-contain opacity-90" />
                      ) : (
                        <img src={ex.mediaUrl} alt="" className="w-full h-full object-contain opacity-90" />
                      )}
                      <span className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded bg-black/60 grid place-items-center">
                        <Maximize2 className="w-2.5 h-2.5 text-white/80" />
                      </span>
                    </>
                  ) : (
                    <ImageOff className="w-4 h-4 text-foreground-muted/40" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => alternar(ex.name)}
                  aria-pressed={feito}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <span className={`w-5 h-5 rounded-md flex-none grid place-items-center border ${
                    feito ? 'bg-primary border-primary' : 'border-border-light'
                  }`}>
                    {feito && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm leading-tight ${feito ? 'line-through text-foreground-muted' : ''}`}>
                      {ex.name}
                    </span>
                    <span className="block text-[11px] text-primary mt-0.5 font-mono tabular-nums">
                      {receita.series} × {receita.reps}
                    </span>
                  </span>
                </button>
              </div>
            );
          })}

          <p className="text-[11px] text-foreground-muted mt-1">
            Marcar é opcional. Quer registrar no histórico ou trocar os exercícios?{' '}
            <Link href="/abdominal" className="text-primary underline">Abrir a sessão de abdominal</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
