import { describe, it, expect } from 'vitest';
import {
  letraDaSessao,
  semanaDoAluno,
  cargaDaSemana,
  treinosNoMes,
  pesoAtual,
} from '@/lib/painelDeHoje';

/**
 * As contas do painel redesenhado em 31/10/2026.
 *
 * O que estes testes mais protegem não é a aritmética: é o início da semana na SEGUNDA e a
 * letra vinda do NOME, não do índice. Os dois erram em silêncio — uma faixa de semana
 * deslocada em um dia, ou um "A" sobre o nome "Treino B", passam por tsc, lint e build sem
 * uma palavra.
 */

/** Quinta-feira, 29/10/2026, meio-dia. Fixo para o teste não depender de quando roda. */
const QUINTA = new Date(2026, 9, 29, 12, 0, 0).getTime();
const diaDe = (quantosAtras: number, hora = 18) =>
  new Date(2026, 9, 29 - quantosAtras, hora, 0, 0).getTime();

const treino = (date: number, totalVolume = 0) => ({ date, totalVolume });

describe('letraDaSessao', () => {
  it('separa letra e titulo do formato que a IA produz', () => {
    expect(letraDaSessao('Treino A - Peito e Tríceps', 0)).toEqual({
      letra: 'A',
      titulo: 'Peito e Tríceps',
    });
  });

  it('aceita travessao, dois-pontos e barra como separador', () => {
    expect(letraDaSessao('Treino B — Costas', 0).titulo).toBe('Costas');
    expect(letraDaSessao('Treino C: Perna', 0).titulo).toBe('Perna');
    expect(letraDaSessao('Treino D / Ombro', 0).titulo).toBe('Ombro');
  });

  it('A LETRA VEM DO NOME, NAO DO INDICE', () => {
    // O caso real: o app pulou o Treino A por fadiga e mostra o B. Se a letra viesse do
    // indice exibido, a tela diria "A" em cima do nome "Treino B".
    expect(letraDaSessao('Treino B - Costas', 0).letra).toBe('B');
    expect(letraDaSessao('Treino C - Perna', 1).letra).toBe('C');
  });

  it('nome seco "Treino A" nao tem titulo, e nao repete a letra', () => {
    expect(letraDaSessao('Treino A', 0)).toEqual({ letra: 'A', titulo: null });
  });

  it('nome fora do padrao: letra pela posicao, nome inteiro como titulo', () => {
    expect(letraDaSessao('Full Body', 0)).toEqual({ letra: 'A', titulo: 'Full Body' });
    expect(letraDaSessao('Full Body', 2)).toEqual({ letra: 'C', titulo: 'Full Body' });
  });

  it('nao devolve caractere estranho com indice ruim', () => {
    expect(letraDaSessao('Full Body', -1).letra).toBe('A');
    expect(letraDaSessao('Full Body', 26).letra).toBe('A');
    expect(letraDaSessao('Full Body', NaN).letra).toBe('A');
  });

  it('nome vazio ou ausente nao quebra', () => {
    expect(letraDaSessao(null, 0)).toEqual({ letra: 'A', titulo: null });
    expect(letraDaSessao(undefined, 1)).toEqual({ letra: 'B', titulo: null });
    expect(letraDaSessao('   ', 0)).toEqual({ letra: 'A', titulo: null });
  });

  it('a letra sai em maiuscula mesmo escrita minuscula', () => {
    expect(letraDaSessao('treino a - peito', 0).letra).toBe('A');
  });
});

describe('semanaDoAluno', () => {
  it('A SEMANA COMECA NA SEGUNDA, e tem sete dias', () => {
    const semana = semanaDoAluno([], QUINTA);
    expect(semana).toHaveLength(7);
    expect(semana.map(d => d.sigla)).toEqual(['S', 'T', 'Q', 'Q', 'S', 'S', 'D']);
    // 29/10/2026 e uma quinta: a segunda daquela semana e dia 26.
    expect(semana[0].diaDoMes).toBe(26);
    expect(semana[6].diaDoMes).toBe(1); // domingo cai em 01/11
  });

  it('marca hoje na posicao certa', () => {
    const semana = semanaDoAluno([], QUINTA);
    const hoje = semana.filter(d => d.estado === 'hoje');
    expect(hoje).toHaveLength(1);
    expect(semana[3].estado).toBe('hoje'); // quinta = indice 3
  });

  it('DOMINGO E O ULTIMO DIA, nao o primeiro', () => {
    // Testado com um domingo de verdade: 01/11/2026. Se a conversao de getDay() estiver
    // errada, o domingo vira o indice 0 e a faixa inteira desloca.
    const domingo = new Date(2026, 10, 1, 12).getTime();
    const semana = semanaDoAluno([], domingo);
    expect(semana[6].estado).toBe('hoje');
    expect(semana[0].diaDoMes).toBe(26); // ainda a segunda de 26/10
  });

  it('dia passado com treino e feito; sem treino e sem-treino', () => {
    const semana = semanaDoAluno([treino(diaDe(2))], QUINTA); // terca, 27/10
    expect(semana[1].estado).toBe('feito');
    expect(semana[1].treinou).toBe(true);
    expect(semana[0].estado).toBe('sem-treino'); // segunda, sem treino
    expect(semana[0].treinou).toBe(false);
  });

  it('dia futuro e futuro, mesmo sem treino', () => {
    const semana = semanaDoAluno([], QUINTA);
    expect(semana[4].estado).toBe('futuro'); // sexta
    expect(semana[6].estado).toBe('futuro'); // domingo
  });

  it('NAO INVENTA DESCANSO: nenhum estado se chama descanso', () => {
    // O app nao guarda dia de descanso. Chamar falta de "descanso" seria o app
    // inventando prescricao.
    const estados = semanaDoAluno([treino(diaDe(1))], QUINTA).map(d => d.estado);
    expect(estados).not.toContain('descanso');
    for (const e of estados) {
      expect(['feito', 'hoje', 'futuro', 'sem-treino']).toContain(e);
    }
  });

  it('hoje com treino continua "hoje", mas treinou fica verdadeiro', () => {
    // A tela precisa distinguir os dois: hoje-e-ja-treinou desenha diferente de
    // hoje-e-ainda-nao.
    const semana = semanaDoAluno([treino(diaDe(0))], QUINTA);
    expect(semana[3].estado).toBe('hoje');
    expect(semana[3].treinou).toBe(true);
  });

  it('dois treinos no mesmo dia marcam o dia uma vez', () => {
    const semana = semanaDoAluno([treino(diaDe(2, 7)), treino(diaDe(2, 20))], QUINTA);
    expect(semana.filter(d => d.treinou)).toHaveLength(1);
  });

  it('treino de outra semana nao aparece nesta', () => {
    const semana = semanaDoAluno([treino(diaDe(10))], QUINTA);
    expect(semana.filter(d => d.treinou)).toHaveLength(0);
  });
});

