import { describe, it, expect } from 'vitest';
import { classifyExerciseLevel, normalizarNivel, NIVEIS_PERMITIDOS, GRUPOS_SEM_FILTRO_DE_NIVEL } from '@/lib/exerciseLevel';

/**
 * A queixa que originou isto: "achei muito complexo para o nível iniciante".
 *
 * A causa era que o nível do aluno só afetava a QUANTIDADE de exercícios por sessão (3 a 8) e
 * as faixas de série/repetição. O pool era idêntico para todo mundo — um iniciante disputava
 * os mesmos 882 exercícios que um avançado, incluindo muscle up e agachamento búlgaro.
 *
 * Os nomes abaixo são reais, do catálogo em produção.
 */

describe('classifyExerciseLevel — padrões sempre avançados', () => {
  it('pliometria é avançada: a aterrissagem sob carga é o risco', () => {
    expect(classifyExerciseLevel('Agachamento com salto e halteres')).toBe('avancado');
    expect(classifyExerciseLevel('Barra fixa com Salto')).toBe('avancado');
    expect(classifyExerciseLevel('Agachamento com Salto usando Barra Hexagonal')).toBe('avancado');
  });

  it('calistenia de alto nível é avançada', () => {
    expect(classifyExerciseLevel('Muscle up')).toBe('avancado');
    expect(classifyExerciseLevel('Bandeira Humana')).toBe('avancado');
    expect(classifyExerciseLevel('Caminhada na Parada de Mão')).toBe('avancado');
  });

  it('unilateral de PERNA com instabilidade é avançado', () => {
    expect(classifyExerciseLevel('Agachamento Búlgaro com Barra')).toBe('avancado');
    expect(classifyExerciseLevel('Agachamento Búlgaro com Halteres')).toBe('avancado');
  });

  it('unilateral de BRAÇO não é avançado — é isolamento comum', () => {
    // Um iniciante faz rosca unilateral sem risco nenhum. Tratar "unilateral" como sinal
    // de dificuldade teria tirado 88 exercícios do pool dele sem motivo.
    expect(classifyExerciseLevel('Rosca unilateral com haltere')).toBe('iniciante');
    expect(classifyExerciseLevel('Extensão de tríceps com haltere em pronação com um braço')).toBe('iniciante');
  });

  it('o padrão avançado vence o composto contido no nome', () => {
    // Contém "agachamento" (intermediário) e "búlgaro" + "salto" (avançado).
    expect(classifyExerciseLevel('Agachamento búlgaro com salto')).toBe('avancado');
  });
});

describe('classifyExerciseLevel — variação técnica depende do equipamento', () => {
  it('é avançada em peso livre', () => {
    expect(classifyExerciseLevel('Agachamento Frontal com haltere')).toBe('avancado');
    expect(classifyExerciseLevel('Levantamento Terra Sumô')).toBe('avancado');
  });

  it('cai para intermediária quando a máquina estabiliza', () => {
    // Regressão de um falso positivo real: no Smith a máquina carrega a estabilização, e a
    // variação frontal perde justamente o que a tornava exigente.
    expect(classifyExerciseLevel('Agachamento Frontal com Barra no Smith')).toBe('intermediario');
    expect(classifyExerciseLevel('Agachamento Frontal com Cabo')).toBe('intermediario');
  });

  it('"frontal" fora do agachamento não torna nada avançado', () => {
    // Falso positivo pego num teste de geração real: um plano de avançado veio com
    // "Elevação frontal com halteres" marcada como exercício avançado. A palavra "frontal"
    // sozinha pegava 17 exercícios errados no catálogo contra 6 certos — elevação frontal é
    // isolamento básico de ombro, dos mais comuns que existem.
    expect(classifyExerciseLevel('Elevação frontal com halteres')).toBe('iniciante');
    expect(classifyExerciseLevel('Elevação Frontal Alternada Com Halteres')).toBe('iniciante');
    expect(classifyExerciseLevel('Alongamento do Peito e Parte Frontal dos Ombros')).toBe('iniciante');
  });
});

describe('classifyExerciseLevel — guiado e básico são de iniciante', () => {
  it('equipamento guiado é de iniciante', () => {
    expect(classifyExerciseLevel('Desenvolvimento de ombro na máquina')).toBe('iniciante');
    expect(classifyExerciseLevel('Cadeira Extensora')).toBe('iniciante');
    expect(classifyExerciseLevel('Cross over polia Alta')).toBe('iniciante');
  });

  it('a máquina de verdade vence o composto livre', () => {
    // Na máquina o aluno senta e empurra: o equipamento dita o movimento inteiro.
    expect(classifyExerciseLevel('Supino na máquina articulada')).toBe('iniciante');
    expect(classifyExerciseLevel('Remada na máquina')).toBe('iniciante');
  });

  it('isolamento e peso corporal básico são de iniciante', () => {
    expect(classifyExerciseLevel('Rosca direta com barra W')).toBe('iniciante');
    expect(classifyExerciseLevel('Prancha isométrica')).toBe('iniciante');
    expect(classifyExerciseLevel('Elevação lateral com halteres')).toBe('iniciante');
  });
});

