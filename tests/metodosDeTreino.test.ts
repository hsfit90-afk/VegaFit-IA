import { describe, it, expect } from 'vitest';
import { METODOS_DE_TREINO, nomeDoMetodo } from '@/lib/metodosDeTreino';
import { TODOS_METODOS } from '@/lib/trainingUnlock';

/**
 * A lista saiu de dentro de app/generator/page.tsx em 29/10/2026, para o painel poder usar o
 * mesmo nome. O que estes testes protegem é justamente isso: que ela continue cobrindo os
 * mesmos métodos que o desbloqueio conhece, e que o nome não vire a chave por acidente.
 */

describe('nomeDoMetodo', () => {
  it('devolve o nome que o aluno le', () => {
    expect(nomeDoMetodo('superset')).toBe('Superset');
    expect(nomeDoMetodo('rest_pause')).toBe('Rest-Pause');
    expect(nomeDoMetodo('piramide')).toBe('Pirâmide');
  });

  it('NAO CHUTA quando o plano nao tem metodo', () => {
    // Plano gerado antes do seletor existir grava null. Responder "Tradicional" descreveria
    // ao aluno um treino que ele nao recebeu.
    expect(nomeDoMetodo(null)).toBeNull();
    expect(nomeDoMetodo(undefined)).toBeNull();
    expect(nomeDoMetodo('')).toBeNull();
  });

  it('devolve null para chave que nao existe', () => {
    expect(nomeDoMetodo('bi_set')).toBeNull();
    expect(nomeDoMetodo('Superset')).toBeNull(); // a chave e minuscula; o nome nunca e chave
  });
});

describe('METODOS_DE_TREINO', () => {
  it('tem os seis metodos', () => {
    expect(METODOS_DE_TREINO).toHaveLength(6);
  });

  it('nenhum id se repete', () => {
    const ids = METODOS_DE_TREINO.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('nenhum nome se repete, senao o aluno ve dois iguais', () => {
    const labels = METODOS_DE_TREINO.map(m => m.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('todo metodo tem nome e descricao preenchidos', () => {
    for (const m of METODOS_DE_TREINO) {
      expect(m.label.trim()).not.toBe('');
      expect(m.desc.trim()).not.toBe('');
    }
  });

  it('COBRE TODO METODO QUE O DESBLOQUEIO LIBERA', () => {
    // Se alguem acrescentar um metodo em trainingUnlock e esquecer o nome aqui, o aluno
    // desbloquearia um metodo que a tela nao sabe nomear.
    const liberados = new Set(TODOS_METODOS);
    const nomeados = new Set(METODOS_DE_TREINO.map(m => m.id));
    for (const id of liberados) {
      expect(nomeados.has(id), `metodo "${id}" e liberado mas nao tem nome`).toBe(true);
    }
  });
});
