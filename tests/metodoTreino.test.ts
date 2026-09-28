import { describe, it, expect } from 'vitest';
import { descansoAposSerie, avisoDoProximoPasso, limparAlvosPorSerie, DESCANSO_DROP_SET, DESCANSO_REST_PAUSE } from '@/lib/metodoTreino';

/**
 * Drop Set e Rest-Pause eram so um nome na tela: o cronometro disparava os mesmos 60 segundos
 * depois de toda serie, inclusive ANTES de um drop -- e drop set e justamente nao descansar.
 * O aluno que esperou seis meses para desbloquear a tecnica recebia um treino tradicional com
 * outra etiqueta.
 */

const base = { descansoPadrao: 60 };

describe('descansoAposSerie — drop set', () => {
  it('nao descansa antes do drop', () => {
    const r = descansoAposSerie({ ...base, rotulos: ['S1', 'S2', 'Drop Set'], indiceDaSerie: 1 });
    expect(r).toBe(DESCANSO_DROP_SET);
  });

  it('descansa normal entre as series comuns que vem antes', () => {
    expect(descansoAposSerie({ ...base, rotulos: ['S1', 'S2', 'Drop Set'], indiceDaSerie: 0 })).toBe(60);
  });

  it('depois do drop, descanso normal: o exercicio acabou', () => {
    expect(descansoAposSerie({ ...base, rotulos: ['S1', 'S2', 'Drop Set'], indiceDaSerie: 2 })).toBe(60);
  });

  it('aceita as variacoes de escrita que a IA usa', () => {
    for (const rotulo of ['Drop Set', 'drop set', 'DROP', 'Drop 1', 'Dropset']) {
      expect(descansoAposSerie({ ...base, rotulos: ['S1', rotulo], indiceDaSerie: 0 })).toBe(0);
    }
  });

  it('drops em sequencia nao descansam entre si', () => {
    const rotulos = ['S1', 'S2', 'Drop 1', 'Drop 2'];
    expect(descansoAposSerie({ ...base, rotulos, indiceDaSerie: 1 })).toBe(0);
    expect(descansoAposSerie({ ...base, rotulos, indiceDaSerie: 2 })).toBe(0);
  });
});

describe('descansoAposSerie — rest-pause', () => {
  it('micro-descanso de 15s antes da retomada', () => {
    expect(descansoAposSerie({ ...base, rotulos: ['S1', 'RP1', 'RP2'], indiceDaSerie: 0 }))
      .toBe(DESCANSO_REST_PAUSE);
  });

  it('aceita as formas de escrita', () => {
    for (const rotulo of ['RP', 'RP1', 'rp 2', 'Rest-Pause', 'Rest Pause']) {
      expect(descansoAposSerie({ ...base, rotulos: ['S1', rotulo], indiceDaSerie: 0 })).toBe(15);
    }
  });
});

describe('descansoAposSerie — o que NAO pode encurtar o descanso', () => {
  it('serie comum mantem o descanso do exercicio', () => {
    expect(descansoAposSerie({ ...base, rotulos: ['S1', 'S2', 'S3'], indiceDaSerie: 0 })).toBe(60);
    expect(descansoAposSerie({ ...base, rotulos: ['Aquec', 'S1'], indiceDaSerie: 0 })).toBe(60);
  });

  it('rotulo com as letras r e p nao vira rest-pause por acidente', () => {
    // O regex precisa ancorar: se casasse solto, "Preparacao" ou "Rep max" ganhariam 15s e o
    // aluno treinaria exausto sem motivo.
    for (const rotulo of ['Preparacao', 'Rep max', 'Pirâmide', 'Reps altas']) {
      expect(descansoAposSerie({ ...base, rotulos: ['S1', rotulo], indiceDaSerie: 0 })).toBe(60);
    }
  });

  it('plano antigo, sem rotulos, continua com o descanso de sempre', () => {
    // Nenhuma migracao foi feita: planos salvos antes desta regra existir nao tem targetLabels.
    expect(descansoAposSerie({ ...base, rotulos: undefined, indiceDaSerie: 0 })).toBe(60);
    expect(descansoAposSerie({ ...base, rotulos: null, indiceDaSerie: 0 })).toBe(60);
    expect(descansoAposSerie({ ...base, rotulos: [], indiceDaSerie: 0 })).toBe(60);
  });

  it('respeita o descanso configurado pelo aluno, nao um valor fixo', () => {
    expect(descansoAposSerie({ rotulos: ['S1', 'S2'], indiceDaSerie: 0, descansoPadrao: 90 })).toBe(90);
  });
});

