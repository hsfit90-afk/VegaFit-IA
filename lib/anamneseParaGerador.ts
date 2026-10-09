// Traduz as respostas da anamnese para o vocabulário do gerador.
//
// A anamnese pergunta como se pergunta a uma pessoa ("Tempo disponível por sessão: 45 min",
// "Frequência semanal atual: 1-2x"). O gerador trabalha com números. A conversão é pequena,
// mas decide o treino que o aluno recebe — e errar "6x+" ou "1-2x" é a diferença entre um
// plano que cabe na semana dele e um que não cabe.

/** O primeiro objetivo marcado. A anamnese permite marcar vários; a geração usa um. */
export function primeiroObjetivo(valor: unknown): string | null {
  if (Array.isArray(valor)) {
    const primeiro = valor.find(v => typeof v === 'string' && v.trim());
    return primeiro ? String(primeiro).trim() : null;
  }
  if (typeof valor === 'string' && valor.trim()) return valor.trim();
  return null;
}

/** "45 min" -> 45, "90 min+" -> 90. Fora de 20..120, devolve null e quem chama usa o padrão. */
export function minutosDaSessao(valor: unknown): number | null {
  const achado = String(valor ?? '').match(/\d+/);
  if (!achado) return null;
  const n = Number(achado[0]);
  return n >= 20 && n <= 120 ? n : null;
}

/**
 * "3x" -> 3, "6x+" -> 6, "1-2x" -> 2.
 *
 * O intervalo pega o MAIOR: quem respondeu "1-2x" consegue duas, e montar para uma só
 * entregaria menos do que a pessoa disse que aguenta. O "+" não soma nada — 7 dias de treino
 * de força por semana não é prescrição, é falta de descanso.
 */
export function diasPorSemana(valor: unknown): number | null {
  const numeros = String(valor ?? '').match(/\d+/g);
  if (!numeros || numeros.length === 0) return null;
  const n = Math.max(...numeros.map(Number));
  return n >= 1 && n <= 6 ? n : null;
}
