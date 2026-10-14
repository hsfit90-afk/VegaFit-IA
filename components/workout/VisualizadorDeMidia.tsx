"use client";

import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * O GIF do exercício em tela cheia, ao toque.
 *
 * POR QUE EXISTE
 *
 * As miniaturas tinham 64 a 80 pixels. Num monitor dá para entender o movimento; num celular
 * não — e celular é onde o app é usado, de pé, no meio do treino. O aluno não consegue ver se
 * o cotovelo fecha ou abre, que é justamente a informação pela qual ele abriu o app.
 *
 * AMPLIAR NO TOQUE EM VEZ DE AUMENTAR A LISTA. Deixar toda miniatura grande resolveria para
 * quem olha uma e atrapalharia quem percorre seis: a lista viraria rolagem infinita, e o
 * aquecimento inteiro deixaria de caber numa tela. Grande quando se quer, pequeno quando se
 * está escolhendo.
 *
 * Fecha no fundo, no X e no Escape — os três, porque num celular o polegar acha o fundo antes
 * de achar o X, e num teclado a mão já está no Escape.
 */
export function VisualizadorDeMidia({
  midia,
  titulo,
  subtitulo,
  onFechar,
}: {
  midia: string | null;
  titulo: string;
  subtitulo?: string | null;
  onFechar: () => void;
}) {
  useEffect(() => {
    if (!midia) return;

    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);

    // Trava a rolagem do fundo: sem isso, arrastar o dedo sobre a imagem rola a lista
    // atrás dela, e ao fechar a pessoa perdeu o lugar onde estava.
    const rolagemAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = rolagemAnterior;
    };
  }, [midia, onFechar]);

  if (!midia) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={onFechar}
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in"
    >
      <button
        onClick={onFechar}
        aria-label="Fechar"
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* O clique na mídia não fecha: a pessoa vai querer olhar sem medo de perder a tela. */}
      <div onClick={e => e.stopPropagation()} className="w-full max-w-lg">
        <div className="w-full aspect-square rounded-2xl bg-white/5 overflow-hidden grid place-items-center">
          {midia.endsWith('.mp4') ? (
            <video src={midia} autoPlay loop muted playsInline className="w-full h-full object-contain" />
          ) : (
            <img src={midia} alt={titulo} className="w-full h-full object-contain" />
          )}
        </div>

        <p className="text-white font-outfit font-bold text-lg mt-4 text-center leading-tight">{titulo}</p>
        {subtitulo && (
          <p className="text-white/60 text-sm text-center mt-1">{subtitulo}</p>
        )}
      </div>

      <p className="text-white/40 text-xs mt-6">Toque fora para fechar</p>
    </div>
  );
}
