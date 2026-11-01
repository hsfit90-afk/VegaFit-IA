/**
 * As respostas da anamnese que têm coluna própria no perfil.
 *
 * O DEFEITO QUE ISTO CONSERTA
 *
 * Até 01/11/2026 a anamnese perguntava nome, idade, sexo biológico, altura e peso — e não
 * gravava NENHUM dos cinco nas colunas do perfil. O `update` em `app/anamnese/page.tsx` só
 * escrevia `intent` (o texto corrido inteiro), `goal`, `level`, `training_location` e
 * `equipamentos_casa`. Os cinco dados numéricos ficavam presos dentro do texto livre e do JSON
 * de `anamnese_history`, onde nenhuma conta do app consegue lê-los.
 *
 * O profissional viu pelo sintoma: respondeu "Peso atual: 110" na anamnese e o painel seguiu
 * mostrando 90 kg.
 *
 * POR QUE ISSO FICOU CARO AGORA
 *
 * Em 01/11/2026 a conta de macros passou a ler `weight`, `height`, `age` e `gender` do perfil
 * (ver `lib/nutricao.ts`). Com a anamnese não escrevendo esses campos:
 *
 *  - o plano alimentar sai calculado sobre o peso do onboarding, que pode ter meses;
 *  - o **sexo biológico** nunca chega ao perfil, embora a anamnese pergunte. Então a nutrição
 *    responde "falta o sexo" a quem acabou de respondê-lo. Em Mifflin-St Jeor esse campo vale
 *    166 kcal por dia.
 *
 * A REGRA: NA DÚVIDA, NÃO ESCREVE
 *
 * Campo em branco, texto não numérico ou valor fora da faixa plausível é IGNORADO, e a coluna
 * mantém o que já tinha. O contrário seria pior que o defeito original: uma anamnese respondida
 * pela metade apagaria o peso correto que veio do onboarding.
 *
 * As faixas não são julgamento clínico — são só um filtro de digitação errada (vírgula no lugar
 * do ponto, dedo no teclado). Quem decide o que é saudável é o profissional, não este arquivo.
 */

/** O que vai para o `update` da tabela `profiles`. Só entra o que foi respondido e é válido. */
export type CamposDoPerfil = {
  name?: string;
  age?: number;
  gender?: 'M' | 'F';
  height?: number;
  weight?: number;
};

/** Limites de digitação, não de saúde. Fora disto é quase certamente erro de digitação. */
const FAIXAS = {
  /** O piso de 18 é a regra do produto, e vive em lib/idadeMinima.ts. Aqui é só o absurdo. */
  idade: { min: 1, max: 120 },
  altura: { min: 80, max: 250 },
  peso: { min: 20, max: 400 },
} as const;

/** Converte texto em número, aceitando vírgula decimal — "72,5" é como se digita em português. */
function numero(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== 'string') return null;

  const limpo = valor.trim().replace(',', '.');
  if (limpo === '') return null;

  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function dentroDaFaixa(n: number | null, faixa: { min: number; max: number }): number | null {
  if (n === null) return null;
  return n >= faixa.min && n <= faixa.max ? n : null;
}

/**
 * Monta o pedaço do `update` de `profiles` a partir das respostas da anamnese.
 *
 * Devolve um objeto só com as chaves que têm valor válido — espalhar isto num `update` que já
 * tem outros campos é seguro, porque chave ausente não vira `NULL` no banco.
 */
export function perfilDaAnamnese(answers: Record<string, unknown>): CamposDoPerfil {
  const campos: CamposDoPerfil = {};

  const nome = typeof answers.nome === 'string' ? answers.nome.trim() : '';
  if (nome !== '') campos.name = nome;

  const idade = dentroDaFaixa(numero(answers.idade), FAIXAS.idade);
  if (idade !== null) campos.age = Math.round(idade);

  const altura = dentroDaFaixa(numero(answers.altura), FAIXAS.altura);
  if (altura !== null) campos.height = altura;

  const peso = dentroDaFaixa(numero(answers.peso), FAIXAS.peso);
  if (peso !== null) campos.weight = peso;

  /*
   * O campo é `chips-single` com as opções "Masculino" e "Feminino" (lib/anamneseSteps.ts),
   * e a coluna guarda 'M' ou 'F'. Qualquer outra coisa não escreve nada — inclusive o caso
   * de alguém acrescentar uma terceira opção na tela e esquecer deste arquivo.
   */
  if (answers.sexo === 'Masculino') campos.gender = 'M';
  else if (answers.sexo === 'Feminino') campos.gender = 'F';

  return campos;
}

/**
 * Se o peso declarado deve virar um registro novo no histórico de peso.
 *
 * O painel e o gráfico de evolução leem `body_weight_history`, não `profiles.weight` — então
 * sem isto o aluno responde 110 na anamnese e segue vendo 90 no painel, que foi exatamente o
 * sintoma relatado.
 *
 * NÃO registra quando o peso é o mesmo do último registro. Quem refaz a anamnese no mesmo dia
 * sem ter mudado de peso não deve ganhar pontos repetidos no gráfico — a linha ficaria cheia
 * de marcas que não contam nada.
 */
export function devePesarDeNovo(
  pesoDeclarado: number | null | undefined,
  pesoMaisRecente: number | null | undefined,
): boolean {
  if (typeof pesoDeclarado !== 'number' || !Number.isFinite(pesoDeclarado)) return false;
  if (typeof pesoMaisRecente !== 'number' || !Number.isFinite(pesoMaisRecente)) return true;

  /*
   * O limiar é 100 g, com folga para o erro binário.
   *
   * Sem a folga isto erra num caso banal: `72.6 - 72.5` dá 0.09999999999999432 em ponto
   * flutuante, que é MENOR que 0.1 — e cem gramas de diferença real seriam descartados como
   * "mesmo peso". O 1e-9 é grande o bastante para cobrir o erro e pequeno demais para deixar
   * passar uma diferença que importe.
   */
  return Math.abs(pesoDeclarado - pesoMaisRecente) >= 0.1 - 1e-9;
}
