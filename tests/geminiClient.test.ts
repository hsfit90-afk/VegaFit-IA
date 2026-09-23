import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regressao de producao (23/09/2026): a 2a geracao de treino voltou com
 * `"youtubeSearchTerm": inverso cr...` — um valor de texto sem aspas — e o JSON.parse da rota
 * estourou 500 na cara do aluno.
 *
 * A causa foi uma suposicao errada na migracao para o Gemini: que `responseMimeType:
 * 'application/json'` garantia JSON sintaticamente valido, e que por isso o retry de JSON
 * malformado herdado do Groq podia sair. Sem um `responseSchema` declarado, o responseMimeType
 * e esforco-melhor, nao garantia.
 *
 * Estes testes fixam o contrato: JSON quebrado é falha TRANSITORIA (repete), truncamento NAO
 * (repetir daria o mesmo resultado).
 */

const generateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const { generateWithRetry } = await import('@/lib/geminiClient');

/** Resposta do SDK: `text` é getter na classe real, mas objeto simples serve aqui. */
const resposta = (text: string, finishReason = 'STOP', totalTokens = 100) => ({
  text,
  candidates: [{ finishReason }],
  usageMetadata: { totalTokenCount: totalTokens },
});

beforeEach(() => {
  generateContent.mockReset();
});

describe('generateWithRetry — JSON invalido', () => {
  it('repete quando o JSON nao parseia e devolve a tentativa boa', async () => {
    generateContent
      .mockResolvedValueOnce(resposta('{"youtubeSearchTerm": inverso cr'))
      .mockResolvedValueOnce(resposta('{"ok":true}', 'STOP', 250));

    const r = await generateWithRetry('chave', { prompt: 'x', json: true, maxOutputTokens: 100 });

    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(r.text).toBe('{"ok":true}');
    expect(r.totalTokens).toBe(250);
  });

  it('desiste depois de esgotar as tentativas, em vez de devolver lixo', async () => {
    generateContent.mockResolvedValue(resposta('{quebrado'));

    await expect(
      generateWithRetry('chave', { prompt: 'x', json: true, maxOutputTokens: 100 }, 1)
    ).rejects.toThrow(/JSON invalido/);

    expect(generateContent).toHaveBeenCalledTimes(2); // tentativa inicial + 1 retry
  });

  it('nao valida JSON quando a rota nao pediu JSON', async () => {
    // daily-tip e coach-chat devolvem texto corrido; exigir JSON ali quebraria as duas.
    generateContent.mockResolvedValueOnce(resposta('Beba agua e durma bem.'));

    const r = await generateWithRetry('chave', { prompt: 'x', maxOutputTokens: 100 });

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(r.text).toBe('Beba agua e durma bem.');
  });

  it('nao repete quando o JSON quebrou por truncamento', async () => {
    // Repetir daria o mesmo corte no mesmo lugar. Sinaliza truncated e deixa quem chama decidir.
    generateContent.mockResolvedValue(resposta('{"sessions":[{"nam', 'MAX_TOKENS'));

    const r = await generateWithRetry('chave', { prompt: 'x', json: true, maxOutputTokens: 10 });

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(r.truncated).toBe(true);
  });
});

describe('generateWithRetry — falhas do provedor', () => {
  it('repete no 503 de alta demanda', async () => {
    // Observado de verdade: o gemini-3.8-flash devolveu 503 nas duas vezes que testamos.
    generateContent
      .mockRejectedValueOnce(Object.assign(new Error('high demand'), { status: 503 }))
      .mockResolvedValueOnce(resposta('{"ok":true}'));

    const r = await generateWithRetry('chave', { prompt: 'x', json: true, maxOutputTokens: 100 });

    expect(generateContent).toHaveBeenCalledTimes(2);
    expect(r.text).toBe('{"ok":true}');
  });

  it('NAO repete em 400 — prompt invalido nao melhora repetindo, so gasta cota', async () => {
    generateContent.mockRejectedValue(Object.assign(new Error('bad request'), { status: 400 }));

    await expect(
      generateWithRetry('chave', { prompt: 'x', json: true, maxOutputTokens: 100 })
    ).rejects.toThrow(/bad request/);

    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
