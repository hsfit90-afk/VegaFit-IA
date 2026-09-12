import type Groq from 'groq-sdk';

// Reexecuta a chamada ao Groq em erros PASSAGEIROS, com espera curta e crescente entre tentativas.
//
// Dois tipos são cobertos:
//
// 1. Limite de uso (429/413) — picos de uso concorrente, ex: 2 alunos gerando treino no mesmo
//    minuto. NÃO resolve um limite diário/por-minuto genuinamente esgotado da conta; pra isso só
//    o upgrade de tier no Groq resolve (ver console.groq.com/settings/billing).
//
// 2. JSON malformado (400 json_validate_failed) — o modelo às vezes fecha uma chave a mais e o
//    Groq rejeita a resposta inteira. É aleatório: medido no método CIRCUITO do gerador de treino,
//    falhava em 3 de 4 gerações, e a mesma chamada repetida funcionava. Sem retry aqui, o aluno
//    escolhia "Circuito", clicava em gerar e recebia erro na cara na maioria das vezes. Com 2
//    retries a chance de falhar as três cai de ~75% para ~4%.
//    Vale reavaliar se um dia o prompt mudar: o ideal seria o modelo não errar o JSON.
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
      // O código vem aninhado no corpo do erro do SDK; o teste no texto é rede de segurança
      // caso o formato mude, já que o 400 genérico (prompt inválido) NÃO deve ser repetido.
      const isBadJson =
        err?.status === 400 &&
        (err?.error?.error?.code === 'json_validate_failed' ||
          /json_validate_failed/.test(err?.message || ''));

      if ((!isRateLimit && !isBadJson) || attempt === maxRetries) throw err;
      const delayMs = 1500 * Math.pow(2, attempt); // 1.5s, depois 3s
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
