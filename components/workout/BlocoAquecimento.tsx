"use client";

import { useState } from 'react';
import { Waves, ChevronDown, Check, ImageOff } from 'lucide-react';
import type { ExercicioDePreparo } from '@/lib/types';

/**
 * Mobilidade, antes do treino.
 *
 * Fica AMARRADA à sessão, e não numa tela separada, porque a prescrição é essa: mobilidade
 * prepara a articulação que vai ser carregada naquele dia. Alongamento é o contrário — pode
 * ser feito a qualquer hora e por isso tem tela própria.
 *
 * Começa RECOLHIDO. Quem já sabe o que faz vai direto ao treino sem rolar por três linhas que
 * não mudam; quem não sabe abre e vê. Marcar como feito é opcional e não bloqueia nada: um
 * aquecimento que trava o botão de treinar vira motivo para fechar o app.
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
export function BlocoAquecimento({
  itens,
  biblioteca = [],
}: {
  itens?: ExercicioDePreparo[] | null;
  biblioteca?: ExercicioDaBiblioteca[];
}) {
  const [aberto, setAberto] = useState(false);
  const [feitos, setFeitos] = useState<Set<string>>(new Set());

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
    <div className="mb-5 rounded-2xl border border-secondary/30 bg-secondary/5 overflow-hidden">
      <button
        onClick={() => setAberto(a => !a)}
        aria-expanded={aberto}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-none transition-colors ${
          todosFeitos ? 'bg-primary/20' : 'bg-secondary/20'
        }`}>
          {todosFeitos
            ? <Check className="w-4.5 h-4.5 text-primary" />
            : <Waves className="w-4.5 h-4.5 text-secondary" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-outfit font-bold text-sm">Aquecimento · mobilidade</p>
          <p className="text-xs text-foreground-muted mt-0.5">
            {todosFeitos
              ? 'Pronto. Bom treino.'
              : `${itens.length} movimentos, cerca de 2 minutos — prepare as articulações do dia.`}
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
              <button
                key={item.name}
                onClick={() => alternar(item.name)}
                aria-pressed={feito}
                className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all ${
                  feito ? 'border-primary/40 bg-primary/10' : 'border-border bg-surface hover:bg-surface-hover'
                }`}
              >
                <span className={`w-5 h-5 rounded-md flex-none grid place-items-center border ${
                  feito ? 'bg-primary border-primary' : 'border-border-light'
                }`}>
                  {feito && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                </span>

                {/* A imagem é o ponto do bloco: "Catavento corporal" não diz nada a quem nunca
                    viu o movimento. object-contain para não cortar os pés, mesma correção que
                    a tela de força já tinha recebido. */}
                <span className="w-16 h-16 rounded-lg bg-black/40 flex-none grid place-items-center overflow-hidden">
                  {midia ? (
                    midia.endsWith('.mp4') ? (
                      <video
                        src={midia}
                        autoPlay loop muted playsInline
                        className="w-full h-full object-contain opacity-90"
                      />
                    ) : (
                      <img src={midia} alt="" className="w-full h-full object-contain opacity-90" />
                    )
                  ) : (
                    <ImageOff className="w-4 h-4 text-foreground-muted/40" />
                  )}
                </span>

                <span className="flex-1 min-w-0">
                  <span className={`block text-sm leading-tight ${feito ? 'line-through text-foreground-muted' : ''}`}>
                    {item.name}
                  </span>
                  {item.muscleGroup && (
                    <span className="block text-[11px] text-foreground-muted mt-0.5">{item.muscleGroup}</span>
                  )}
                </span>
                <span className="text-xs font-mono text-secondary flex-none tabular-nums">{item.segundos}s</span>
              </button>
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
