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

const { generateWithRetry, MODELOS_RESERVA } = await import('@/lib/geminiClient');

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

  it('desiste depois de tentar TODOS os modelos, em vez de devolver lixo', async () => {
    // Antes da cadeia de modelos (28/09/2026), isto tentava 2x no mesmo modelo e desistia.
    // Agora tenta uma vez em cada modelo da cadeia: se um insiste em devolver JSON torto,
    // outro pode nao insistir. O importante nao mudou -- nunca devolve lixo ao chamador.
    generateContent.mockResolvedValue(resposta('{quebrado'));

    await expect(
      generateWithRetry('chave', { prompt: 'x', json: true, maxOutputTokens: 100 }, 1)
    ).rejects.toThrow(/JSON invalido/);

    expect(generateContent).toHaveBeenCalledTimes(1 + MODELOS_RESERVA.length);
  });

  it('com modelo FIXADO, volta a repetir no mesmo, porque nao ha proximo', async () => {
    // Quem passa `model` explicito perde a cadeia de proposito (pode ser teste, ou rota com
    // necessidade propria). Ali a espera curta e a unica chance de uma amostra nova.
    generateContent.mockResolvedValue(resposta('{quebrado'));

    await expect(
      generateWithRetry('chave', { prompt: 'x', json: true, maxOutputTokens: 100, model: 'so-esse' }, 1)
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

/**
 * Travamento de producao (09/10/2026): uma geracao de Treino do Personal ficou mais de 5
 * minutos esperando, numa rota cujo teto na Vercel e 60 segundos.
 *
 * A causa: o orcamento de 40s so era consultado ENTRE tentativas, e a chamada ao Google ia
 * sem limite nenhum. Com a conexao pendurada, o codigo ficava parado dentro do `await` e a
 * verificacao nunca rodava. O relogio estava do lado de fora da sala onde o processo travou.
 *
 * Estes testes fixam as duas metades do conserto: existe teto por tentativa, e estourar esse
 * teto conta como "modelo fora" — cai para o proximo da cadeia em vez de matar tudo.
 */
describe('generateWithRetry — tentativa que nao responde', () => {
  const abortError = () => Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });

  it('manda abortSignal e timeout em cada chamada', async () => {
    generateContent.mockResolvedValueOnce(resposta('{"ok":true}'));

    await generateWithRetry('chave', { prompt: 'x', json: true, maxOutputTokens: 100 });

    const config = generateContent.mock.calls[0][0].config;
    expect(config.abortSignal).toBeInstanceOf(AbortSignal);
    expect(config.httpOptions.timeout).toBeGreaterThan(0);
    expect(config.httpOptions.timeout).toBeLessThanOrEqual(25_000);
  });

  it('timeout cai para o proximo modelo em vez de estourar', async () => {
    // O primeiro modelo pendura; o segundo responde. Antes do conserto o AbortError subia
    // direto e a cadeia de reserva nao chegava a ser usada.
    generateContent
      .mockRejectedValueOnce(abortError())
      .mockResolvedValueOnce(resposta('{"ok":true}'));

    const r = await generateWithRetry('chave', { prompt: 'x', json: true, maxOutputTokens: 100 });

    expect(r.text).toBe('{"ok":true}');
    expect(generateContent.mock.calls[1][0].model).toBe(MODELOS_RESERVA[0]);
  });

  it('nao insiste no mesmo modelo que pendurou', async () => {
    generateContent.mockRejectedValue(abortError());

    await expect(
      generateWithRetry('chave', { prompt: 'x', json: true, maxOutputTokens: 100 })
    ).rejects.toThrow();

    // Uma tentativa por modelo, nunca duas no mesmo: quem pendurou nao responde mais rapido
    // na segunda vez, e cada repeticao gasta o orcamento de quem ainda poderia responder.
    const modelosChamados = generateContent.mock.calls.map(c => c[0].model);
    expect(new Set(modelosChamados).size).toBe(modelosChamados.length);
  });
});
