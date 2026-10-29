/**
 * Quantos dias seguidos o aluno treinou.
 *
 * ESTAVA DENTRO DE app/page.tsx, COMO useMemo DA TELA.
 *
 * Em 29/10/2026 os blocos de número saíram do painel para a aba Progresso, e as duas telas
 * passaram a precisar da mesma conta: o painel ainda mostra a chama no cabeçalho, e o
 * Progresso mostra as conquistas, que dependem dela. Copiar a conta criaria duas respostas
 * possíveis para "quantos dias seguidos" — e a que o aluno vê em cada tela seria a da tela.
 *
 * A lógica é a mesma, linha por linha. Nada mudou de comportamento na extração.
 *
 * O QUE CONTA COMO SEGUIDO
 *
 * Dia, não treino: dois treinos no mesmo dia contam um. O aluno que faz manhã e noite não
 * ganha dois dias de sequência.
 *
 * A sequência precisa alcançar HOJE ou ONTEM. Ontem conta porque quem treinou ontem e ainda
 * não treinou hoje não quebrou nada — o dia não acabou. Se o último treino foi anteontem, a
 * sequência é zero, não "a sequência de antes".
 *
 * UMA RESSALVA QUE VALE FICAR ESCRITA
 *
 * O passo entre dias é 86.400.000 ms fixos. Em fuso com horário de verão, o dia da virada tem
 * 23 ou 25 horas e a conta erraria por uma casa. O Brasil não tem horário de verão desde
 * 2019, então hoje não acontece — mas se um dia voltar, é aqui que quebra.
 */

const UM_DIA_MS = 86_400_000;

/** Só o que esta conta precisa de um treino do histórico. */
type TreinoFeito = { date: number };

export function diasSeguidos(history: TreinoFeito[], agora: number): number {
  if (history.length === 0) return 0;

  // Agrupa por dia, ignorando o horário, e ordena do mais recente para o mais antigo.
  const dias = Array.from(new Set(history.map(h => new Date(h.date).setHours(0, 0, 0, 0))))
    .sort((a, b) => b - a);

  const hoje = new Date(agora).setHours(0, 0, 0, 0);
  const ontem = hoje - UM_DIA_MS;

  if (dias[0] !== hoje && dias[0] !== ontem) return 0;

  let sequencia = 0;
  let esperado = dias[0];
  for (const dia of dias) {
    if (dia !== esperado) break;
    sequencia++;
    esperado -= UM_DIA_MS;
  }

  return sequencia;
}
