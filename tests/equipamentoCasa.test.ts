import { describe, it, expect } from 'vitest';
import { cabeEmCasa, filtrarParaCasa, tiersDeCasa, resumirCasa, EQUIPAMENTOS_CASA, avaliarParaCasa, dicasDeImproviso } from '@/lib/equipamentoCasa';

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
    expect(cabeEmCasa('Remada curvada com barra', ['halteres', 'barra'])).toBe(true);
  });

  it('supino exige banco, mesmo tendo a barra', () => {
    // Esta asserção MUDOU em 12/10/2026, e a mudança é a correção: antes o teste afirmava
    // que "Supino reto com barra" passava para quem tinha só halteres e barra. Não passa —
    // supino com barra sem banco não existe; no chão vira floor press, que é outro exercício
    // e tem outro nome. O teste codificava a suposição que deixou banco vazar para quem
    // treina em casa.
    expect(cabeEmCasa('Supino reto com barra', ['halteres', 'barra'])).toBe(false);
    expect(cabeEmCasa('Supino reto com barra', ['halteres', 'barra', 'banco'])).toBe(true);
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

/**
 * Vazamentos achados num treino REAL, em 12/10/2026. Perfil novo, "Em casa", so halteres
 * marcados -- e o plano veio com banco inclinado e puxador alto.
 *
 * As palavras abaixo foram medidas uma a uma no catalogo JA sem os de academia, que e o
 * conjunto em que elas de fato atuam. Medir contra o catalogo inteiro foi o erro que fez o
 * "inclinado" parecer ruim e o "frontal" parecer bom.
 */
describe('cabeEmCasa — vazamentos de 12/10/2026', () => {
  const soHalteres = ['halteres'];

  it('exercicio de banco nao passa para quem so tem halteres', () => {
    // Os dois do print do profissional.
    expect(cabeEmCasa('Elevação lateral com halteres com apoio no peito', soHalteres)).toBe(false);
    expect(cabeEmCasa('Puxada Alta Invertida', soHalteres)).toBe(false);
  });

  it('supino, crucifixo e scott pedem banco mesmo sem dizer a palavra', () => {
    expect(cabeEmCasa('Supino Inclinado com Halteres', soHalteres)).toBe(false);
    expect(cabeEmCasa('Crucifixo com Halteres Inclinado', soHalteres)).toBe(false);
    expect(cabeEmCasa('Rosca scott com halteres', soHalteres)).toBe(false);
  });

  it('com banco marcado, os mesmos passam', () => {
    const comBanco = ['halteres', 'banco'];
    expect(cabeEmCasa('Supino Inclinado com Halteres', comBanco)).toBe(true);
    expect(cabeEmCasa('Crucifixo com Halteres Inclinado', comBanco)).toBe(true);
  });

  it('"no chao" dispensa o banco', () => {
    // Floor press existe e e legitimo: era o unico falso positivo entre os 25 de "supino".
    expect(cabeEmCasa('Supino com kettlebell no chão', ['kettlebell'])).toBe(true);
  });

  it('tronco inclinado em pe CONTINUA passando', () => {
    // O motivo de "inclinado" nao ter virado palavra de banco. Estes nao precisam de nada.
    expect(cabeEmCasa('Elevação lateral com tronco inclinado', soHalteres)).toBe(true);
    expect(cabeEmCasa('Remada Curvada Inclinada com Barra', ['halteres', 'barra'])).toBe(true);
    expect(cabeEmCasa('Flexão inclinada', [])).toBe(true);
  });

  it('nome em ingles de aparelho tambem e cortado', () => {
    expect(cabeEmCasa('Remada invertida com cable inclinado', soHalteres)).toBe(false);
    expect(cabeEmCasa('Pulldown com corda', soHalteres)).toBe(false);
  });

  it('"dumbbell" conta como haltere', () => {
    // Dumbbell-Raise escapava de tudo e caia como peso corporal.
    expect(cabeEmCasa('Dumbbell-Raise', [])).toBe(false);
    expect(cabeEmCasa('Dumbbell-Raise', soHalteres)).toBe(true);
  });

  it('calistenia com "lever" no nome NAO e confundida com maquina', () => {
    expect(cabeEmCasa('Back Lever', [])).toBe(true);
  });

  it('puxada corporal continua valendo', () => {
    // "puxada alta" e o puxador; "puxada" sozinha pegaria estes, que sao corporais.
    expect(cabeEmCasa('Puxada escapular na barra fixa', ['barra_fixa'])).toBe(true);
    expect(cabeEmCasa('Puxada isométrica', [])).toBe(true);
  });
});

/**
 * Improviso em casa — decisao do profissional (CREF, 12/10/2026).
 *
 * Banco e step nao devem simplesmente sumir do treino de quem treina em casa: quase toda casa
 * tem cadeira, sofa, cama e escada. Cortar sem oferecer a alternativa empobrece o treino por
 * uma limitacao que nao existe de verdade.
 */
describe('avaliarParaCasa — improviso', () => {
  const soHalteres = ['halteres'];

  it('exercicio de banco volta, com a dica da cadeira', () => {
    const r = avaliarParaCasa('Supino Inclinado com Halteres', soHalteres);
    expect(r.cabe).toBe(true);
    expect(r.dica).toMatch(/cadeira/i);
  });

  it('nao devolve dica para quem TEM banco', () => {
    const r = avaliarParaCasa('Supino Inclinado com Halteres', ['halteres', 'banco']);
    expect(r.cabe).toBe(true);
    expect(r.dica).toBeUndefined();
  });

  it('banco COM BARRA continua cortado', () => {
    // Supino com barra numa cadeira nao tem apoio para os ombros nem suporte para devolver o
    // peso, e a superficie e estreita. Sao 8 dos 66 exercicios de banco do catalogo.
    expect(avaliarParaCasa('Supino inclinado com barra', ['halteres', 'barra']).cabe).toBe(false);
    expect(avaliarParaCasa('Rosca Scott com Barra W', ['halteres', 'barra']).cabe).toBe(false);
  });

  it('step vira degrau da escada, sempre', () => {
    const r = avaliarParaCasa('Subida no Step com Elevação de Joelhos', []);
    expect(r.cabe).toBe(true);
    expect(r.dica).toMatch(/degrau/i);
  });

  it('exercicio que nao precisa de nada nao ganha dica', () => {
    const r = avaliarParaCasa('Flexão de Braço', []);
    expect(r.cabe).toBe(true);
    expect(r.dica).toBeUndefined();
  });

  it('aparelho de academia nao tem improviso', () => {
    expect(avaliarParaCasa('Puxada Alta Invertida', soHalteres).cabe).toBe(false);
    expect(avaliarParaCasa('Leg Press', soHalteres).cabe).toBe(false);
  });

  it('equipamento sem improviso continua cortando', () => {
    // Nao se improvisa haltere com garrafa de agua numa prescricao seria: a carga nao e
    // aferivel e a progressao fica impossivel.
    expect(avaliarParaCasa('Rosca com halteres', []).cabe).toBe(false);
  });

  it('dicasDeImproviso mapeia so quem precisa', () => {
    const mapa = dicasDeImproviso(
      ['Flexão de Braço', 'Supino Inclinado com Halteres', 'Subida no Step com Elevação de Joelhos'],
      ['halteres']
    );
    expect(mapa.has('Flexão de Braço')).toBe(false);
    expect(mapa.get('Supino Inclinado com Halteres')).toMatch(/cadeira/i);
    expect(mapa.get('Subida no Step com Elevação de Joelhos')).toMatch(/degrau/i);
  });
});

/**
 * Rolo de espuma e equipamento — achado em 12/10/2026.
 *
 * O aquecimento vinha com TRES exercicios de rolo de espuma para um aluno que declarou nao
 * ter equipamento nenhum. A causa era uma suposicao escrita no codigo: "mobilidade nao usa
 * equipamento, entao o filtro de casa nao se aplica a ela".
 */
describe('cabeEmCasa — rolo de espuma', () => {
  it('rolo de espuma nao passa para quem nao marcou acessorios', () => {
    expect(cabeEmCasa('Rolo de espuma para ombro e peito frontal', [])).toBe(false);
    expect(cabeEmCasa('Rolamento de espuma nas costas', ['halteres'])).toBe(false);
    expect(cabeEmCasa('Deslize de parede do serrátil com rolo de espuma', [])).toBe(false);
  });

  it('passa para quem marcou acessorios', () => {
    expect(cabeEmCasa('Rolamento de espuma nas costas', ['acessorios'])).toBe(true);
  });

  it('ab wheel tambem e equipamento', () => {
    expect(cabeEmCasa('Rolo Abdominal (Ab Wheel)', [])).toBe(false);
    expect(cabeEmCasa('Rolo Abdominal (Ab Wheel)', ['acessorios'])).toBe(true);
  });

  it('mobilidade SEM equipamento continua passando', () => {
    // As 14 que sobram, e que garantem que ninguem fica sem aquecimento.
    expect(cabeEmCasa('Círculos com os braços', [])).toBe(true);
    expect(cabeEmCasa('Pêndulo de ombro', [])).toBe(true);
    expect(cabeEmCasa('Rotação espinhal deitado', [])).toBe(true);
    expect(cabeEmCasa('Joelho Alternado no Peito', [])).toBe(true);
    expect(cabeEmCasa('Dorsiflexão plantar', [])).toBe(true);
  });

  it('rolo de espuma NAO ganha improviso', () => {
    // Nao ha substituto caseiro honesto para liberacao miofascial, ao contrario de banco e
    // step. Sai, e o aquecimento se completa com os que nao precisam de nada.
    expect(avaliarParaCasa('Rolamento de espuma nas costas', []).cabe).toBe(false);
  });
});

/**
 * Abdominal e equipamento — 12/10/2026, mesma falha do aquecimento.
 *
 * A sessao de abdominal vinha do catalogo inteiro: quem declarou nao ter nada abria com
 * "Encaixe de Pernas na Bola Suica" e "Abdominal Total na Bola".
 */
describe('cabeEmCasa — core', () => {
  it('abdominal de bola nao passa para quem nao tem bola', () => {
    expect(cabeEmCasa('Encaixe de Pernas na Bola Suíça', [])).toBe(false);
    expect(cabeEmCasa('Abdominal Total na Bola', [])).toBe(false);
    expect(cabeEmCasa('Rollout na Bola Suíça', ['halteres'])).toBe(false);
  });

  it('passa para quem marcou acessorios', () => {
    expect(cabeEmCasa('Abdominal Total na Bola', ['acessorios'])).toBe(true);
  });

  it('"Rolando como uma Bola" NAO e exercicio de bola', () => {
    // Roll like a ball do Pilates: a pessoa abraca os joelhos e rola nas costas. A palavra e
    // metafora. Dos 16 exercicios com "bola" no catalogo, 15 usam bola e so este nao.
    expect(cabeEmCasa('Rolando como uma Bola', [])).toBe(true);
  });

  it('core de peso corporal continua passando', () => {
    expect(cabeEmCasa('Rotação do corpo superior deitado', [])).toBe(true);
    expect(cabeEmCasa('Prancha', [])).toBe(true);
  });

  it('core de maquina e polia continua cortado', () => {
    expect(cabeEmCasa('Abdominal na Máquina', ['acessorios'])).toBe(false);
    expect(cabeEmCasa('Abdominal na Polia em Pé', ['acessorios'])).toBe(false);
  });
});

/**
 * Nomes que NAO nomeiam o aparelho — 12/10/2026.
 *
 * "Levantamento Terra" e "Levantamento com Suporte" apareceram num treino de casa de quem so
 * marcou halteres. Passaram porque o nome nao cita equipamento nenhum, e o filtro le o nome.
 *
 * E o teto do metodo por palavra-chave: aqui ele nao erra a palavra, ele nao TEM palavra.
 */
describe('cabeEmCasa — nomes que escondem o aparelho', () => {
  it('levantamento terra e barra, em todas as variantes', () => {
    for (const n of ['Levantamento Terra', 'Levantamento Terra Romeno', 'Levantamento Terra Sumô',
                     'Levantamento Terra Zercher', 'Levantamento Terra Unilateral']) {
      expect(cabeEmCasa(n, ['halteres'])).toBe(false);
      expect(cabeEmCasa(n, ['halteres', 'barra'])).toBe(true);
    }
  });

  it('agachamento frontal e zercher sao barra', () => {
    expect(cabeEmCasa('Agachamento Frontal', ['halteres'])).toBe(false);
    expect(cabeEmCasa('Agachamento Zercher', ['halteres'])).toBe(false);
    expect(cabeEmCasa('Agachamento Frontal', ['barra'])).toBe(true);
  });

  it('arnold e HALTERE, nao barra', () => {
    expect(cabeEmCasa('Desenvolvimento Arnold', [])).toBe(false);
    expect(cabeEmCasa('Desenvolvimento Arnold', ['halteres'])).toBe(true);
  });

  it('rack, crossover e cadeira de cinto nao existem em casa', () => {
    // Nem com todo o equipamento marcado: nao sao coisas de casa.
    const tudo = ['halteres','barra','elastico','banco','barra_fixa','kettlebell','acessorios'];
    expect(cabeEmCasa('Levantamento com Suporte', tudo)).toBe(false);
    expect(cabeEmCasa('Remada cruzada no cross', tudo)).toBe(false);
    expect(cabeEmCasa('Agachamento com Cinto', tudo)).toBe(false);
  });

  it('agachamento corporal de verdade continua passando', () => {
    // O contraponto: nem todo agachamento de nome exotico precisa de barra.
    expect(cabeEmCasa('Agachamento pistola', [])).toBe(true);
    expect(cabeEmCasa('Agachamento Skater', [])).toBe(true);
    expect(cabeEmCasa('Agachamento Sumô sem Pesos', [])).toBe(true);
    expect(cabeEmCasa('Agachamento com Salto', [])).toBe(true);
  });
});

/**
 * Vazou num treino de casa REAL em 15/10/2026, com o filtro de local ja funcionando.
 *
 * "Puxada para o Rosto de Joelhos" e face pull de polia. Eu tinha medido "puxada" em 12/10 e
 * julgado este como corporal olhando so o nome -- o GIF mostra a polia. Erro de julgamento
 * meu, nao do metodo: medir quantos a palavra pega nao diz se o exercicio precisa de
 * aparelho.
 */
describe('cabeEmCasa — face pull', () => {
  it('face pull e polia, nao peso corporal', () => {
    const tudo = ['halteres','barra','elastico','banco','barra_fixa','kettlebell','acessorios'];
    expect(cabeEmCasa('Puxada para o Rosto de Joelhos', tudo)).toBe(false);
    expect(cabeEmCasa('Face Pull', tudo)).toBe(false);
    expect(cabeEmCasa('Meio Agachado com Puxada para o Rosto no Cabo', tudo)).toBe(false);
  });

  it('as outras puxadas corporais continuam passando', () => {
    // O contraponto: "puxada" sozinha pegaria estas, que sao de barra fixa ou isometricas.
    expect(cabeEmCasa('Puxada escapular na barra fixa', ['barra_fixa'])).toBe(true);
    expect(cabeEmCasa('Puxada isométrica', [])).toBe(true);
    expect(cabeEmCasa('Puxada Front Lever', ['barra_fixa'])).toBe(true);
  });
});
