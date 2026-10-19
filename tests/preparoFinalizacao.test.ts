import { describe, it, expect } from 'vitest';
import {
  classificarTipo,
  selecionarMobilidade,
  selecionarAlongamento,
  selecionarAbdominal,
  articulacoesDosGrupos,
  articulacoesDoExercicio,
} from '@/lib/preparoFinalizacao';

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

/**
 * Prescricao de 11/10/2026: a tela de mobilidade passa a dizer QUAIS ARTICULACOES o treino do
 * dia vai usar. O catalogo so guarda grupo muscular, entao a ponte e este mapa.
 */
describe('articulacoesDosGrupos', () => {
  it('dia de perna traz quadril, joelho e tornozelo', () => {
    const r = articulacoesDosGrupos(['Pernas (quadríceps)', 'Posterior de coxa', 'Panturrilhas']);
    expect(r).toContain('Quadril');
    expect(r).toContain('Joelho');
    expect(r).toContain('Tornozelo');
  });

  it('dia de empurrar traz ombro e cotovelo', () => {
    const r = articulacoesDosGrupos(['Peito', 'Ombro', 'Tríceps']);
    expect(r).toContain('Ombro');
    expect(r).toContain('Cotovelo');
  });

  it('nao repete articulacao citada por dois grupos', () => {
    // Peito e Ombro apontam os dois para "Ombro". Listar duas vezes e so ruido na tela.
    const r = articulacoesDosGrupos(['Peito', 'Ombro']);
    expect(r.filter(a => a === 'Ombro')).toHaveLength(1);
  });

  it('le o grupo com e sem acento, em qualquer caixa', () => {
    // Plano antigo grava "PERNAS (QUADRÍCEPS)"; plano novo grava "Pernas (quadríceps)".
    expect(articulacoesDosGrupos(['PERNAS (QUADRÍCEPS)'])).toContain('Joelho');
    expect(articulacoesDosGrupos(['pernas (quadriceps)'])).toContain('Joelho');
    expect(articulacoesDosGrupos(['Tríceps'])).toContain('Cotovelo');
    expect(articulacoesDosGrupos(['Triceps'])).toContain('Cotovelo');
  });

  it('ignora grupo desconhecido em vez de inventar', () => {
    expect(articulacoesDosGrupos(['Pescoço', 'Antebraço'])).toEqual([]);
    expect(articulacoesDosGrupos([])).toEqual([]);
  });
});

/**
 * Catálogo de mobilidade espelhando o real, com as etiquetas que ele de fato usa.
 *
 * O ponto destes testes é o bug de 19/10/2026: NÃO existe mobilidade etiquetada "Peito" nem
 * "Bíceps". Quem prepara o ombro está etiquetado "Ombro". Casar grupo com grupo dava zero
 * candidatos num dia de supino e caía em tornozelo.
 */
const mob = [
  { name: 'Círculos com os braços', muscle_group: 'Ombro' },
  { name: 'Pêndulo de ombro', muscle_group: 'Ombro' },
  { name: 'Rolamento de espuma nos romboides', muscle_group: 'Costas' },
  { name: 'Rotação espinhal deitado', muscle_group: 'Lombar' },
  { name: 'Dorsiflexão plantar', muscle_group: 'Panturrilhas' },
  { name: 'Rotação de Pé e Tornozelo', muscle_group: 'Panturrilhas' },
  { name: 'Catavento corporal', muscle_group: 'Core/Abdômen' },
];