describe('cargaDaSemana', () => {
  it('sem historico, zero', () => {
    expect(cargaDaSemana([], QUINTA)).toBe(0);
  });

  it('soma o volume dos treinos desta semana', () => {
    const h = [treino(diaDe(0), 1200), treino(diaDe(2), 800)];
    expect(cargaDaSemana(h, QUINTA)).toBe(2000);
  });

  it('IGNORA treino de semana anterior', () => {
    const h = [treino(diaDe(0), 1000), treino(diaDe(10), 9999)];
    expect(cargaDaSemana(h, QUINTA)).toBe(1000);
  });

  it('registro antigo sem volume conta zero, nao quebra a soma', () => {
    const h = [{ date: diaDe(0) }, treino(diaDe(1), 500)];
    expect(cargaDaSemana(h, QUINTA)).toBe(500);
  });

  it('volume invalido nao contamina a soma', () => {
    const h = [{ date: diaDe(0), totalVolume: NaN }, treino(diaDe(1), 300)];
    expect(cargaDaSemana(h, QUINTA)).toBe(300);
  });

  it('inclui a segunda e o domingo da semana corrente', () => {
    // Segunda = 26/10 (3 dias atras), domingo = 01/11 (3 dias a frente).
    const domingo = new Date(2026, 10, 1, 10).getTime();
    const h = [treino(diaDe(3), 100), treino(domingo, 50)];
    expect(cargaDaSemana(h, QUINTA)).toBe(150);
  });
});

describe('treinosNoMes', () => {
  it('conta por mes de calendario, e compara com o anterior', () => {
    const h = [
      treino(new Date(2026, 9, 3).getTime()),
      treino(new Date(2026, 9, 20).getTime()),
      treino(new Date(2026, 8, 15).getTime()),
    ];
    const r = treinosNoMes(h, QUINTA);
    expect(r.esteMes).toBe(2);
    expect(r.mesPassado).toBe(1);
    expect(r.variacao).toBe(1);
  });

  it('a variacao e diferenca crua, nao porcentagem', () => {
    const h = [
      treino(new Date(2026, 9, 1).getTime()),
      treino(new Date(2026, 8, 1).getTime()),
      treino(new Date(2026, 8, 2).getTime()),
      treino(new Date(2026, 8, 3).getTime()),
    ];
    expect(treinosNoMes(h, QUINTA).variacao).toBe(-2);
  });

  it('ignora treino de dois meses atras', () => {
    const h = [treino(new Date(2026, 7, 10).getTime())];
    const r = treinosNoMes(h, QUINTA);
    expect(r.esteMes).toBe(0);
    expect(r.mesPassado).toBe(0);
  });

  it('devolve o dia do mes, para a tela decidir se a comparacao vale', () => {
    expect(treinosNoMes([], QUINTA).diasDeMes).toBe(29);
    expect(treinosNoMes([], new Date(2026, 9, 2, 12).getTime()).diasDeMes).toBe(2);
  });

  it('janeiro compara com dezembro do ano anterior', () => {
    const janeiro = new Date(2027, 0, 15, 12).getTime();
    const h = [
      treino(new Date(2027, 0, 5).getTime()),
      treino(new Date(2026, 11, 20).getTime()),
    ];
    const r = treinosNoMes(h, janeiro);
    expect(r.esteMes).toBe(1);
    expect(r.mesPassado).toBe(1);
  });

  it('sem historico, tudo zero', () => {
    const r = treinosNoMes([], QUINTA);
    expect(r).toMatchObject({ esteMes: 0, mesPassado: 0, variacao: 0 });
  });
});

describe('pesoAtual', () => {
  it('sem registro, null -- e nao zero', () => {
    // Zero e um peso, e apareceria na tela como "0 kg".
    expect(pesoAtual([])).toBeNull();
  });

  it('devolve o registro mais recente, nao o ultimo do array', () => {
    const h = [
      { date: diaDe(0), weight: 78.4 },
      { date: diaDe(30), weight: 81.2 },
    ];
    expect(pesoAtual(h)).toBe(78.4);
  });

  it('acha o mais recente mesmo com o array fora de ordem', () => {
    const h = [
      { date: diaDe(10), weight: 80 },
      { date: diaDe(1), weight: 77 },
      { date: diaDe(20), weight: 82 },
    ];
    expect(pesoAtual(h)).toBe(77);
  });

  it('peso zero ou invalido devolve null', () => {
    expect(pesoAtual([{ date: diaDe(0), weight: 0 }])).toBeNull();
    expect(pesoAtual([{ date: diaDe(0), weight: NaN }])).toBeNull();
  });
});
