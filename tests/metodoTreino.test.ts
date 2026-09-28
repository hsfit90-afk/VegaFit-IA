import { describe, it, expect } from 'vitest';
import { descansoAposSerie, avisoDoProximoPasso, limparAlvosPorSerie, fatorDeCarga, rotuloCurto, ehSerieEspecial, instrucaoDaSerie, DESCANSO_DROP_SET, DESCANSO_REST_PAUSE } from '@/lib/metodoTreino';

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
    const r = limparAlvosPorSerie({ sets: 3, targetReps: undefined, targetWeights: undefined, targetLabels: undefined });
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

describe('fatorDeCarga — o drop precisa pesar menos', () => {
  it('serie normal usa a carga cheia', () => {
    expect(fatorDeCarga(['S1', 'S2', 'Drop Set'], 0)).toBe(1);
    expect(fatorDeCarga(['S1', 'S2', 'Drop Set'], 1)).toBe(1);
  });

  it('o drop cai para 80%', () => {
    // Sem isto a app sugeria o MESMO peso nas tres series, inclusive no drop -- e quem
    // seguisse a sugestao estaria fazendo serie normal com outro nome, chegando a falha na
    // segunda repeticao.
    expect(fatorDeCarga(['S1', 'S2', 'Drop Set'], 2)).toBeCloseTo(0.8);
  });

  it('drops em sequencia acumulam', () => {
    const r = ['S1', 'S2', 'Drop 1', 'Drop 2'];
    expect(fatorDeCarga(r, 2)).toBeCloseTo(0.8);
    expect(fatorDeCarga(r, 3)).toBeCloseTo(0.64);
  });

  it('rest-pause NAO reduz: a tecnica e manter a carga', () => {
    // Reduzir ali descaracterizaria o metodo -- rest-pause compra repeticao com descanso
    // curto, nao com peso menor.
    expect(fatorDeCarga(['S1', 'RP1', 'RP2'], 1)).toBe(1);
    expect(fatorDeCarga(['S1', 'RP1', 'RP2'], 2)).toBe(1);
  });

  it('plano sem rotulo usa carga cheia', () => {
    expect(fatorDeCarga(undefined, 0)).toBe(1);
    expect(fatorDeCarga([], 2)).toBe(1);
  });
});

describe('rotuloCurto — cabe na coluna estreita', () => {
  it('S1 vira 1: o S nao acrescenta nada na coluna de series', () => {
    expect(rotuloCurto('S1', 0)).toBe('1');
    expect(rotuloCurto('S3', 2)).toBe('3');
  });

  it('drop vira D ou D1', () => {
    expect(rotuloCurto('Drop Set', 2)).toBe('D');
    expect(rotuloCurto('Drop 2', 3)).toBe('D2');
  });

  it('rest-pause mantem o numero', () => {
    expect(rotuloCurto('RP1', 1)).toBe('RP1');
    expect(rotuloCurto('Rest-Pause', 1)).toBe('RP');
  });

  it('sem rotulo cai no numero da serie, como era antes', () => {
    expect(rotuloCurto(undefined, 0)).toBe('1');
    expect(rotuloCurto(undefined, 4)).toBe('5');
  });

  it('rotulo inesperado e cortado em vez de quebrar a linha', () => {
    expect(rotuloCurto('Aquecimento', 0)).toBe('Aque');
  });
});

describe('ehSerieEspecial — a linha precisa se destacar', () => {
  it('drop e rest-pause sim, serie comum nao', () => {
    expect(ehSerieEspecial('Drop Set')).toBe(true);
    expect(ehSerieEspecial('RP1')).toBe(true);
    expect(ehSerieEspecial('S1')).toBe(false);
    expect(ehSerieEspecial(undefined)).toBe(false);
  });
});

describe('instrucaoDaSerie — diz o que fazer na linha, nao so o que a tecnica e', () => {
  it('drop set manda ir ate a falha, com a carga em kg', () => {
    // A linha mostra "D · 16 · 8". O 8 pre-preenchido contradiz a tecnica: drop set e ate a
    // falha. Sem esta frase o aluno faz 8 repeticoes e acha que cumpriu.
    const t = instrucaoDaSerie('Drop Set', 16);
    expect(t).toMatch(/sem descansar/i);
    expect(t).toMatch(/16 kg/);
    expect(t).toMatch(/maximo que conseguir|máximo que conseguir/i);
  });

  it('sem carga calculada, cai na porcentagem', () => {
    // Aluno sem historico ainda nao tem 1RM, entao nao ha kg para sugerir.
    expect(instrucaoDaSerie('Drop Set', 0)).toMatch(/20%/);
  });

  it('rest-pause manda MANTER a carga', () => {
    const t = instrucaoDaSerie('RP1', 30);
    expect(t).toMatch(/15 segundos/);
    expect(t).toMatch(/mesma carga/i);
    expect(t).not.toMatch(/baixe|reduza/i);
  });

  it('serie comum nao mostra instrucao: uma em toda linha vira ruido', () => {
    expect(instrucaoDaSerie('S1', 20)).toBeNull();
    expect(instrucaoDaSerie(undefined, 20)).toBeNull();
  });
});
