import { describe, it, expect } from 'vitest';
import { perfilDaAnamnese, devePesarDeNovo } from '@/lib/anamneseParaPerfil';

/**
 * A ponte entre a anamnese e as colunas do perfil, que não existia até 01/11/2026.
 *
 * O que estes testes mais protegem é a OMISSÃO: campo em branco ou mal digitado não pode
 * escrever nada, porque o `update` apagaria o valor bom que veio do onboarding. Uma anamnese
 * respondida pela metade é o caso comum, não a exceção.
 */

describe('perfilDaAnamnese', () => {
  it('converte a resposta completa', () => {
    expect(
      perfilDaAnamnese({
        nome: 'Higor de Souza Araujo',
        idade: '33',
        sexo: 'Masculino',
        altura: '188',
        peso: '110',
      }),
    ).toEqual({
      name: 'Higor de Souza Araujo',
      age: 33,
      gender: 'M',
      height: 188,
      weight: 110,
    });
  });

  it('traduz o sexo para a letra da coluna', () => {
    expect(perfilDaAnamnese({ sexo: 'Masculino' }).gender).toBe('M');
    expect(perfilDaAnamnese({ sexo: 'Feminino' }).gender).toBe('F');
  });

  it('OPCAO DESCONHECIDA NAO ESCREVE SEXO', () => {
    // Se alguem acrescentar uma terceira opcao na tela e esquecer deste arquivo, o certo e
    // nao gravar -- nao chutar 'M', que e o padrao silencioso do AppContext.
    for (const s of ['Outro', 'masculino', 'M', '', null, undefined, 42]) {
      expect(perfilDaAnamnese({ sexo: s }).gender, `sexo ${JSON.stringify(s)}`).toBeUndefined();
    }
  });

  it('ANAMNESE VAZIA NAO ESCREVE NADA', () => {
    // O caso que mais importa: um update com campos vazios apagaria o perfil bom.
    expect(perfilDaAnamnese({})).toEqual({});
    expect(perfilDaAnamnese({ nome: '', idade: '', sexo: '', altura: '', peso: '' })).toEqual({});
    expect(perfilDaAnamnese({ nome: '   ' })).toEqual({});
  });

  it('respondido pela metade escreve so o que foi respondido', () => {
    expect(perfilDaAnamnese({ peso: '82', altura: '' })).toEqual({ weight: 82 });
  });

  it('aceita virgula decimal, que e como se digita em portugues', () => {
    expect(perfilDaAnamnese({ peso: '72,5' }).weight).toBe(72.5);
    expect(perfilDaAnamnese({ altura: '175,5' }).height).toBe(175.5);
  });

  it('aceita numero, nao so texto', () => {
    expect(perfilDaAnamnese({ peso: 80, idade: 30 })).toEqual({ weight: 80, age: 30 });
  });

  it('texto que nao e numero nao escreve', () => {
    expect(perfilDaAnamnese({ peso: 'oitenta', idade: 'trinta' })).toEqual({});
  });

  it('VALOR ABSURDO NAO ESCREVE -- e erro de digitacao, nao dado', () => {
    expect(perfilDaAnamnese({ peso: '1100' })).toEqual({});   // ponto esquecido
    expect(perfilDaAnamnese({ altura: '1.88' })).toEqual({}); // metros em vez de cm
    expect(perfilDaAnamnese({ idade: '330' })).toEqual({});
    expect(perfilDaAnamnese({ peso: '0' })).toEqual({});
    expect(perfilDaAnamnese({ peso: '-70' })).toEqual({});
  });

  it('as bordas da faixa sao aceitas', () => {
    expect(perfilDaAnamnese({ peso: '20' }).weight).toBe(20);
    expect(perfilDaAnamnese({ peso: '400' }).weight).toBe(400);
    expect(perfilDaAnamnese({ altura: '80' }).height).toBe(80);
    expect(perfilDaAnamnese({ altura: '250' }).height).toBe(250);
  });

  it('a idade sai inteira', () => {
    expect(perfilDaAnamnese({ idade: '33,7' }).age).toBe(34);
  });

  it('o nome perde o espaco das pontas', () => {
    expect(perfilDaAnamnese({ nome: '  Higor  ' }).name).toBe('Higor');
  });

  it('NAO inventa chave para campo ausente', () => {
    // Espalhar o resultado num update e so seguro se chave ausente significar "nao mexe".
    const r = perfilDaAnamnese({ peso: '90' });
    expect(Object.keys(r)).toEqual(['weight']);
    expect('gender' in r).toBe(false);
    expect('name' in r).toBe(false);
  });
});

describe('devePesarDeNovo', () => {
  it('sem registro anterior, o peso declarado vira o primeiro', () => {
    expect(devePesarDeNovo(90, null)).toBe(true);
    expect(devePesarDeNovo(90, undefined)).toBe(true);
  });

  it('peso diferente do ultimo registra', () => {
    expect(devePesarDeNovo(110, 90)).toBe(true);
    expect(devePesarDeNovo(88, 90)).toBe(true);
  });

  it('MESMO PESO NAO REGISTRA DE NOVO', () => {
    // Refazer a anamnese sem ter mudado de peso encheria o grafico de pontos iguais.
    expect(devePesarDeNovo(90, 90)).toBe(false);
  });

  it('diferenca menor que 100 g conta como o mesmo peso', () => {
    expect(devePesarDeNovo(72.5, 72.5)).toBe(false);
    expect(devePesarDeNovo(72.55, 72.5)).toBe(false);
    expect(devePesarDeNovo(72.6, 72.5)).toBe(true);
  });

  it('sem peso declarado, nao registra nada', () => {
    expect(devePesarDeNovo(null, 90)).toBe(false);
    expect(devePesarDeNovo(undefined, 90)).toBe(false);
    expect(devePesarDeNovo(NaN, 90)).toBe(false);
  });
});
