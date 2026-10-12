// A anamnese curta: as perguntas sem as quais o treino sai errado.
//
// POR QUE ISTO EXISTE
//
// Medido em 11/10/2026: de 13 pessoas cadastradas, UMA preencheu a anamnese. As outras doze
// geraram treino com o app adivinhando tudo — local, equipamento, objetivo, nível, lesão.
// Todo o filtro de equipamento e toda a regra de segurança rodavam com o tanque vazio.
//
// Não é falta de motivação, é tamanho de formulário: a anamnese completa tem nove passos e
// quase cinquenta campos, incluindo nutrição, ciclo hormonal e medidas corporais, tudo ANTES
// de a pessoa ver o primeiro treino.
//
// A separação aqui é por CONSEQUÊNCIA, não por importância. Peso e altura importam para o
// gasto calórico; ciclo menstrual importa para periodizar. Mas nenhum dos dois muda QUAIS
// exercícios entram na sessão. Estes cinco mudam:
//
//   local              decide o catálogo inteiro (academia x casa)
//   equipamentos_casa  decide o que sobra do catálogo de casa
//   objetivo           decide séries, repetições e descanso
//   nivel              decide a exigência técnica dos exercícios
//   lesoes             decide o que NÃO pode entrar, por segurança
//
// O resto continua existindo e é pedido depois, quando a pessoa já tem motivo para voltar.

import type { AnamneseStep } from './anamneseSteps';

/** Na ordem em que aparecem na anamnese curta. */
export const CAMPOS_ESSENCIAIS = ['objetivo', 'nivel', 'lesoes', 'local', 'equipamentos_casa'] as const;

/**
 * `equipamentos_casa` fica de fora da checagem de propósito.
 *
 * Ele só aparece para quem treina em casa, e lista vazia é resposta legítima — significa "só
 * peso do corpo", que o filtro trata como 424 exercícios. Exigir marcação transformaria um
 * padrão correto em bloqueio.
 */
const OBRIGATORIOS = ['objetivo', 'nivel', 'local'] as const;

function vazio(valor: unknown): boolean {
  if (valor === undefined || valor === null) return true;
  if (Array.isArray(valor)) return valor.length === 0;
  return String(valor).trim() === '';
}

/** Quais campos essenciais ainda faltam. Lista vazia = pode gerar treino. */
export function faltamEssenciais(respostas: Record<string, any> | null | undefined): string[] {
  const r = respostas ?? {};
  return OBRIGATORIOS.filter(campo => vazio(r[campo]));
}

/** true quando dá para gerar um treino que respeita o aluno. */
export function temOEssencial(respostas: Record<string, any> | null | undefined): boolean {
  return faltamEssenciais(respostas).length === 0;
}

/**
 * Os passos da anamnese reduzidos aos campos essenciais.
 *
 * Reaproveita a MESMA definição da anamnese completa em vez de manter uma lista paralela:
 * duas listas com as mesmas perguntas divergem no primeiro campo que alguém muda num lugar
 * só, e aqui a divergência apareceria como pergunta que some ou resposta que não salva.
 *
 * Passo que fica sem nenhum campo essencial é descartado inteiro.
 */
export function passosEssenciais(passos: AnamneseStep[]): AnamneseStep[] {
  return passos
    .map(passo => ({
      ...passo,
      fields: passo.fields.filter(f => (CAMPOS_ESSENCIAIS as readonly string[]).includes(f.id)),
    }))
    .filter(passo => passo.fields.length > 0);
}

/** Rótulo legível, para a tela dizer o que falta sem mostrar nome de campo. */
export const ROTULO_ESSENCIAL: Record<string, string> = {
  objetivo: 'Objetivo',
  nivel: 'Nível de treino',
  local: 'Onde você treina',
  lesoes: 'Lesões',
  equipamentos_casa: 'O que você tem em casa',
};
