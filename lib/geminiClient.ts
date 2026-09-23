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

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: req.model || MODELO_PADRAO,
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

      return {
        text,
        totalTokens: response.usageMetadata?.totalTokenCount,
        truncated: finishReason === 'MAX_TOKENS',
      };
    } catch (err: any) {
      lastError = err;

      const status = err?.status ?? err?.code;
      const msg = String(err?.message || '');
      const transitorio =
        err instanceof RespostaJsonInvalida ||
        status === 429 ||
        status === 503 ||
        status === 500 ||
        /429|503|500|high demand|overloaded|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(msg);

      if (!transitorio || attempt === maxRetries) throw err;

      const delayMs = 1500 * Math.pow(2, attempt); // 1.5s, depois 3s
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