describe('classifyExerciseLevel — Smith não é máquina', () => {
  it('composto no Smith é intermediário, não de iniciante', () => {
    // Achado no uso real: um aluno iniciante recebeu "supino no Smith". O Smith estabiliza a
    // trajetória, mas o aluno ainda destrava uma barra carregada e executa o mesmo padrão do
    // supino livre — diferente de uma cadeira extensora, em que ele senta e empurra.
    expect(classifyExerciseLevel('Supino na máquina Smith')).toBe('intermediario');
    expect(classifyExerciseLevel('Supino no smith com o triângulo')).toBe('intermediario');
    expect(classifyExerciseLevel('Agachamento no Smith')).toBe('intermediario');
    expect(classifyExerciseLevel('Remada Curvada no Smith')).toBe('intermediario');
    expect(classifyExerciseLevel('Desenvolvimento de ombros na máquina Smith')).toBe('intermediario');
  });

  it('isolado no Smith continua de iniciante', () => {
    // Aqui o Smith de fato só segura a barra: não há padrão composto para aprender.
    expect(classifyExerciseLevel('Encolhimento de Ombros na Máquina Smith')).toBe('iniciante');
    expect(classifyExerciseLevel('Elevação de Panturrilha no Smith')).toBe('iniciante');
    expect(classifyExerciseLevel('Elevação Pélvica na Máquina Smith')).toBe('iniciante');
  });

  it('o Smith ainda estabiliza uma variação técnica', () => {
    // O Smith reduz a exigência de uma variação difícil sem apagar o padrão composto:
    // agachamento frontal no Smith cai de avançado para intermediário, não para iniciante.
    expect(classifyExerciseLevel('Agachamento Frontal com Barra no Smith')).toBe('intermediario');
  });
});

describe('classifyExerciseLevel — composto livre é intermediário', () => {
  it('os básicos de barra e haltere', () => {
    expect(classifyExerciseLevel('Supino reto com barra')).toBe('intermediario');
    expect(classifyExerciseLevel('Remada curvada com barra')).toBe('intermediario');
    expect(classifyExerciseLevel('Levantamento Terra')).toBe('intermediario');
    expect(classifyExerciseLevel('Barra fixa pronada')).toBe('intermediario');
  });
});

describe('NIVEIS_PERMITIDOS — é cumulativo', () => {
  it('iniciante recebe só o dele', () => {
    expect(NIVEIS_PERMITIDOS.iniciante).toEqual(['iniciante']);
  });

  it('avançado recebe TUDO, inclusive o de iniciante', () => {
    // O catálogo de um avançado é o maior, não o mais exótico: ele continua fazendo
    // cadeira extensora. Restringir por cima seria empobrecer o treino dele.
    expect(NIVEIS_PERMITIDOS.avancado).toContain('iniciante');
    expect(NIVEIS_PERMITIDOS.avancado).toContain('intermediario');
    expect(NIVEIS_PERMITIDOS.avancado).toContain('avancado');
  });
});

describe('GRUPOS_SEM_FILTRO_DE_NIVEL', () => {
  it('Ombro passa inteiro, por decisão de produto', () => {
    // O filtro barrava 29 dos 126 exercícios de ombro, e a maior parte era trabalho padrão
    // (remada alta, desenvolvimento Arnold, cubano, com barra). Restringir empobrecia o
    // treino de ombro sem ganho real de segurança.
    expect(GRUPOS_SEM_FILTRO_DE_NIVEL).toContain('Ombro');
  });

  it('a classificação em si continua valendo — a isenção é aplicada na rota', () => {
    // A função não muda: quem decide ignorar o nível é quem monta o pool. Assim o mesmo
    // classificador segue servindo a /api/swap, que pode querer outra política.
    expect(classifyExerciseLevel('Caminhada na Parada de Mão')).toBe('avancado');
    expect(classifyExerciseLevel('Desenvolvimento Arnold')).toBe('intermediario');
  });
});

describe('normalizarNivel', () => {
  it('aceita as formas que o app usa', () => {
    expect(normalizarNivel('Iniciante')).toBe('iniciante');
    expect(normalizarNivel('Intermediário')).toBe('intermediario');
    expect(normalizarNivel('Avançado')).toBe('avancado');
    expect(normalizarNivel('avancado')).toBe('avancado');
  });

  it('na dúvida, prescreve o mais seguro', () => {
    // Perfil incompleto ou valor inesperado não pode liberar muscle up.
    expect(normalizarNivel(undefined)).toBe('iniciante');
    expect(normalizarNivel('')).toBe('iniciante');
    expect(normalizarNivel('sei la')).toBe('iniciante');
  });
});
