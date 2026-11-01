/**
 * TMB, gasto energético e macronutrientes. Conta pura, sem banco e sem rede.
 *
 * POR QUE ISTO EXISTE
 *
 * Até 01/11/2026 não havia cálculo nenhum no código: `app/api/nutrition/route.ts` pedia à IA
 * "calcule a TMB, o GET e a divisão de macros" dentro do texto do prompt. Três consequências,
 * e nenhuma aparecia em teste porque não havia teste:
 *
 *  - **Modelo de linguagem não é calculadora.** A mesma pessoa podia receber TMB diferente em
 *    duas gerações, e não havia como saber qual estava certa — não existia um "certo" escrito
 *    em lugar nenhum.
 *  - **O sexo biológico não era enviado.** A coluna `gender` existe desde
 *    `database/11_rcq_metrics.sql` e a anamnese já usa sexo para a referência da OMS no RCQ,
 *    mas o prompt mandava só nome, idade, peso, altura e objetivo. Em Mifflin-St Jeor a
 *    diferença entre homem e mulher é uma constante de 166 kcal — a IA chutava pelo nome.
 *  - **O nível de atividade estava cravado em texto** ("assumindo treinos de força de 4 a 5
 *    vezes na semana") para todo mundo, enquanto o app tem a frequência real no histórico.
 *
 * O QUE ESTE ARQUIVO DECIDE, E QUEM DECIDIU
 *
 * Os números abaixo são PRESCRIÇÃO, e foram escolhidos pelo profissional (CREF) em
 * 01/11/2026: fórmula Mifflin-St Jeor, déficit de 20% para emagrecer, superávit de 10% para
 * ganhar massa, proteína 1,8 g/kg e gordura em 25% das calorias.
 *
 * Estão todos como constante nomeada, num lugar só, para serem revistos sem caçar número
 * solto no meio de uma conta.
 *
 * O QUE ELE NUNCA FAZ: CHUTAR
 *
 * Sem sexo, sem idade, sem peso, sem altura ou sem objetivo reconhecido, a conta NÃO sai —
 * devolve o que falta, e a tela pede ao aluno que complete. É a mesma regra de
 * `lib/metodosDeTreino.ts`: responder com um padrão plausível descreveria ao aluno um plano
 * que ninguém prescreveu. Vale em dobro aqui, porque `app/context/AppContext.tsx` já traz
 * `gender: profileData.gender || 'M'` — quem nunca preencheu vira homem em silêncio, e esta
 * conta não pode herdar esse chute.
 */

/* -------------------------------------------------------------------------- */
/* As constantes de prescrição                                                */
/* -------------------------------------------------------------------------- */

/**
 * Multiplicador do gasto, pela frequência real de treino na semana.
 *
 * São os fatores clássicos que acompanham Harris-Benedict e seguem em uso com Mifflin. NÃO
 * foram escolhidos item a item pelo profissional: são o conjunto padrão, e estão aqui para
 * serem corrigidos se ele quiser outros.
 *
 * A faixa vem do HISTÓRICO, não de uma pergunta ao aluno: o app sabe quantas vezes a pessoa
 * treinou, e perguntar convida a superestimar.
 */
export const FATOR_DE_ATIVIDADE = {
  /** Nenhum treino registrado nas últimas quatro semanas. */
  sedentario: 1.2,
  /** 1 a 2 treinos por semana. */
  leve: 1.375,
  /** 3 a 5 treinos por semana. */
  moderado: 1.55,
  /** 6 ou mais treinos por semana. */
  intenso: 1.725,
} as const;

/**
 * Ajuste sobre o gasto total, por objetivo.
 *
 * As chaves são EXATAMENTE os três valores que o onboarding grava
 * (`app/onboarding/page.tsx:241`). Objetivo fora desta lista não recebe ajuste padrão: a conta
 * para, porque "manter" para quem pediu emagrecer é a falha mais cara possível aqui.
 */
export const AJUSTE_POR_OBJETIVO: Record<string, number> = {
  'Emagrecimento': -0.20,
  'Hipertrofia': +0.10,
  'Condicionamento Físico': 0,
};

/** Proteína por quilo de peso corporal. */
export const PROTEINA_G_POR_KG = 1.8;