describe('avisoDoProximoPasso — explica por que o cronometro sumiu', () => {
  it('diz o que fazer no drop', () => {
    const t = avisoDoProximoPasso({ ...base, rotulos: ['S1', 'Drop Set'], indiceDaSerie: 0 });
    expect(t).toMatch(/sem descanso/i);
    expect(t).toMatch(/20%/);
  });

  it('diz o que fazer no rest-pause', () => {
    expect(avisoDoProximoPasso({ ...base, rotulos: ['S1', 'RP1'], indiceDaSerie: 0 })).toMatch(/15 segundos/i);
  });

  it('serie comum nao mostra aviso nenhum', () => {
    // Cronometro normal nao precisa de explicacao; texto a toa vira ruido.
    expect(avisoDoProximoPasso({ ...base, rotulos: ['S1', 'S2'], indiceDaSerie: 0 })).toBeNull();
    expect(avisoDoProximoPasso({ ...base, rotulos: ['S1', 'S2'], indiceDaSerie: 1 })).toBeNull();
  });
});

describe('limparAlvosPorSerie — a rede embaixo da IA', () => {
  it('descarta targetWeights em texto, que foi o que a IA devolveu de verdade', () => {
    // Medido em producao pedindo uma piramide: ["Carga Moderada","Carga Pesada","Carga Máxima"].
    // A tela faz `targetWeights?.[i] || 0`, e string e truthy -- o campo de carga do aluno
    // receberia a palavra, e a conta de volume iria junto.
    const r = limparAlvosPorSerie({
      sets: 3,
      targetWeights: ['Carga Moderada', 'Carga Pesada', 'Carga Máxima'],
      targetReps: [10, 8, 6],
      targetLabels: ['S1', 'S2', 'S3'],
    });
    expect(r.targetWeights).toBeUndefined();
    expect(r.targetReps).toEqual([10, 8, 6]);
    expect(r.targetLabels).toEqual(['S1', 'S2', 'S3']);
  });

  it('aceita numero em texto, que e como JSON as vezes volta', () => {
    const r = limparAlvosPorSerie({ sets: 3, targetWeights: ['20', '25', '30'] });
    expect(r.targetWeights).toEqual([20, 25, 30]);
  });

  it('descarta o array inteiro se UM item for invalido', () => {
    // Meio array aplicado e pior que nenhum: a serie 2 pegaria carga e a 3 zero, sem aviso.
    const r = limparAlvosPorSerie({ sets: 3, targetReps: [10, 'oito', 6] });
    expect(r.targetReps).toBeUndefined();
  });

  it('descarta array de tamanho diferente de sets', () => {
    // Desalinha rotulo e serie: a serie 3 mostraria o rotulo da 2, e no drop set isso
    // significa descansar na hora errada.
    expect(limparAlvosPorSerie({ sets: 3, targetLabels: ['S1', 'Drop Set'] }).targetLabels).toBeUndefined();
    expect(limparAlvosPorSerie({ sets: 3, targetLabels: ['S1', 'S2', 'Drop Set'] }).targetLabels)
      .toEqual(['S1', 'S2', 'Drop Set']);
  });

  it('nao inventa campo quando a IA nao mandou nada', () => {
    const r = limparAlvosPorSerie({ sets: 3 });
    expect(r.targetReps).toBeUndefined();
    expect(r.targetWeights).toBeUndefined();
    expect(r.targetLabels).toBeUndefined();
  });

  it('nao mexe no resto do exercicio', () => {
    const r = limparAlvosPorSerie({ sets: 3, name: 'Supino', reps: '8-12', targetReps: ['x'] } as any);
    expect((r as any).name).toBe('Supino');
    expect((r as any).reps).toBe('8-12');
  });
});
