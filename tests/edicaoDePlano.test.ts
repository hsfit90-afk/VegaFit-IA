import { describe, it, expect } from 'vitest';
import {
  chaveDoExercicio,
  chaveDaSessao,
  indexarExercicios,
  mesclarPreservados,
  mesclarSessoesEditadas,
  moverNaLista,
  ajustarCargas,
  aplicarCargaEmTodas,
  CAMPOS_PRESERVADOS,
} from '@/lib/edicaoDePlano';
import { limparAlvosPorSerie } from '@/lib/metodoTreino';

const SUPINO = 'b2222222-2222-2222-2222-222222222222';
const ROSCA = 'c3333333-3333-3333-3333-333333333333';

/**
 * A forma de um exercício dentro do plano.
 *
 * Tudo opcional de propósito: metade dos casos de teste existe justamente para o exercício
 * que NÃO tem um dos campos — é a ausência que o módulo trata.
 */
interface Linha {
  id?: string;
  exerciseId?: string;
  name?: string;
  muscleGroup?: string;
  sets?: number;
  reps?: string;
  restSeconds?: number;
  tips?: string;
  method?: string | null;
  targetReps?: number[];
  targetWeights?: number[];
  targetLabels?: string[];
  youtubeSearchTerm?: string;
}

/** Um exercício como o plano guarda: com periodização e alvos por série. */
const salvo = (over: Partial<Linha> = {}): Linha => ({
  id: 'inst-1',
  exerciseId: SUPINO,
  name: 'Supino Reto com Barra',
  muscleGroup: 'Peito',
  sets: 3,
  reps: '6-10',
  restSeconds: 75,
  tips: 'Escápulas retraídas.',
  youtubeSearchTerm: 'Supino Reto com Barra',
  method: 'Semana 1: 3 séries. Semana 2: 4 séries. Semana 3: 5 séries. Semana 4: Deload.',
  targetReps: [10, 8, 6],
  targetWeights: [40, 45, 50],
  targetLabels: ['S1', 'S2', 'S3'],
  ...over,
});

/** O mesmo exercício como o montador devolve: só os campos do formulário. */
const editado = (over: Partial<Linha> = {}): Linha => ({
  id: 'inst-1',
  exerciseId: SUPINO,
  name: 'Supino Reto com Barra',
  muscleGroup: 'Peito',
  sets: 3,
  reps: '6-10',
  restSeconds: 75,
  tips: 'Escápulas retraídas.',
  ...over,
});

describe('chaveDoExercicio', () => {
  it('prefere o id da instancia', () => {
    expect(chaveDoExercicio({ id: 'inst-1', exerciseId: SUPINO, name: 'Supino' })).toBe('id:inst-1');
  });

  it('cai para exerciseId quando nao ha id de instancia', () => {
    expect(chaveDoExercicio({ exerciseId: SUPINO, name: 'Supino' })).toBe('ex:' + SUPINO);
  });

  it('cai para o nome quando nao ha id nenhum', () => {
    // Plano salvo antes de o id existir, e modelo de sessao, que guarda nome.
    expect(chaveDoExercicio({ name: '  Supino Reto  ' })).toBe('nome:supino reto');
  });

  it('devolve null quando nao da para identificar', () => {
    expect(chaveDoExercicio({})).toBeNull();
    expect(chaveDoExercicio({ name: '   ' })).toBeNull();
    expect(chaveDoExercicio(null)).toBeNull();
    expect(chaveDoExercicio(undefined)).toBeNull();
  });

  it('nao confunde um nome que parece id com um id', () => {
    // O prefixo existe para isto: um exercicio cujo NOME e, por acaso, o uuid de outro.
    expect(chaveDoExercicio({ name: SUPINO })).not.toBe(chaveDoExercicio({ id: SUPINO }));
  });

  it('ignora espaco em volta do id', () => {
    expect(chaveDoExercicio({ id: '  inst-1  ' })).toBe('id:inst-1');
  });
});