/** Gordura, como fração das calorias do dia. O carboidrato fica com o que sobra. */
export const GORDURA_FRACAO_DAS_CALORIAS = 0.25;

/** Calorias por grama de cada macronutriente (fatores de Atwater). */
export const KCAL_POR_GRAMA = { proteina: 4, carboidrato: 4, gordura: 9 } as const;

const UM_DIA_MS = 86_400_000;

/** Janela do histórico usada para estimar a frequência semanal. */
const SEMANAS_OLHADAS = 4;

/* -------------------------------------------------------------------------- */
/* Taxa Metabólica Basal                                                      */
/* -------------------------------------------------------------------------- */

export type Sexo = 'M' | 'F';

/**
 * Mifflin-St Jeor (1990), a fórmula recomendada pela Academy of Nutrition and Dietetics para
 * população geral.
 *
 *   TMB = 10·peso(kg) + 6,25·altura(cm) − 5·idade + S,  com S = +5 (homem) ou −161 (mulher)
 *
 * A constante S é a razão pela qual o sexo não pode faltar: ela sozinha move 166 kcal por dia.
 */
export function tmbMifflin(
  peso: number,
  altura: number,
  idade: number,
  sexo: Sexo,
): number {
  const s = sexo === 'M' ? 5 : -161;
  return 10 * peso + 6.25 * altura - 5 * idade + s;
}

/* -------------------------------------------------------------------------- */
/* Frequência real de treino                                                  */
/* -------------------------------------------------------------------------- */

type TreinoFeito = { date: number };

/**
 * Média de treinos por semana nas últimas quatro semanas.
 *
 * Conta DIAS com treino, não treinos: quem faz manhã e noite no mesmo dia treinou um dia. É a
 * mesma regra de `lib/sequenciaDeTreinos.ts`, e por um motivo prático — o fator de atividade
 * descreve quantos dias o corpo gastou a mais, não quantas sessões foram abertas no app.
 *
 * Quatro semanas, e não a semana corrente: uma semana cheia de viagem jogaria o aluno de
 * "moderado" para "sedentário" e cortaria ~450 kcal do plano dele de um dia para o outro.
 */
export function treinosPorSemana(history: TreinoFeito[], agora: number): number {
  const inicio = agora - SEMANAS_OLHADAS * 7 * UM_DIA_MS;

  const dias = new Set(
    history
      .filter(h => h.date >= inicio && h.date <= agora)
      .map(h => new Date(h.date).setHours(0, 0, 0, 0)),
  );

  return dias.size / SEMANAS_OLHADAS;
}

/** O fator correspondente à frequência. As faixas são fechadas embaixo. */
export function fatorDeAtividade(porSemana: number): number {
  if (porSemana < 1) return FATOR_DE_ATIVIDADE.sedentario;
  if (porSemana < 3) return FATOR_DE_ATIVIDADE.leve;
  if (porSemana < 6) return FATOR_DE_ATIVIDADE.moderado;
  return FATOR_DE_ATIVIDADE.intenso;
}

/** O nome da faixa, para a tela poder explicar de onde veio o número. */
export function nomeDaFaixa(porSemana: number): 'sedentario' | 'leve' | 'moderado' | 'intenso' {
  if (porSemana < 1) return 'sedentario';
  if (porSemana < 3) return 'leve';
  if (porSemana < 6) return 'moderado';
  return 'intenso';
}

/* -------------------------------------------------------------------------- */
/* O plano                                                                    */
/* -------------------------------------------------------------------------- */

export type DadosDoAluno = {
  peso?: number | null;
  altura?: number | null;
  idade?: number | null;
  sexo?: string | null;
  objetivo?: string | null;
};

export type PlanoNutricional = {
  tmb: number;
  get: number;
  caloriasAlvo: number;
  macros: { proteina: number; carboidrato: number; gordura: number };
  /** Como o número foi montado — a tela mostra isso, para o plano não ser uma caixa preta. */
  base: {
    formula: 'Mifflin-St Jeor';
    treinosPorSemana: number;
    faixaDeAtividade: ReturnType<typeof nomeDaFaixa>;
    fator: number;
    ajuste: number;
    /**
     * O peso que ENTROU nesta conta.
     *
     * A tela guarda o plano no navegador, então um plano de semanas atrás continua
     * aparecendo com cara de atual. Com o peso usado gravado junto, ela consegue comparar
     * com o peso de hoje e avisar que o cálculo envelheceu — em vez de o aluno confiar em
     * macros feitos para um corpo que ele não tem mais.
     */
    peso: number;
    objetivo: string;
  };
};

