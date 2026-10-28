/**
 * Idade mínima para usar o VegaFit.
 *
 * O QUE ESTAVA ERRADO
 *
 * A política de privacidade diz, desde que foi publicada: "O VegaFit não é direcionado a
 * menores de 18 anos." O app dizia outra coisa.
 *
 * Medido em 22/10/2026:
 *   - o seletor do onboarding tinha piso 14 (`adjustNumber(setAge, -1, 14, 100)`). Não era
 *     ausência de regra: era uma regra escrita que CONTRADIZIA o documento publicado. Alguém
 *     decidiu que 14 era aceitável.
 *   - o campo da anamnese, onde entra lesão e medicamento, era número livre, sem mínimo nem
 *     máximo. Aceitava qualquer coisa.
 *
 * Os dois juntos: o app convidava um garoto de 14, aceitava o dado de saúde dele e prescrevia
 * carga, enquanto a política afirmava que isso não acontecia.
 *
 * Decisão do profissional em 28/10/2026: vale 18, e o app passa a dizer a mesma coisa que o
 * documento.
 *
 * O QUE ISTO NÃO FAZ
 *
 * Não impede ninguém de mentir a idade — nada impede. O objetivo é parar de OFERECER 14 e
 * fazer o produto concordar com o que foi publicado. Se um responsável reclamar, o documento
 * e o app dizem a mesma coisa.
 */

export const IDADE_MINIMA = 18;

/** Acima disso é erro de digitação, não pessoa: 150 anos não treina. */
export const IDADE_MAXIMA = 100;

/**
 * A idade informada serve?
 *
 * Devolve a mensagem do problema, ou `null` quando está tudo certo. Mensagem em vez de
 * booleano porque a tela precisa dizer O QUE fazer: "esse campo é obrigatório" seria errado
 * para quem digitou 16, e foi esse o texto genérico que a anamnese mostrava para tudo.
 */
export function validarIdade(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') {
    return 'Informe sua idade.';
  }

  const n = typeof valor === 'number' ? valor : Number(String(valor).trim());

  if (!Number.isFinite(n)) return 'Informe sua idade em números.';
  // Idade é inteiro: 17,9 anos não é maior de idade, e aceitar fração abriria a porta para
  // "17.99" passar num campo que compara com >= 18.
  if (!Number.isInteger(n)) return 'Informe a idade em anos inteiros.';

  if (n < IDADE_MINIMA) {
    return `O VegaFit é para maiores de ${IDADE_MINIMA} anos.`;
  }
  if (n > IDADE_MAXIMA) {
    return `Confira a idade: o máximo é ${IDADE_MAXIMA} anos.`;
  }

  return null;
}
