import { cn } from '@/lib/utils';
import type { DiaDaSemana } from '@/lib/painelDeHoje';

/**
 * Os sete dias da semana, de segunda a domingo, com o estado de cada um.
 *
 * O QUE ELA RESPONDE
 *
 * "Como foi a minha semana" — a pergunta que o painel não respondia sem abrir o Progresso. É
 * a informação de constância em uma linha, que é o formato em que ela realmente se lê: um
 * número ("3 treinos") diz menos que ver dois quadrados acesos seguidos e um apagado no meio.
 *
 * QUATRO ESTADOS, E O QUARTO NÃO É "DESCANSO"
 *
 * O desenho pedia feito / hoje / futuro / descanso. Os três primeiros existem no dado. O
 * quarto não: o app não guarda calendário de descanso, só a lista de treinos do plano. Um dia
 * passado sem treino pode ter sido descanso prescrito ou falta, e o app não sabe qual — então
 * ele desenha o contorno tracejado que estava reservado para o descanso, mas o chama pelo que
 * o dado diz: "sem treino". A regra está em `lib/painelDeHoje.ts`.
 *
 * NÃO É CLICÁVEL
 *
 * Nenhum dia leva a lugar nenhum: não existe tela de "treino da terça passada" — o histórico
 * é por treino, não por data. Quadrado que parece botão e não leva a lugar nenhum é pior que
 * quadrado parado, o mesmo motivo da lista de exercícios do painel.
 *
 * ACESSIBILIDADE
 *
 * As siglas repetem letra (S T Q Q S S D): "S" sozinho não diz se é segunda, sexta ou sábado.
 * Então a sigla é decorativa (`aria-hidden`) e cada dia carrega um rótulo escrito por
 * extenso. Quem usa leitor de tela ouve "segunda, dia 26, treino feito", não "S".
 */

const NOME_DO_DIA = [
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
  'domingo',
];

const COMO_FOI: Record<DiaDaSemana['estado'], string> = {
  feito: 'treino feito',
  hoje: 'hoje',
  futuro: 'ainda vem',
  'sem-treino': 'sem treino',
};

export function FaixaDaSemana({
  dias,
  className,
}: {
  dias: DiaDaSemana[];
  className?: string;
}) {
  return (
    <ul className={cn('flex items-center justify-between gap-1.5', className)}>
      {dias.map((dia, i) => {
        const descricao = `${NOME_DO_DIA[i]}, dia ${dia.diaDoMes}, ${
          dia.estado === 'hoje' && dia.treinou ? 'hoje, treino feito' : COMO_FOI[dia.estado]
        }`;

        return (
          <li key={i} className="flex-1 min-w-0">
            {/*
              O quadrado tem 40px de LADO mas 44px de altura de linha, com o respiro do <li>.
              Não é alvo de toque — nada aqui é clicável —, então os 40px são do desenho da
              direção Pulso e não competem com a regra de 44px, que vale para o que se toca.
            */}
            <div
              title={descricao}
              aria-label={descricao}
              className={cn(
                'h-10 w-full grid place-items-center rounded-dia',
                'text-sm font-bold tabular-nums transition-colors duration-[120ms]',
                // FEITO: preenchido da cor de marca. Preto sobre o verde dá 10,9:1.
                dia.estado === 'feito' &&
                  'bg-primary text-primary-foreground',
                // HOJE: só contorno, para o dia corrente se anunciar sem parecer concluído.
                // Quando já treinou hoje, preenche — senão o dia mais importante da faixa
                // seria o único que não mostra o que aconteceu nele.
                dia.estado === 'hoje' &&
                  (dia.treinou
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/40 ring-offset-2 ring-offset-surface'
                    : 'border-2 border-primary text-primary'),
                // SEM TREINO: tracejado. Dia que passou e não teve treino.
                dia.estado === 'sem-treino' &&
                  'border border-dashed border-border-light text-foreground-muted',
                // FUTURO: contorno apagado, sem tracejado — ainda não é ausência de nada.
                //
                // A LETRA É A MESMA COR DO DIA SEM TREINO, e isso é medido: `muted/60` sobre o
                // cartão dá 3,22:1 e REPROVA em AA, enquanto `muted` cheio dá 6,56:1. Apagar a
                // cor para marcar "ainda não chegou" custaria a legibilidade de dois a quatro
                // dias da faixa, dependendo do dia da semana. Quem diferencia futuro de
                // ausência é a BORDA — contínua apagada contra tracejada —, não o texto.
                dia.estado === 'futuro' &&
                  'border border-border text-foreground-muted',
              )}
            >
              <span aria-hidden="true">{dia.sigla}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