/** O que impede a conta de sair. Cada item vira uma linha do aviso na tela. */
export type Faltando =
  | 'peso'
  | 'altura'
  | 'idade'
  | 'sexo'
  | 'objetivo';

export type Resultado =
  | { ok: true; plano: PlanoNutricional }
  | { ok: false; faltando: Faltando[] };

/** Número positivo e plausível. Zero e texto vazio não são "informado". */
const valido = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

/**
 * Monta o plano, ou diz o que falta para montá-lo.
 *
 * Nenhum valor é estimado na ausência de dado. Ver o cabeçalho do arquivo.
 */
export function planoNutricional(
  aluno: DadosDoAluno,
  history: TreinoFeito[],
  agora: number,
): Resultado {
  const faltando: Faltando[] = [];

  if (!valido(aluno.peso)) faltando.push('peso');
  if (!valido(aluno.altura)) faltando.push('altura');
  if (!valido(aluno.idade)) faltando.push('idade');

  const sexo = aluno.sexo === 'M' || aluno.sexo === 'F' ? aluno.sexo : null;
  if (!sexo) faltando.push('sexo');

  const objetivo = aluno.objetivo ?? '';
  const temAjuste = Object.prototype.hasOwnProperty.call(AJUSTE_POR_OBJETIVO, objetivo);
  if (!temAjuste) faltando.push('objetivo');

  if (faltando.length > 0) return { ok: false, faltando };

  const peso = aluno.peso as number;
  const altura = aluno.altura as number;
  const idade = aluno.idade as number;

  const tmb = tmbMifflin(peso, altura, idade, sexo as Sexo);

  const porSemana = treinosPorSemana(history, agora);
  const fator = fatorDeAtividade(porSemana);
  const get = tmb * fator;

  const ajuste = AJUSTE_POR_OBJETIVO[objetivo];
  const caloriasAlvo = get * (1 + ajuste);

  // Proteína pelo peso, gordura por fração das calorias, carboidrato com o que sobra.
  const proteina = PROTEINA_G_POR_KG * peso;
  const gordura = (caloriasAlvo * GORDURA_FRACAO_DAS_CALORIAS) / KCAL_POR_GRAMA.gordura;

  const kcalRestante =
    caloriasAlvo - proteina * KCAL_POR_GRAMA.proteina - gordura * KCAL_POR_GRAMA.gordura;

  /* O piso em zero não deve acontecer com os valores atuais — o pior caso realista (peso alto
     em déficit) ainda deixa ~600 kcal de carboidrato. Fica porque uma constante futura mais
     agressiva produziria carboidrato negativo, e grama negativa na tela do aluno é pior que
     um zero honesto. */
  const carboidrato = Math.max(0, kcalRestante / KCAL_POR_GRAMA.carboidrato);

  return {
    ok: true,
    plano: {
      tmb: Math.round(tmb),
      get: Math.round(get),
      caloriasAlvo: Math.round(caloriasAlvo),
      macros: {
        proteina: Math.round(proteina),
        carboidrato: Math.round(carboidrato),
        gordura: Math.round(gordura),
      },
      base: {
        formula: 'Mifflin-St Jeor',
        // Uma casa decimal: "2,8 treinos por semana" informa; "2,75" finge precisão que a
        // janela de quatro semanas não tem.
        treinosPorSemana: Math.round(porSemana * 10) / 10,
        faixaDeAtividade: nomeDaFaixa(porSemana),
        fator,
        ajuste,
        peso,
        objetivo,
      },
    },
  };
}

/** O texto que a tela mostra para cada dado que falta. */
export const COMO_PREENCHER: Record<Faltando, string> = {
  peso: 'seu peso, no Perfil',
  altura: 'sua altura, no Perfil',
  idade: 'sua idade, no Perfil',
  sexo: 'seu sexo biológico, no Perfil — ele muda a conta em 166 kcal por dia',
  objetivo: 'seu objetivo de treino, no Perfil',
};
