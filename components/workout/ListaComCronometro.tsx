"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Play, RotateCcw, ImageOff, Check } from 'lucide-react';

/**
 * Lista de exercícios feitos POR TEMPO, com GIF e cronômetro.
 *
 * Compartilhada entre mobilidade e alongamento porque as duas telas são a mesma coisa com
 * outro conteúdo — e duas cópias divergem na primeira correção que alguém esquece de aplicar
 * nas duas. Abdominal NÃO usa isto: é treino de verdade, com série e repetição.
 *
 * O GIF é o ponto. "Catavento corporal" e "Rotação espinhal deitado" não dizem nada a quem
 * nunca viu o movimento — é o mesmo motivo de o app mostrar vídeo no treino de força.
 *
 * Um cronômetro só, do item que está rodando: dois rodando ao mesmo tempo seria o aluno
 * tentando fazer dois movimentos de uma vez.
 */

export interface ItemDaLista {
  id?: string;
  name: string;
  muscle_group?: string | null;
  mediaUrl?: string | null;
}

export function ListaComCronometro({
  itens,
  segundos,
  vazio,
}: {
  itens: ItemDaLista[];
  segundos: number;
  vazio: string;
}) {
  const [rodando, setRodando] = useState<string | null>(null);
  const [restam, setRestam] = useState(segundos);
  const [feitos, setFeitos] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!rodando) return;
    if (restam <= 0) {
      // Ao zerar, marca como feito sozinho: quem acabou de segurar a posição não quer parar
      // para tocar num botão de confirmação.
      setFeitos(f => new Set(f).add(rodando));
      setRodando(null);
      setRestam(segundos);
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(120);
      return;
    }
    const t = setTimeout(() => setRestam(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [rodando, restam, segundos]);

  if (itens.length === 0) {
    return (
      <Card><CardContent className="p-6 text-center text-sm text-foreground-muted">{vazio}</CardContent></Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {itens.map(item => {
        const chave = item.id ?? item.name;
        const ativo = rodando === chave;
        const feito = feitos.has(chave);

        return (
          <Card key={chave} className={ativo ? 'border-primary/50' : feito ? 'border-primary/25' : ''}>
            <CardContent className="p-3 flex items-center gap-3">
              {/* object-contain, não cover: a correção de 23/09, quando o gif cortava os pés. */}
              <div className="w-20 h-20 rounded-xl bg-black/40 grid place-items-center overflow-hidden flex-none">
                {item.mediaUrl ? (
                  item.mediaUrl.endsWith('.mp4') ? (
                    <video src={item.mediaUrl} autoPlay loop muted playsInline
                      className="w-full h-full object-contain opacity-90" />
                  ) : (
                    <img src={item.mediaUrl} alt="" className="w-full h-full object-contain opacity-90" />
                  )
                ) : (
                  <ImageOff className="w-5 h-5 text-foreground-muted/40" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-tight ${feito ? 'text-foreground-muted' : ''}`}>
                  {item.name}
                </p>
                {item.muscle_group && (
                  <p className="text-[11px] text-foreground-muted mt-0.5">{item.muscle_group}</p>
                )}
                {feito && !ativo && (
                  <p className="text-[11px] text-primary mt-1 flex items-center gap-1">
                    <Check className="w-3 h-3" /> feito
                  </p>
                )}
              </div>

              {ativo ? (
                <div className="flex items-center gap-2 flex-none">
                  <span className="font-mono font-bold text-primary tabular-nums text-xl w-11 text-right">
                    {restam}s
                  </span>
                  <button
                    onClick={() => { setRodando(null); setRestam(segundos); }}
                    aria-label="Parar"
                    className="w-9 h-9 rounded-xl bg-surface-light grid place-items-center text-foreground-muted hover:text-foreground"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setRodando(chave); setRestam(segundos); }}
                  aria-label={`Cronometrar ${item.name}`}
                  className="w-10 h-10 rounded-xl bg-surface-light grid place-items-center text-primary hover:bg-primary/20 transition-colors flex-none"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
