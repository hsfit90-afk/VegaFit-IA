import { describe, it, expect } from 'vitest';
import { descansoAposSerie, avisoDoProximoPasso, DESCANSO_DROP_SET, DESCANSO_REST_PAUSE } from '@/lib/metodoTreino';

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
