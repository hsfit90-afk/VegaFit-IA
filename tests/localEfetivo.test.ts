import { describe, it, expect } from 'vitest';
import { decidirLocal } from '@/lib/localEfetivo';

/**
 * Regressao de producao (15/10/2026): perfil "Em casa" e treino com Leg Press, Mesa flexora e
 * Cadeira extensora.
 *
 * O formulario do gerador montava ANTES de o perfil carregar, nascia em "Academia completa" e
 * mandava isso explicito. A rede de seguranca da rota so buscava o banco quando o corpo vinha
 * VAZIO -- e ele vinha preenchido com o valor errado.
 */
describe('decidirLocal', () => {
  it('perfil de casa GANHA de um pedido de academia', () => {
    const r = decidirLocal('Academia completa', 'Em casa');
    expect(r.emCasa).toBe(true);
    expect(r.local).toBe('Em casa');
    expect(r.contradisse).toBe(true);
  });

  it('pedido vazio cai no perfil', () => {
    expect(decidirLocal('', 'Em casa').emCasa).toBe(true);
    expect(decidirLocal(null, 'Em casa').emCasa).toBe(true);
    expect(decidirLocal(undefined, 'Academia completa').emCasa).toBe(false);
  });

  it('quando os dois concordam, nao ha contradicao', () => {
    expect(decidirLocal('Em casa', 'Em casa').contradisse).toBe(false);
    expect(decidirLocal('Academia completa', 'Academia completa').contradisse).toBe(false);
  });

  it('perfil de academia NAO trava um pedido de casa', () => {
    // A assimetria: quem treina na academia e hoje esta em casa recebe o treino de casa.
    // Errar para menos e recuperavel; prescrever leg press para a sala, nao.
    const r = decidirLocal('Em casa', 'Academia completa');
    expect(r.emCasa).toBe(true);
    expect(r.contradisse).toBe(false);
  });

  it('perfil SEM anamnese nao trava nada', () => {
    // training_location nulo cai em "Academia completa" por padrao. Se isso travasse, quem
    // nunca respondeu ficaria preso a um palpite.
    const r = decidirLocal('Em casa', null);
    expect(r.emCasa).toBe(true);
    expect(r.contradisse).toBe(false);
  });

  it('le os valores antigos de perfil', () => {
    // Perfil anterior a 08/10 gravou "Casa com equipamentos" e "Ar livre / parque".
    expect(decidirLocal('Academia completa', 'Casa com equipamentos').emCasa).toBe(true);
    expect(decidirLocal('Academia completa', 'Ar livre / parque').emCasa).toBe(true);
  });

  it('nada informado vira academia, que e o padrao de sempre', () => {
    const r = decidirLocal(null, null);
    expect(r.emCasa).toBe(false);
    expect(r.contradisse).toBe(false);
  });
});
