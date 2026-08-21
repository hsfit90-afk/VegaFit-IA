import type Groq from 'groq-sdk';

// Reexecuta a chamada ao Groq quando o erro é de limite de uso (429/413), com espera curta e
// crescente entre tentativas. Cobre picos passageiros de uso concorrente (ex: 2 alunos gerando
// treino no mesmo minuto) — NÃO resolve um limite diário/por-minuto genuinamente esgotado da
// conta; pra isso só o upgrade de tier no Groq resolve (ver console.groq.com/settings/billing).
export async function createGroqCompletionWithRetry(
  groq: Groq,
  params: any,
  maxRetries = 2
): Promise<any> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await groq.chat.completions.create(params);
    } catch (err: any) {
      lastError = err;
      const isRateLimit = err?.status === 429 || err?.status === 413;
      if (!isRateLimit || attempt === maxRetries) throw err;
      const delayMs = 1500 * Math.pow(2, attempt); // 1.5s, depois 3s
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