describe('chaveDaSessao', () => {
  it('prefere o id e cai para o nome', () => {
    expect(chaveDaSessao({ id: 's1', name: 'Treino A' })).toBe('id:s1');
    expect(chaveDaSessao({ name: 'Treino A' })).toBe('nome:treino a');
    expect(chaveDaSessao({})).toBeNull();
  });
});

describe('indexarExercicios', () => {
  it('indexa o plano inteiro, nao cada dia', () => {
    // O profissional pode mover um exercicio do Treino A para o B. Procurar so dentro do mesmo
    // dia trataria isso como exercicio novo e apagaria a periodizacao dele.
    const indice = indexarExercicios([
      { id: 's1', name: 'Treino A', exercises: [salvo()] },
      { id: 's2', name: 'Treino B', exercises: [salvo({ id: 'inst-2', exerciseId: ROSCA, name: 'Rosca Direta' })] },
    ]);
    expect(indice.size).toBe(2);
    expect(indice.get('id:inst-1')?.name).toBe('Supino Reto com Barra');
    expect(indice.get('id:inst-2')?.name).toBe('Rosca Direta');
  });

  it('a primeira ocorrencia ganha quando a chave repete', () => {
    // Repeticao so acontece com chave por nome (plano antigo, sem id). Nao existe resposta
    // certa; a primeira e ESTAVEL, que e o que impede dois salvamentos iguais de divergirem.
    const primeiro: Linha = { name: 'Supino', method: 'primeiro' };
    const segundo: Linha = { name: 'Supino', method: 'segundo' };
    const indice = indexarExercicios([
      { id: 's1', exercises: [primeiro] },
      { id: 's2', exercises: [segundo] },
    ]);
    expect(indice.get('nome:supino')?.method).toBe('primeiro');
  });

  it('aguenta plano vazio, nulo e sessao sem exercicios', () => {
    expect(indexarExercicios([]).size).toBe(0);
    expect(indexarExercicios(null).size).toBe(0);
    expect(indexarExercicios(undefined).size).toBe(0);
    expect(indexarExercicios([{ id: 's1' }]).size).toBe(0);
  });
});

describe('mesclarPreservados', () => {
  it('traz de volta o que o formulario nao tem', () => {
    // O BUG QUE DEU ORIGEM A ESTE MODULO: salvar pelo montador apagava method, targetReps e
    // targetLabels de TODOS os exercicios do plano.
    const r = mesclarPreservados(editado(), salvo());
    expect(r).toMatchObject({
      method: 'Semana 1: 3 séries. Semana 2: 4 séries. Semana 3: 5 séries. Semana 4: Deload.',
      targetReps: [10, 8, 6],
      targetLabels: ['S1', 'S2', 'S3'],
      youtubeSearchTerm: 'Supino Reto com Barra',
    });
  });

  it('nao devolve targetWeights, que agora e campo do formulario', () => {
    // Carga sugerida passou a ser editavel em 19/10/2026. Preserva-la sobrescreveria o que o
    // profissional acabou de digitar.
    expect(CAMPOS_PRESERVADOS).not.toContain('targetWeights');
    const r = mesclarPreservados(editado(), salvo());
    expect(r.targetWeights).toBeUndefined();
  });

  it('nao sobrescreve o que a tela mandou de proposito', () => {
    const r = mesclarPreservados(editado({ method: 'Semana 1: 4 séries.' }), salvo());
    expect(r.method).toBe('Semana 1: 4 séries.');
  });

  it('respeita null como "apaga isto"', () => {
    // null e decisao; undefined e ausencia. Tratar os dois igual tiraria do profissional a
    // possibilidade de remover a periodizacao de um exercicio.
    const r = mesclarPreservados(editado({ method: null }), salvo());
    expect(r.method).toBeNull();
  });

  it('exercicio novo sai como veio', () => {
    const novo = editado({ id: 'inst-9', exerciseId: ROSCA, name: 'Rosca Direta' });
    expect(mesclarPreservados(novo, undefined)).toEqual(novo);
  });

  it('nao muta o original nem o editado', () => {
    const a = editado();
    const b = salvo();
    mesclarPreservados(a, b);
    expect(a.method).toBeUndefined();
    expect(b.method).toContain('Deload');
  });
});

