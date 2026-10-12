import { describe, it, expect } from 'vitest';
import { proximaSessaoDoPlano } from '@/lib/rotacaoDeSessao';

const SESSOES = [
  { id: 'a', name: 'Treino A' },
  { id: 'b', name: 'Treino B' },
  { id: 'c', name: 'Treino C' },
];

const feito = (planoId: string, sessionId: string, date: number) => ({
  workoutPlanId: planoId,
  sessionId,
  sessionName: SESSOES.find(s => s.id === sessionId)?.name ?? null,
  date,
});

describe('proximaSessaoDoPlano', () => {
  it('plano nunca treinado comeca no A', () => {
    expect(proximaSessaoDoPlano('p1', SESSOES, [])).toBe(0);
  });

  it('retoma depois da ultima feita', () => {
    expect(proximaSessaoDoPlano('p1', SESSOES, [feito('p1', 'a', 100)])).toBe(1);
    expect(proximaSessaoDoPlano('p1', SESSOES, [feito('p1', 'b', 100)])).toBe(2);
  });

  it('da a volta no fim do ciclo', () => {
    expect(proximaSessaoDoPlano('p1', SESSOES, [feito('p1', 'c', 100)])).toBe(0);
  });

  it('usa a MAIS RECENTE, nao a primeira da lista', () => {
    const historico = [feito('p1', 'a', 100), feito('p1', 'c', 300), feito('p1', 'b', 200)];
    expect(proximaSessaoDoPlano('p1', SESSOES, historico)).toBe(0); // depois do C
  });

  it('ignora o historico de OUTROS planos — o bug que isto conserta', () => {
    // O caso real: dois planos, academia e casa. Treinar no plano do outro nao pode mexer
    // no ponto deste. Antes, trocar de plano zerava os dois.
    const historico = [feito('p1', 'a', 100), feito('p2', 'c', 999)];
    expect(proximaSessaoDoPlano('p1', SESSOES, historico)).toBe(1);
    expect(proximaSessaoDoPlano('p2', SESSOES, historico)).toBe(0);
  });

  it('alternar entre dois planos nao trava ninguem no Treino A', () => {
    // A sequencia que o aluno vivia: A, troca, A, troca, A... Agora cada plano anda sozinho.
    const h: any[] = [];
    h.push(feito('casa', 'a', 1));
    expect(proximaSessaoDoPlano('casa', SESSOES, h)).toBe(1);
    h.push(feito('academia', 'a', 2));
    expect(proximaSessaoDoPlano('academia', SESSOES, h)).toBe(1);
    h.push(feito('casa', 'b', 3));
    expect(proximaSessaoDoPlano('casa', SESSOES, h)).toBe(2);
    expect(proximaSessaoDoPlano('academia', SESSOES, h)).toBe(1); // intocado
  });

  it('casa pelo NOME quando o historico nao tem id', () => {
    // Historico antigo gravou a sessao sem id.
    const antigo = [{ workoutPlanId: 'p1', sessionId: null, sessionName: 'Treino B', date: 100 }];
    expect(proximaSessaoDoPlano('p1', SESSOES, antigo)).toBe(2);
  });

  it('sessao que sumiu do plano cai no comeco', () => {
    // O plano foi editado e o dia que ele fez nao existe mais. 0 e o unico palpite honesto.
    const h = [{ workoutPlanId: 'p1', sessionId: 'z', sessionName: 'Treino Z', date: 100 }];
    expect(proximaSessaoDoPlano('p1', SESSOES, h)).toBe(0);
  });

  it('plano sem sessoes nao quebra', () => {
    expect(proximaSessaoDoPlano('p1', [], [feito('p1', 'a', 100)])).toBe(0);
  });

  it('ignora data invalida', () => {
    const h = [{ workoutPlanId: 'p1', sessionId: 'c', sessionName: 'Treino C', date: NaN }];
    expect(proximaSessaoDoPlano('p1', SESSOES, h)).toBe(0);
  });
});
