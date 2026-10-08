import { describe, it, expect } from 'vitest';
import { classificarTipo, selecionarMobilidade, selecionarAlongamento } from '@/lib/preparoFinalizacao';

/**
 * A prescricao, definida pelo profissional (CREF):
 *   MOBILIDADE  antes do treino, amarrada aos grupos do dia.
 *   AEROBICO    sempre depois da forca.
 *   ALONGAMENTO em qualquer momento do dia -- tela propria, nao bloco da sessao.
 */

describe('classificarTipo', () => {
  it('separa alongamento de mobilidade', () => {
    // Nao sao a mesma coisa: um vai para a tela livre, o outro para o aquecimento.
    expect(classificarTipo('Alongamento Dinâmico do Peitoral')).toBe('alongamento');
    expect(classificarTipo('Rolamento de espuma nas costas')).toBe('mobilidade');
    expect(classificarTipo('Círculos com os braços')).toBe('mobilidade');
  });

  it('cardio vem do grupo muscular, nao do nome', () => {
    expect(classificarTipo('Esteira', 'Cardio')).toBe('cardio');
    expect(classificarTipo('Corrida leve', 'Cardio')).toBe('cardio');
  });

  it('exercicio de forca continua sendo forca', () => {
    expect(classificarTipo('Supino reto com barra')).toBe('forca');
    expect(classificarTipo('Agachamento livre')).toBe('forca');
  });

  it('com carga, e FORCA mesmo citando articulacao em rotacao', () => {
    // "Rotacao externa do ombro com cabo" e trabalho de manguito rotador, nao aquecimento.
    // A protecao ja existia em lib/exerciseType.ts e foi mantida aqui pelo mesmo motivo.
    expect(classificarTipo('Rotação externa de ombro com faixa elástica')).toBe('forca');
    expect(classificarTipo('Rotação Externa do Ombro com Cabo')).toBe('forca');
    expect(classificarTipo('Alongamento com halteres')).toBe('forca');
  });
});

const cat = [
  { name: 'Círculos com os braços', muscle_group: 'Ombro' },
  { name: 'Rolamento de espuma nas costas', muscle_group: 'Costas' },
  { name: 'Rotação de pé e tornozelo', muscle_group: 'Pernas (quadríceps)' },
  { name: 'Catavento corporal', muscle_group: 'Core/Abdômen' },
  { name: 'Alongamento Dinâmico do Peitoral', muscle_group: 'Peito' },
  { name: 'Alongamento dos Adutores', muscle_group: 'Pernas (quadríceps)' },
  { name: 'Supino reto com barra', muscle_group: 'Peito' },
  { name: 'Agachamento livre', muscle_group: 'Pernas (quadríceps)' },
];

describe('selecionarMobilidade — prepara o que vai ser carregado', () => {
  it('prefere a mobilidade dos grupos do dia', () => {
    const r = selecionarMobilidade(cat, ['Pernas (quadríceps)'], 1);
    expect(r[0].name).toBe('Rotação de pé e tornozelo');
  });

  it('casa "Perna" curto com "Pernas (quadríceps)" do catalogo', () => {
    // A sessao gerada traz o nome curto e o catalogo o longo. Sem casar, o aquecimento viria
    // sempre generico e ninguem perceberia.
    const r = selecionarMobilidade(cat, ['Perna'], 1);
    expect(r[0].name).toBe('Rotação de pé e tornozelo');
  });

  it('completa com mobilidade de outro grupo quando falta', () => {
    // So 20 exercicios de mobilidade no catalogo inteiro, e alguns grupos nao tem nenhum.
    // Melhor aquecer com algo generico do que nao aquecer.
    const r = selecionarMobilidade(cat, ['Bíceps'], 3);
    expect(r).toHaveLength(3);
  });

  it('nunca devolve exercicio de forca nem alongamento', () => {
    const r = selecionarMobilidade(cat, ['Peito'], 4);
    r.forEach(e => expect(classificarTipo(e.name, e.muscle_group)).toBe('mobilidade'));
  });
});

describe('selecionarAlongamento', () => {
  it('sem grupo, devolve todo o alongamento disponivel', () => {
    const r = selecionarAlongamento(cat);
    expect(r).toHaveLength(2);
    r.forEach(e => expect(classificarTipo(e.name, e.muscle_group)).toBe('alongamento'));
  });

  it('filtra pelo grupo pedido', () => {
    const r = selecionarAlongamento(cat, ['Peito']);
    expect(r).toHaveLength(1);
    expect(r[0].name).toContain('Peitoral');
  });

  it('grupo sem alongamento devolve o resto, em vez de lista vazia', () => {
    // Tela de alongamento vazia parece app quebrado.
    const r = selecionarAlongamento(cat, ['Antebraço']);
    expect(r.length).toBeGreaterThan(0);
  });
});
