import { GoogleGenAI } from '@google/genai';

/**
 * Cliente de IA do app. Substituiu o Groq em 22/09/2026.
 *
 * O motivo da troca foi medido, não estimado. Rodando o MESMO prompt da rota de treino com o
 * MESMO teto de 4096 tokens de saída:
 *
 *   Groq (openai/gpt-oss-120b):  entrada 2856 | saída 4096 (TETO batido) | Treino C com 5 de 7
 *   Gemini 3.5 Flash-Lite:       entrada 2886 | saída 3932 (terminou só) | 7, 7, 7 exercícios
 *
 * O gpt-oss-120b gastava ~692 tokens de "reasoning" dentro do mesmo orçamento de saída, e por
 * isso truncava o JSON antes de fechar o plano — a causa real dos treinos incompletos que
 * apareciam como bug do gerador.
 *
 * Além disso o teto de saída do Gemini é 65.536 (contra 4.096 usados aqui), e o free tier tem
 * ordem de grandeza mais tokens por minuto que os 8.000 do Groq, que era o que produzia o
 * "Muita gente usando a IA ao mesmo tempo agora".
 */

/** Rápido e suficiente para todas as rotas — ver medição acima. */
export const MODELO_PADRAO = 'gemini-3.5-flash-lite';

/**
 * Modelos de reserva, tentados em ordem quando o padrão está indisponível.
 *
 * ISTO NÃO É PRECAUÇÃO TEÓRICA. Em 28/09/2026 o app parou: o aluno via "Não conseguimos gerar
 * o treino agora" e, em alguns casos, a função da Vercel estourava 60s e devolvia 504. A causa
 * era o Flash-Lite respondendo 503 "high demand" — e o retry de então insistia NO MESMO MODELO,
 * que continuava fora por horas. Foi a segunda vez; a primeira, em 23/09, ficou registrada e
 * adiada.
 *
 * Varrendo a lista de modelos da conta naquele momento: 3.5-flash-lite, 3.1-flash-lite,
 * 3.5-flash, 3.7-flash, 3.8-flash, flash-latest e flash-lite-latest TODOS em 503; pro-latest em
 * 429. Só o 3.6-flash respondeu, em 5,6s. Por isso ele encabeça a reserva: não por ser melhor,
 * por estar de pé.
 *
 * A ordem privilegia custo — flash-lite é a faixa mais barata — e só sobe para flash completo
 * quando não há alternativa. Um treino mais caro é muito melhor que um aluno sem treino.
 */
export const MODELOS_RESERVA = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

/**
 * A lista é longa de propósito, e não custa nada quando o primeiro responde.
 *
 * Numa segunda medição, minutos depois da primeira, o 3.6-flash que tinha respondido 200
 * passou a recusar — e o tamanho do pedido não era a variável: a mesma chamada de uma linha
 * levou 503. A indisponibilidade oscila minuto a minuto na conta inteira, então quanto mais
 * portas houver, maior a chance de uma estar aberta na hora da tentativa.
 *
 * O orçamento de tempo é que limita: quando as recusas são rápidas dá para tentar todos;
 * quando demoram, o relógio corta antes. Nenhum dos dois casos deixa o aluno esperando além
 * do limite da função.
 */

/**
 * Teto de tempo para a cadeia inteira de tentativas.
 *
 * As rotas rodam com maxDuration de 60s na Vercel. Uma recusa por 503 levou de 0,6s a 24s nos
 * testes, então três modelos indisponíveis podem consumir tudo e o aluno recebe 504 — pior que
 * um erro honesto, porque não deixa rastro útil no log da aplicação. Parando em 40s sobra
 * margem para a rota responder direito.
 */
export const ORCAMENTO_MS = 40_000;

export interface GeminiTurn {
  role: 'user' | 'model';
  text: string;
}

export interface GeminiRequest {
  /** Mensagem do usuário nesta rodada. */
  prompt: string;
  /** Instrução de sistema (persona, regras). Vai fora do histórico. */
  system?: string;
  /** Rodadas anteriores, para rotas conversacionais (coach-chat). */
  history?: GeminiTurn[];
  /** true força resposta JSON válida (responseMimeType). */
  json?: boolean;
  maxOutputTokens: number;
  model?: string;
}

export interface GeminiResult {
  text: string;
  /** Consumo real, usado para reconciliar a reserva em utils/rate-limit.ts. */
  totalTokens?: number;
  /** true quando a resposta bateu no teto — o JSON pode estar cortado. */
  truncated: boolean;
}

/** Erro de JSON invalido, separado para o laco de retry reconhece-lo. */
class RespostaJsonInvalida extends Error {
  constructor(causa: string) {
    super(`A IA devolveu JSON invalido: ${causa}`);
    this.name = 'RespostaJsonInvalida';
  }
}

function client(apiKey: string) {
  return new GoogleGenAI({ apiKey });
}