describe('selecionarMobilidade — escolhe pela ARTICULAÇÃO', () => {
  it('dia de peito recebe mobilidade de OMBRO, nao de tornozelo', () => {
    // O BUG QUE ISTO FECHA, medido em 19/10/2026: "Peito" nao casa com nenhuma etiqueta de
    // mobilidade do catalogo, entao a escolha caia no generico e entregava DORSIFLEXAO
    // PLANTAR antes do supino.
    //
    // A asserticao e por articulacao, nao por etiqueta: "Rolamento de espuma nos romboides"
    // esta etiquetado Costas e prepara o ombro, entao serve -- e e exatamente esse o ganho.
    const r = selecionarMobilidade(mob, ['Peito'], 2);
    r.forEach(e => expect(articulacoesDoExercicio(e.muscle_group)).toContain('Ombro'));
    expect(r.map(e => e.name)).not.toContain('Dorsiflexão plantar');
  });

  it('dia de costas pega ombro e coluna toracica', () => {
    const r = selecionarMobilidade(mob, ['Costas'], 3);
    const nomes = r.map(e => e.name);
    expect(nomes).toContain('Rolamento de espuma nos romboides');
    expect(nomes.some(n => n === 'Círculos com os braços' || n === 'Pêndulo de ombro')).toBe(true);
    expect(nomes).not.toContain('Dorsiflexão plantar');
  });

  it('dia de perna casa pelo nome curto, que a sessao gerada usa', () => {
    // "Perna" vem da sessao gerada; "Pernas (quadriceps)" vem do catalogo. O canonico de
    // MUSCLE_ALIASES e a ponte -- sem ela, "perna" nao contem "quadriceps" e o dia inteiro
    // caia no generico.
    //
    // A asserticao e sobre ARTICULACAO e nao sobre etiqueta: "Rotacao espinhal deitado" esta
    // etiquetado Lombar e serve o QUADRIL, que um dia de perna carrega. Exigir
    // ['Panturrilhas','Panturrilhas'] seria testar a etiqueta, que e justamente o raciocinio
    // errado que este modulo deixou de fazer.
    const doDia = new Set(articulacoesDosGrupos(['Perna']));
    const r = selecionarMobilidade(mob, ['Perna'], 2);
    expect(r).toHaveLength(2);
    r.forEach(e =>
      expect(articulacoesDoExercicio(e.muscle_group).some(a => doDia.has(a))).toBe(true)
    );
  });

  it('biceps nao tem mobilidade de cotovelo no catalogo, e cai no generico sem quebrar', () => {
    // Falta de cadastro, nao do filtro: nenhum exercicio de mobilidade prepara cotovelo.
    const r = selecionarMobilidade(mob, ['Bíceps'], 3);
    expect(r).toHaveLength(3);
  });

  it('a semente deixa o resultado estavel entre chamadas', () => {
    // Sem isto, cada re-render trocaria os exercicios debaixo de quem esta no meio do treino.
    const a = selecionarMobilidade(mob, ['Peito'], 3, { semente: 42 });
    const b = selecionarMobilidade(mob, ['Peito'], 3, { semente: 42 });
    expect(a.map(e => e.name)).toEqual(b.map(e => e.name));
  });

  it('roletar evita o que esta na tela quando ha de onde', () => {
    const primeiro = selecionarMobilidade(mob, ['Panturrilhas'], 1, { semente: 1 });
    const segundo = selecionarMobilidade(mob, ['Panturrilhas'], 1, {
      semente: 1,
      excluir: primeiro.map(e => e.name),
    });
    expect(segundo[0].name).not.toBe(primeiro[0].name);
    // E os dois continuam servindo ao tornozelo: novidade nao vence relevancia.
    expect(segundo[0].muscle_group).toBe('Panturrilhas');
  });

  it('relevancia vence novidade: o que serve o ombro vem antes do que nao serve', () => {
    // Excluindo os dois etiquetados "Ombro", quem assume e "Rolamento de espuma nos
    // romboides" -- etiquetado COSTAS, que tambem serve o ombro. E o ganho do mapa de
    // articulacao: um dia de peito passou de 0 candidatos para todo mundo que prepara ombro,
    // qualquer que seja a etiqueta de grupo muscular.
    const r = selecionarMobilidade(mob, ['Peito'], 1, {
      excluir: ['Círculos com os braços', 'Pêndulo de ombro'],
    });
    expect(r[0].name).toBe('Rolamento de espuma nos romboides');
    expect(articulacoesDoExercicio(r[0].muscle_group)).toContain('Ombro');
  });

  it('quando o pool do dia acaba, o excluido volta antes do irrelevante', () => {
    // Tres de ombro pedidos, dois disponiveis e os dois ja na tela: o terceiro vem do
    // generico, mas os dois de ombro voltam primeiro. Mobilidade de ombro repetida e melhor
    // que mobilidade de tornozelo nova num dia de supino.
    const soOmbro = mob.filter(e => e.muscle_group === 'Ombro' || e.muscle_group === 'Panturrilhas');
    const r = selecionarMobilidade(soOmbro, ['Peito'], 3, {
      excluir: ['Círculos com os braços', 'Pêndulo de ombro'],
    });
    expect(r.slice(0, 2).map(e => e.muscle_group).sort()).toEqual(['Ombro', 'Ombro']);
  });

  it('nunca devolve forca nem alongamento, mesmo roletando', () => {
    const comLixo = [...mob, { name: 'Supino reto com barra', muscle_group: 'Peito' }];
    const r = selecionarMobilidade(comLixo, ['Peito'], 5);
    r.forEach(e => expect(classificarTipo(e.name, e.muscle_group)).toBe('mobilidade'));
  });
});

describe('selecionarAbdominal', () => {
  const core = [
    { id: '1', name: 'Prancha', muscle_group: 'Core/Abdômen' },
    { id: '2', name: 'Abdominal remador', muscle_group: 'Core/Abdômen' },
    { id: '3', name: 'Elevação de pernas', muscle_group: 'Core/Abdômen' },
    { id: '4', name: 'Supino reto', muscle_group: 'Peito' },
  ];

  it('devolve so core', () => {
    const r = selecionarAbdominal(core, 4);
    expect(r).toHaveLength(3);
    r.forEach(e => expect(e.muscle_group).toBe('Core/Abdômen'));
  });

  it('respeita a quantidade pedida', () => {
    expect(selecionarAbdominal(core, 2)).toHaveLength(2);
  });

  it('a semente deixa estavel; roletar troca', () => {
    const a = selecionarAbdominal(core, 2, { semente: 9 });
    expect(selecionarAbdominal(core, 2, { semente: 9 }).map(e => e.name)).toEqual(a.map(e => e.name));

    const b = selecionarAbdominal(core, 2, { semente: 9, excluir: a.map(e => e.name) });
    expect(b.map(e => e.name)).not.toEqual(a.map(e => e.name));
  });

  it('catalogo sem core devolve vazio em vez de inventar', () => {
    expect(selecionarAbdominal([{ name: 'Supino reto', muscle_group: 'Peito' }], 3)).toEqual([]);
  });
});

describe('articulacoesDoExercicio', () => {
  it('diz qual articulacao a mobilidade prepara', () => {
    expect(articulacoesDoExercicio('Ombro')).toEqual(['Ombro']);
    expect(articulacoesDoExercicio('Panturrilhas')).toEqual(['Tornozelo']);
    expect(articulacoesDoExercicio('Costas')).toEqual(['Ombro', 'Coluna torácica']);
  });

  it('grupo vazio ou desconhecido nao inventa', () => {
    expect(articulacoesDoExercicio(null)).toEqual([]);
    expect(articulacoesDoExercicio('')).toEqual([]);
    expect(articulacoesDoExercicio('Pescoço')).toEqual([]);
  });
});
