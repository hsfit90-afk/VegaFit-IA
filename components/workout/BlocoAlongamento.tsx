"use client";

import { useState } from 'react';
import { StretchHorizontal, ChevronDown, Check, ImageOff, Maximize2 } from 'lucide-react';
import { VisualizadorDeMidia } from '@/components/workout/VisualizadorDeMidia';
import type { ExercicioDePreparo } from '@/lib/types';

/**
 * Alongamento no fim do treino, quando o profissional prescreveu.
 *
 * NÃO APARECE SOZINHO, e isso é decisão do CREF: no app, alongar é livre e o aluno escolhe na
 * tela própria, a qualquer hora. Este bloco só existe quando alguém montou o treino à mão e
 * decidiu o que ele deve alongar — o produto pago, em que a escolha faz parte do que foi
 * comprado.
 *
 * Gêmeo do BlocoAquecimento de propósito: mesma estrutura, mesmo comportamento, só muda o
 * rótulo e a posição. O aluno não precisa aprender duas interações para a mesma coisa.
 */
interface ExercicioDaBiblioteca {
  id?: string;
  name: string;
  mediaUrl?: string | null;
}

/**
 * `biblioteca` vem da tela de execução, que já a carrega para os exercícios de força.
 *
 * Sem a imagem, o aquecimento era só uma lista de nomes — e "Catavento corporal" não diz nada
 * a quem nunca viu. Exatamente o problema que o app resolve no treino de força, repetido no
 * aquecimento por eu ter esquecido de passar a mídia.
 */
export function BlocoAlongamento({
  itens,
  biblioteca = [],
}: {
  itens?: ExercicioDePreparo[] | null;
  biblioteca?: ExercicioDaBiblioteca[];
}) {
  const [aberto, setAberto] = useState(false);
  const [feitos, setFeitos] = useState<Set<string>>(new Set());
  const [ampliado, setAmpliado] = useState<{ midia: string; titulo: string; subtitulo?: string | null } | null>(null);

  if (!itens?.length) return null;

  // Mesma busca da tela de força: por id, e depois por nome, porque plano antigo pode ter
  // guardado o exercício sem id.
  const midiaDe = (item: ExercicioDePreparo): string | null => {
    const porId = item.exerciseId ? biblioteca.find(e => e.id === item.exerciseId) : undefined;
    const achado = porId ?? biblioteca.find(
      e => e.name.trim().toLowerCase() === item.name.trim().toLowerCase()
    );
    return achado?.mediaUrl ?? null;
  };

  const alternar = (nome: string) =>
    setFeitos(f => {
      const novo = new Set(f);
      novo.has(nome) ? novo.delete(nome) : novo.add(nome);
      return novo;
    });

  const todosFeitos = feitos.size === itens.length;

  return (
    <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 overflow-hidden">
      <VisualizadorDeMidia
        midia={ampliado?.midia ?? null}
        titulo={ampliado?.titulo ?? ''}
        subtitulo={ampliado?.subtitulo}
        onFechar={() => setAmpliado(null)}
      />
      <button
        onClick={() => setAberto(a => !a)}
        aria-expanded={aberto}
        className="w-full flex items-center gap-3 p-5 text-left"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-none transition-colors ${
          todosFeitos ? 'bg-primary/20' : 'bg-primary/15'
        }`}>
          {todosFeitos
            ? <Check className="w-4.5 h-4.5 text-primary" />
            : <StretchHorizontal className="w-4.5 h-4.5 text-primary" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-outfit font-bold text-sm">Alongamento · no fim</p>
          <p className="text-xs text-foreground-muted mt-0.5">
            {todosFeitos
              ? 'Pronto. Treino fechado.'
              : `${itens.length} alongamentos, prescritos para você neste dia.`}
          </p>
        </div>

        <ChevronDown className={`w-4 h-4 text-foreground-muted flex-none transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && (
        <div className="px-4 pb-4 flex flex-col gap-2 animate-fade-in">
          {itens.map(item => {
            const feito = feitos.has(item.name);
            const midia = midiaDe(item);
            return (
              /* A LINHA DEIXOU DE SER UM BOTAO SO: a imagem abre o visualizador e o resto
                 marca como feito. Dois alvos, e botao dentro de botao e HTML invalido. */
              <div
                key={item.name}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  feito ? 'border-primary/40 bg-primary/10' : 'border-border bg-surface'
                }`}
              >
                {/* A imagem é o ponto do bloco: "Catavento corporal" não diz nada a quem nunca
                    viu o movimento. object-contain para não cortar os pés, mesma correção que
                    a tela de força já tinha recebido. Toque amplia — 64px no celular não
                    mostra se o cotovelo abre ou fecha. */}
                <button
                  type="button"
                  onClick={() => midia && setAmpliado({ midia, titulo: item.name, subtitulo: item.muscleGroup })}
                  disabled={!midia}
                  aria-label={midia ? `Ver ${item.name} ampliado` : undefined}
                  className="w-20 h-20 rounded-lg bg-black/40 flex-none grid place-items-center overflow-hidden relative"
                >
                  {midia ? (
                    <>
                      {midia.endsWith('.mp4') ? (
                        <video
                          src={midia}
                          autoPlay loop muted playsInline
                          className="w-full h-full object-contain opacity-90"
                        />
                      ) : (
                        <img src={midia} alt="" className="w-full h-full object-contain opacity-90" />
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
                  onClick={() => alternar(item.name)}
                  aria-pressed={feito}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <span className={`w-5 h-5 rounded-lg flex-none grid place-items-center border ${
                    feito ? 'bg-primary border-primary' : 'border-border-light'
                  }`}>
                    {feito && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                  </span>

                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm leading-tight ${feito ? 'line-through text-foreground-muted' : ''}`}>
                      {item.name}
                    </span>
                    {item.muscleGroup && (
                      <span className="block text-[11px] text-foreground-muted mt-0.5">{item.muscleGroup}</span>
                    )}
                  </span>
                  <span className="text-xs font-mono text-primary flex-none tabular-nums">{item.segundos}s</span>
                </button>
              </div>
            );
          })}
          <p className="text-[11px] text-foreground-muted mt-1">
            Marcar é opcional — serve só para você não perder o fio.
          </p>
        </div>
      )}
    </div>
  );
}