describe('mesclarSessoesEditadas', () => {
  const armazenadas = [
    { id: 's1', name: 'Treino A', exercises: [salvo()] },
    { id: 's2', name: 'Treino B', exercises: [salvo({ id: 'inst-2', exerciseId: ROSCA, name: 'Rosca Direta', method: 'Semana 1: 4 séries.' })] },
  ];

  it('preserva em todos os dias de uma vez', () => {
    const r = mesclarSessoesEditadas([
      { id: 's1', name: 'Treino A', exercises: [editado()] },
      { id: 's2', name: 'Treino B', exercises: [editado({ id: 'inst-2', exerciseId: ROSCA, name: 'Rosca Direta' })] },
    ], armazenadas);

    expect(r[0].exercises![0].method).toContain('Deload');
    expect(r[1].exercises![0].method).toBe('Semana 1: 4 séries.');
  });

  it('sobrevive ao exercicio mudar de dia', () => {
    const r = mesclarSessoesEditadas([
      { id: 's1', name: 'Treino A', exercises: [editado({ id: 'inst-2', exerciseId: ROSCA, name: 'Rosca Direta' })] },
    ], armazenadas);
    expect(r[0].exercises![0].method).toBe('Semana 1: 4 séries.');
  });

  it('sobrevive ao dia ser renomeado e reordenado', () => {
    const r = mesclarSessoesEditadas([
      { id: 's2', name: 'Peito e triceps', exercises: [editado({ id: 'inst-2' })] },
      { id: 's1', name: 'Pernas', exercises: [editado()] },
    ], armazenadas);
    expect(r[0].exercises![0].method).toBe('Semana 1: 4 séries.');
    expect(r[1].exercises![0].method).toContain('Deload');
  });

  it('plano novo passa direto', () => {
    const novas = [{ id: 's1', exercises: [editado()] }];
    expect(mesclarSessoesEditadas(novas, [])).toEqual(novas);
    expect(mesclarSessoesEditadas(novas, null)).toEqual(novas);
  });

  it('mantem o resto da sessao intacto', () => {
    // warmup e alongamento nao sao da conta deste modulo, mas passam por ele. Lista VAZIA
    // significa "o profissional decidiu nao prescrever" e nao pode virar undefined no caminho
    // -- ver normalizarSessoes em app/api/admin/plano/route.ts.
    const comPreparo = { id: 's1', name: 'Treino A', exercises: [editado()], warmup: [] };
    const r = mesclarSessoesEditadas([comPreparo], armazenadas);
    expect(r[0]).toMatchObject({ id: 's1', name: 'Treino A', warmup: [] });
  });

  it('sessao sem exercicios nao quebra', () => {
    const r = mesclarSessoesEditadas([{ id: 's1', name: 'Treino A' }], armazenadas);
    expect(r[0].exercises).toEqual([]);
  });

  it('mesclar ANTES de limpar nao reintroduz alvo desalinhado', () => {
    // A ordem no servidor e: mesclar, depois normalizar (que chama limparAlvosPorSerie).
    // Mesclar DEPOIS devolveria targetReps de 3 posicoes a um exercicio que agora tem 4
    // series -- exatamente o desalinhamento que a limpeza existe para tirar.
    const mesclado = mesclarSessoesEditadas(
      [{ id: 's1', exercises: [editado({ sets: 4 })] }],
      armazenadas
    );
    const limpo = limparAlvosPorSerie(mesclado[0].exercises![0]);
    expect(limpo.targetReps).toBeUndefined();
    expect(limpo.targetLabels).toBeUndefined();
  });
});