/**
 * Chama o Gemini repetindo em erros PASSAGEIROS, com espera curta e crescente.
 *
 * Herda a política do antigo lib/groqRetry.ts, adaptada ao que o Gemini realmente devolve:
 *
 *   - 429 (limite de uso) e 503 ("high demand") são transitórios. O 503 não é hipotético:
 *     o gemini-3.8-flash devolveu isso nas duas vezes que testamos, o que é justamente por
 *     que o modelo padrão aqui é o Flash-Lite.
 *   - 500 e outros 5xx entram no mesmo balde.
 *
 * Um 400 (prompt inválido) NÃO é repetido — repetir só gastaria cota para falhar igual.
 *
 * O retry de JSON malformado CONTINUA valendo. Na migração eu assumi que
 * `responseMimeType: 'application/json'` garantia JSON sintaticamente válido e removi essa
 * proteção — errado. Sem um `responseSchema` declarado, o responseMimeType é esforço-melhor,
 * não garantia: em produção, a segunda geração de treino voltou com
 * `"youtubeSearchTerm": inverso cr...` — um valor de texto sem aspas — e o JSON.parse da rota
 * estourou com 500 na cara do aluno. Funcionara nas 4 tentativas locais antes disso.
 *
 * Agora o parse acontece AQUI, e uma resposta impossível de parsear conta como falha
 * transitória: a mesma chamada repetida quase sempre volta bem, que era exatamente a
 * observação registrada no antigo lib/groqRetry.ts.
 */
export async function generateWithRetry(
  apiKey: string,
  req: GeminiRequest,
  maxRetries = 2
): Promise<GeminiResult> {
  const ai = client(apiKey);

  const contents = [
    ...(req.history || []).map(turn => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    { role: 'user' as const, parts: [{ text: req.prompt }] },
  ];

  const config: Record<string, unknown> = { maxOutputTokens: req.maxOutputTokens };
  if (req.system) config.systemInstruction = req.system;
  if (req.json) config.responseMimeType = 'application/json';

  let lastError: any;
  const comecou = Date.now();

  // Se quem chama pediu um modelo específico, respeita e não inventa reserva: pode ser um
  // teste ou uma rota com necessidade própria. Sem pedido, usa a cadeia padrão.
  const modelos = req.model ? [req.model] : [MODELO_PADRAO, ...MODELOS_RESERVA];

  for (const modelo of modelos) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Antes de cada tentativa, confere se ainda há tempo. Estourar o limite da Vercel
      // devolve 504 ao aluno e nada ao log — pior que falhar com mensagem.
      if (Date.now() - comecou > ORCAMENTO_MS) {
        console.error(`[gemini] orçamento de ${ORCAMENTO_MS}ms esgotado; desistindo.`);
        throw lastError ?? new Error('Tempo esgotado tentando gerar');
      }

      try {
      const response = await ai.models.generateContent({
        model: modelo,
        contents,
        config,
      });

      const finishReason = response.candidates?.[0]?.finishReason;
      const text = response.text ?? '';

      if (!text) throw new Error('Resposta vazia da IA');

      // Valida o JSON aqui, antes de devolver, para um JSON quebrado virar retry em vez de
      // 500 na rota. Truncamento por teto de tokens NAO e transitorio — repetir daria o
      // mesmo resultado —, entao esse caso passa direto e quem chama decide o que fazer.
      if (req.json && finishReason !== 'MAX_TOKENS') {
        try {
          JSON.parse(text);
        } catch (parseErr: any) {
          throw new RespostaJsonInvalida(String(parseErr?.message || parseErr).slice(0, 120));
        }
      }

      if (modelo !== MODELO_PADRAO) {
        console.warn(`[gemini] respondido pelo modelo de reserva "${modelo}".`);
      }

      return {
        text,
        totalTokens: response.usageMetadata?.totalTokenCount,
        truncated: finishReason === 'MAX_TOKENS',
      };
    } catch (err: any) {
      lastError = err;

      const status = err?.status ?? err?.code;
      const msg = String(err?.message || '');

      // Dois tipos de falha bem diferentes, que antes eram tratados igual:
      //
      //   MODELO FORA (503, 429, 500) — insistir não adianta, o modelo pode ficar horas
      //   assim. Vale trocar de modelo IMEDIATAMENTE, sem espera.
      //
      //   RESPOSTA RUIM (JSON quebrado) — é da chamada, não do modelo. A mesma chamada
      //   repetida quase sempre volta bem, então aqui a espera curta continua valendo.
      const modeloFora =
        status === 429 || status === 503 || status === 500 ||
        /429|503|500|high demand|overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(msg);

      if (modeloFora) {
        console.warn(`[gemini] modelo "${modelo}" indisponível (${status || 'erro'}); tentando o próximo.`);
        break; // sai do laço de tentativas e vai para o próximo modelo
      }

      // Erro que não é transitório (prompt inválido, resposta vazia) sobe na hora: trocar de
      // modelo não conserta um pedido malformado, só gasta cota para falhar igual.
      if (!(err instanceof RespostaJsonInvalida)) throw err;

      // JSON quebrado até o fim das tentativas: em vez de desistir, tenta o próximo modelo.
      // Se este insiste em devolver JSON torto, outro pode não insistir.
      if (attempt === maxRetries) {
        console.warn(`[gemini] "${modelo}" devolveu JSON inválido ${maxRetries + 1}x; tentando o próximo.`);
        break;
      }

      const delayMs = 1500 * Math.pow(2, attempt); // 1.5s, depois 3s
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    }
  }

  console.error(`[gemini] nenhum modelo respondeu: ${modelos.join(', ')}`);
  throw lastError;
}
