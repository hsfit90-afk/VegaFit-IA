import { describe, it, expect } from 'vitest';
import {
  filtrarPorEquipamentoAusente, resumirAusentes, EQUIPAMENTOS, IDS_VALIDOS,
} from '@/lib/equipamentoAusente';

/**
 * O checklist marca o que a academia NAO tem. Quem nao preencher continua recebendo o
 * catalogo inteiro -- que e o comportamento de hoje e o certo para a maioria.
 */

const ex = (name: string, muscle_group: string) => ({ name, muscle_group });

const catalogo = [
  ex('Leg press 45 graus', 'Perna'),
  ex('Agachamento livre com barra', 'Perna'),
  ex('Cadeira extensora', 'Perna'),
  ex('Supino reto com barra', 'Peito'),
  ex('Cross over polia alta', 'Peito'),
  ex('Barra fixa pronada', 'Costas'),
  ex('Remada curvada com barra', 'Costas'),
];

describe('filtrarPorEquipamentoAusente — nao preencher nao muda nada', () => {
  it('lista vazia devolve o catalogo inteiro', () => {
    expect(filtrarPorEquipamentoAusente(catalogo, [])).toHaveLength(catalogo.length);
    expect(filtrarPorEquipamentoAusente(catalogo, null)).toHaveLength(catalogo.length);
    expect(filtrarPorEquipamentoAusente(catalogo, undefined)).toHaveLength(catalogo.length);
  });

  it('id desconhecido nao corta nada', () => {
    // Formulario antigo ou valor forjado nao pode esvaziar o treino de ninguem.
    expect(filtrarPorEquipamentoAusente(catalogo, ['aparelho_inventado'])).toHaveLength(catalogo.length);
  });
});

describe('filtrarPorEquipamentoAusente — corta o que foi marcado', () => {
  it('sem leg press, o leg press sai e o resto da perna fica', () => {
    const r = filtrarPorEquipamentoAusente(catalogo, ['leg_press']);
    expect(r.map(e => e.name)).not.toContain('Leg press 45 graus');
    expect(r.map(e => e.name)).toContain('Agachamento livre com barra');
    expect(r.map(e => e.name)).toContain('Cadeira extensora');
  });

  it('corta varios aparelhos de uma vez', () => {
    const r = filtrarPorEquipamentoAusente(catalogo, ['leg_press', 'cross_over', 'barra_fixa']);
    const nomes = r.map(e => e.name);
    expect(nomes).not.toContain('Leg press 45 graus');
    expect(nomes).not.toContain('Cross over polia alta');
    expect(nomes).not.toContain('Barra fixa pronada');
    expect(nomes).toContain('Supino reto com barra');
  });

  it('nao confunde "barra fixa" com "barra"', () => {
    // Se a palavra fosse so "barra", marcar barra fixa cortaria supino e agachamento livre --
    // e o aluno ficaria sem os exercicios mais basicos que existem.
    const r = filtrarPorEquipamentoAusente(catalogo, ['barra_fixa']);
    expect(r.map(e => e.name)).toContain('Supino reto com barra');
    expect(r.map(e => e.name)).toContain('Agachamento livre com barra');
  });
});

describe('filtrarPorEquipamentoAusente — a salvaguarda por grupo muscular', () => {
  it('grupo que ficaria vazio volta inteiro', () => {
    // Um aluno que marca tudo ficaria sem nenhum exercicio de peito, e o treino sairia torto
    // sem ele entender por que. Melhor receber algo que talvez nao sirva do que nada.
    const soMaquina = [ex('Cross over polia alta', 'Peito'), ex('Voador peitoral', 'Peito')];
    const r = filtrarPorEquipamentoAusente(soMaquina, ['cross_over', 'voador']);
    expect(r).toHaveLength(2);
  });

  it('a salvaguarda vale por grupo, nao para o catalogo todo', () => {
    // Peito ficaria vazio e volta; perna nao ficou vazia, entao o corte dela continua valendo.
    const misto = [
      ex('Cross over polia alta', 'Peito'),
      ex('Leg press 45 graus', 'Perna'),
      ex('Agachamento livre com barra', 'Perna'),
    ];
    const r = filtrarPorEquipamentoAusente(misto, ['cross_over', 'leg_press']);
    const nomes = r.map(e => e.name);
    expect(nomes).toContain('Cross over polia alta');       // voltou: peito zeraria
    expect(nomes).not.toContain('Leg press 45 graus');      // continua cortado
    expect(nomes).toContain('Agachamento livre com barra');
  });
});

describe('catalogo de equipamentos', () => {
  it('a lista e curta: formulario longo ninguem preenche', () => {
    expect(EQUIPAMENTOS.length).toBeLessThanOrEqual(15);
  });

  it('todo item tem rotulo e ao menos uma palavra-chave', () => {
    EQUIPAMENTOS.forEach(e => {
      expect(e.rotulo.length).toBeGreaterThan(2);
      expect(e.palavras.length).toBeGreaterThan(0);
      e.palavras.forEach(p => expect(p).toBe(p.toLowerCase()));
    });
  });

  it('nao ha id repetido', () => {
    expect(new Set(IDS_VALIDOS).size).toBe(IDS_VALIDOS.length);
  });
});

describe('resumirAusentes — a tela explica o efeito', () => {
  it('sem nada marcado, diz que recebe tudo', () => {
    expect(resumirAusentes([])).toMatch(/catalogo completo|catálogo completo/i);
  });

  it('lista os aparelhos marcados em portugues corrido', () => {
    const t = resumirAusentes(['leg_press', 'smith']);
    expect(t).toContain('Leg press');
    expect(t).toContain('Smith');
    expect(t).toContain(' e ');
  });
});
