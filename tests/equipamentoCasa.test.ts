import { describe, it, expect } from 'vitest';
import { cabeEmCasa, filtrarParaCasa, tiersDeCasa, resumirCasa, EQUIPAMENTOS_CASA } from '@/lib/equipamentoCasa';

/**
 * Espelho invertido do filtro de academia:
 *
 *   ACADEMIA  marca o que FALTA; nao marcar nada = recebe tudo (a maioria tem tudo).
 *   CASA      marca o que TEM;   nao marcar nada = so peso corporal (a maioria nao tem nada).
 *
 * A diferenca importa: em casa, errar para mais prescreve o impossivel -- leg press na sala.
 */

describe('cabeEmCasa — sem nada marcado, so peso corporal', () => {
  it('exercicio que nao cita equipamento entra sempre', () => {
    // Sao 424 assim no catalogo real, cobrindo todos os grupos musculares.
    expect(cabeEmCasa('Flexão de braço', [])).toBe(true);
    expect(cabeEmCasa('Agachamento livre', [])).toBe(true);
    expect(cabeEmCasa('Prancha isométrica', null)).toBe(true);
  });

  it('qualquer equipamento citado sai', () => {
    expect(cabeEmCasa('Rosca bíceps com halteres', [])).toBe(false);
    expect(cabeEmCasa('Supino reto com barra', [])).toBe(false);
    expect(cabeEmCasa('Agachamento com kettlebell', [])).toBe(false);
  });
});

describe('cabeEmCasa — libera so o que foi marcado', () => {
  it('quem tem halteres recebe halteres, nao barra', () => {
    expect(cabeEmCasa('Rosca bíceps com halteres', ['halteres'])).toBe(true);
    expect(cabeEmCasa('Supino reto com barra', ['halteres'])).toBe(false);
  });

  it('quem tem os dois recebe os dois', () => {
    expect(cabeEmCasa('Rosca bíceps com halteres', ['halteres', 'barra'])).toBe(true);
    expect(cabeEmCasa('Supino reto com barra', ['halteres', 'barra'])).toBe(true);
  });

  it('exercicio que pede DOIS equipamentos exige os dois', () => {
    // "Supino com halteres no banco": sem banco, nao da para fazer.
    expect(cabeEmCasa('Supino com halteres no banco', ['halteres'])).toBe(false);
    expect(cabeEmCasa('Supino com halteres no banco', ['halteres', 'banco'])).toBe(true);
  });
});

describe('cabeEmCasa — barra fixa NAO e barra', () => {
  it('quem tem barra e anilhas nao recebe barra fixa', () => {
    // Sao aparelhos diferentes e raramente coexistem numa casa. No catalogo real, "barra"
    // pega 99 exercicios e 19 deles sao de barra fixa.
    expect(cabeEmCasa('Barra fixa pronada', ['barra'])).toBe(false);
    expect(cabeEmCasa('Barra fixa pronada', ['barra_fixa'])).toBe(true);
  });

  it('quem tem so barra fixa nao recebe supino com barra', () => {
    expect(cabeEmCasa('Supino reto com barra', ['barra_fixa'])).toBe(false);
  });

  it('a palavra "barra fixa" sai do texto antes de procurar "barra"', () => {
    // Sem remover, "Barra Fixa Assistida" seria lida como se pedisse barra olimpica tambem,
    // e quem tem so a barra fixa ficaria sem o proprio exercicio.
    expect(cabeEmCasa('Barra Fixa Assistida', ['barra_fixa'])).toBe(true);
  });
});

describe('cabeEmCasa — aparelho de academia nunca entra', () => {
  it('maquina, polia e afins saem mesmo com tudo marcado', () => {
    const tudo = EQUIPAMENTOS_CASA.map(e => e.id);
    expect(cabeEmCasa('Leg press 45 graus', tudo)).toBe(false);
    expect(cabeEmCasa('Cadeira extensora', tudo)).toBe(false);
    expect(cabeEmCasa('Cross over polia alta', tudo)).toBe(false);
    expect(cabeEmCasa('Supino na máquina Smith', tudo)).toBe(false);
    expect(cabeEmCasa('Tríceps francês na polia com corda', tudo)).toBe(false);
  });

  it('nao existe caixa que libere leg press em casa', () => {
    const tudo = EQUIPAMENTOS_CASA.map(e => e.id);
    expect(cabeEmCasa('Leg press', tudo)).toBe(false);
  });
});

describe('filtrarParaCasa — sem salvaguarda, de proposito', () => {
  it('grupo que fica vazio continua vazio', () => {
    // No filtro de academia, devolver um exercicio fora do ideal e inconveniente. Aqui seria
    // prescrever o impossivel -- leg press na sala. Peso corporal cobre todos os grupos.
    const so = [{ name: 'Leg press 45 graus' }, { name: 'Cadeira extensora' }];
    expect(filtrarParaCasa(so, ['halteres', 'barra'])).toHaveLength(0);
  });
});

describe('tiersDeCasa', () => {
  it('peso corporal sempre entra', () => {
    expect(tiersDeCasa([])).toContain('peso_corporal');
    expect(tiersDeCasa(null)).toContain('peso_corporal');
  });

  it('nunca libera maquina', () => {
    const tudo = EQUIPAMENTOS_CASA.map(e => e.id);
    expect(tiersDeCasa(tudo)).not.toContain('maquina');
  });

  it('barra so com barra marcada', () => {
    expect(tiersDeCasa(['halteres'])).not.toContain('barra');
    expect(tiersDeCasa(['barra'])).toContain('barra');
  });
});

describe('resumirCasa — a tela explica o efeito', () => {
  it('sem nada marcado, diz quantos exercicios restam', () => {
    const t = resumirCasa([]);
    expect(t).toMatch(/peso do corpo/i);
    expect(t).toMatch(/400/);
  });

  it('lista o que foi marcado', () => {
    expect(resumirCasa(['halteres', 'banco'])).toContain('halteres');
    expect(resumirCasa(['halteres', 'banco'])).toContain('banco');
  });
});

describe('cabeEmCasa — aerobico', () => {
  it('28 dos 49 do catalogo nao precisam de aparelho', () => {
    // Quem treina na sala ainda tem polichinelo, burpee, corrida estatica, pular corda.
    for (const n of ['Polichinelo (Jumping Jack)', 'Meio Burpee', 'Corrida Estática (Parado)',
                     'Pular Corda', 'Alpinista (Mountain Climber)', 'Caminhada']) {
      expect(cabeEmCasa(n, []), n).toBe(true);
    }
  });

  it('aparelho de cardio nao entra em casa', () => {
    for (const n of ['Esteira Ergométrica', 'Bicicleta Ergométrica Reclinada', 'Airbike (Bike de Ar)',
                     'Máquina Simulador Escada']) {
      expect(cabeEmCasa(n, ['halteres', 'barra']), n).toBe(false);
    }
  });

  it('"Eliptico" no masculino tambem sai', () => {
    // Achado medindo o catalogo em 09/10/2026: a lista tinha "eliptica" mas nao "eliptico", e
    // o catalogo tem "Eliptico" e "Eliptico com Bracos". Vazavam para quem treina em casa.
    expect(cabeEmCasa('Elíptico', [])).toBe(false);
    expect(cabeEmCasa('Elíptico com Braços', [])).toBe(false);
    expect(cabeEmCasa('Máquina Elíptica', [])).toBe(false);
  });

  it('plataforma vibratoria e aparelho, nao peso corporal', () => {
    expect(cabeEmCasa('Plataforma Vibratória', [])).toBe(false);
  });
});
