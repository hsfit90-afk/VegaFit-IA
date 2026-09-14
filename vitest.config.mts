import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Testes das funções puras de regra de negócio — as que decidem o treino do aluno.
 * Não há ambiente de DOM aqui de propósito: nenhum dos módulos testados toca em React ou
 * browser, e `node` roda bem mais rápido que `jsdom`.
 */
export default defineConfig({
  resolve: {
    // Mesmo alias do tsconfig, pra os imports '@/lib/...' funcionarem nos testes.
    alias: { '@': path.resolve(import.meta.dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Sem isto, o v8 lista apenas os arquivos onde sobrou linha descoberta — módulos com
      // cobertura total somem do relatório e parecem não testados.
      all: true,
      // Cobertura medida só sobre o que está sob teste; incluir o app inteiro daria um número
      // baixo e sem significado, já que telas e rotas não são cobertas aqui.
      include: ['lib/**/*.ts', 'utils/**/*.ts'],
      // Fora do escopo destes testes: acesso a banco, contexto de IA e listas de dados.
      exclude: ['lib/db/**', 'lib/types.ts', 'lib/utils.ts', 'lib/anamneseSteps.ts',
                'lib/aiHealthContext.ts', 'lib/groqRetry.ts', 'lib/trainingLocation.ts',
                'utils/supabase/**', 'utils/push.ts', 'utils/rate-limit.ts',
                'utils/workoutCache.ts'],
    },
  },
});