describe('moverNaLista', () => {
  const lista = ['a', 'b', 'c', 'd'];

  it('move para baixo e para cima', () => {
    expect(moverNaLista(lista, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moverNaLista(lista, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('subir no primeiro e descer no ultimo sao nao-eventos', () => {
    // Isto e chamado por clique de botao. Lancar seria transformar um clique inofensivo em
    // tela branca.
    expect(moverNaLista(lista, 0, -1)).toEqual(lista);
    expect(moverNaLista(lista, 3, 4)).toEqual(lista);
  });

  it('indice invalido devolve a lista como estava', () => {
    expect(moverNaLista(lista, -1, 0)).toEqual(lista);
    expect(moverNaLista(lista, 9, 0)).toEqual(lista);
    expect(moverNaLista(lista, 1, 1)).toEqual(lista);
    expect(moverNaLista(lista, 1.5, 0)).toEqual(lista);
    expect(moverNaLista(lista, 0, NaN)).toEqual(lista);
  });

  it('nao muta a lista original', () => {
    const original = [...lista];
    moverNaLista(original, 0, 3);
    expect(original).toEqual(lista);
  });

  it('lista vazia nao quebra', () => {
    expect(moverNaLista([], 0, 0)).toEqual([]);
  });
});

describe('ajustarCargas', () => {
  it('cresce repetindo a ultima carga', () => {
    // Serie nova com a carga da anterior e a prescricao conservadora. Com zero, a tela do
    // aluno sugeriria barra vazia.
    expect(ajustarCargas([40, 45, 50], 5)).toEqual([40, 45, 50, 50, 50]);
  });

  it('encurta cortando o fim', () => {
    expect(ajustarCargas([40, 45, 50], 2)).toEqual([40, 45]);
  });

  it('nao mexe quando ja bate', () => {
    expect(ajustarCargas([40, 45, 50], 3)).toEqual([40, 45, 50]);
  });

  it('sem carga nenhuma continua sem carga', () => {
    expect(ajustarCargas([], 3)).toBeUndefined();
    expect(ajustarCargas(null, 3)).toBeUndefined();
    expect(ajustarCargas(undefined, 3)).toBeUndefined();
  });

  it('descarta valor que nao e numero', () => {
    expect(ajustarCargas([40, NaN, 50], 3)).toEqual([40, 50, 50]);
    expect(ajustarCargas([-5], 2)).toBeUndefined();
  });

  it('series invalidas devolvem undefined', () => {
    expect(ajustarCargas([40], 0)).toBeUndefined();
    expect(ajustarCargas([40], -1)).toBeUndefined();
    expect(ajustarCargas([40], NaN)).toBeUndefined();
  });

  it('o resultado sobrevive a limparAlvosPorSerie', () => {
    // O contrato que importa: ajustar existe justamente para o array nao ser DESCARTADO pela
    // limpeza quando o profissional mexe no numero de series.
    const cargas = ajustarCargas([40, 45, 50], 4);
    const limpo = limparAlvosPorSerie({ sets: 4, targetWeights: cargas });
    expect(limpo.targetWeights).toEqual([40, 45, 50, 50]);
  });

  it('nao muta a entrada', () => {
    const entrada = [40, 45];
    ajustarCargas(entrada, 4);
    expect(entrada).toEqual([40, 45]);
  });
});

describe('aplicarCargaEmTodas', () => {
  it('repete o valor em todas as series', () => {
    expect(aplicarCargaEmTodas(20, 4)).toEqual([20, 20, 20, 20]);
  });

  it('zero limpa, em vez de prescrever zero', () => {
    // Zero nao e prescricao, e campo em branco. Um array de zeros faria a tela do aluno
    // mostrar "0 kg" como se alguem tivesse decidido isso.
    expect(aplicarCargaEmTodas(0, 4)).toBeUndefined();
    expect(aplicarCargaEmTodas(-10, 4)).toBeUndefined();
    expect(aplicarCargaEmTodas(NaN, 4)).toBeUndefined();
  });

  it('series invalidas devolvem undefined', () => {
    expect(aplicarCargaEmTodas(20, 0)).toBeUndefined();
    expect(aplicarCargaEmTodas(20, NaN)).toBeUndefined();
  });

  it('o resultado sobrevive a limparAlvosPorSerie', () => {
    const limpo = limparAlvosPorSerie({ sets: 3, targetWeights: aplicarCargaEmTodas(20, 3) });
    expect(limpo.targetWeights).toEqual([20, 20, 20]);
  });
});
