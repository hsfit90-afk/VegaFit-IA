import { describe, it, expect } from 'vitest';
import { classifyEquipmentTier, EQUIPMENT_ALLOWED_TIERS } from '@/lib/equipmentTier';
import { isMobilityOnly } from '@/lib/exerciseType';

/**
 * Estes dois classificadores decidem o que entra no treino do aluno.
 *
 * Errar em equipmentTier significa prescrever máquina pra quem treina em casa — o aluno abre o
 * treino e não consegue executar. Errar em exerciseType significa mandar "4 séries de 12" pra um
 * alongamento estático.
 *
 * Os dois trabalham por palavra-chave no NOME, porque o campo `equipment` da tabela é
 * inutilizável (grava "Haltere" fixo em tudo). Os casos abaixo priorizam as armadilhas que os
 * comentários do código relatam ter acontecido de verdade no import da biblioteca.
 */

describe('classifyEquipmentTier', () => {
  it.each([
    ['Cadeira Extensora', 'maquina'],
    ['Puxada Alta com Alavanca', 'maquina'],
    ['Crossover no Cabo', 'maquina'],
    ['Supino no Smith', 'maquina'],
    ['Leg Press 45', 'maquina'],
    ['Esteira Ergométrica', 'maquina'],
  ])('%s => %s', (nome, esperado) => {
    expect(classifyEquipmentTier(nome)).toBe(esperado);
  });

  it.each([
    ['Supino Reto com Barra', 'barra'],
    ['Agachamento Livre com Barra', 'barra'],
  ])('%s => %s', (nome, esperado) => {
    expect(classifyEquipmentTier(nome)).toBe(esperado);
  });

  it.each([
    ['Rosca Direta com Halteres', 'halteres'],
    ['Swing com Kettlebell', 'halteres'],
    ['Agachamento com Anilha', 'halteres'],
    ['Remada com Faixa Elástica', 'halteres'],
  ])('%s => %s', (nome, esperado) => {
    expect(classifyEquipmentTier(nome)).toBe(esperado);
  });

  it.each([
    ['Flexão de Braço', 'peso_corporal'],
    ['Prancha Abdominal', 'peso_corporal'],
    ['Agachamento Livre sem Peso', 'peso_corporal'],
  ])('%s => %s', (nome, esperado) => {
    expect(classifyEquipmentTier(nome)).toBe(esperado);
  });

  describe('armadilhas que o código documenta ter quebrado antes', () => {
    it('"Barra Fixa" é peso corporal, não barra de musculação', () => {
      expect(classifyEquipmentTier('Barra Fixa')).toBe('peso_corporal');
    });

    it('"Dips na Cadeira" é peso corporal, não máquina', () => {
      // A palavra "cadeira" sozinha classificava exercício de casa como só-academia.
      expect(classifyEquipmentTier('Dips na Cadeira')).toBe('peso_corporal');
      expect(classifyEquipmentTier('Paralelas entre Cadeiras')).toBe('peso_corporal');
    });

    it('acessório portátil não é peso corporal puro', () => {
      // Vazavam pra quem escolheu "sem equipamento" e não tinha como executar.
      for (const nome of ['Remada no TRX', 'Agachamento com Bola Medicinal', 'Pular Corda']) {
        expect(classifyEquipmentTier(nome)).toBe('halteres');
      }
    });
  });

  it('não diferencia maiúsculas', () => {
    expect(classifyEquipmentTier('SUPINO NO SMITH')).toBe(classifyEquipmentTier('supino no smith'));
  });

  it('nome vazio não quebra: cai no mais permissivo', () => {
    expect(classifyEquipmentTier('')).toBe('peso_corporal');
  });
});

describe('EQUIPMENT_ALLOWED_TIERS', () => {
  it('academia completa aceita tudo', () => {
    expect(EQUIPMENT_ALLOWED_TIERS['Academia completa']).toHaveLength(4);
  });

  it('calistenia aceita SÓ peso corporal', () => {
    expect(EQUIPMENT_ALLOWED_TIERS['Sem equipamento (calistenia)']).toEqual(['peso_corporal']);
  });

  it('todo local permite peso corporal — senão o aluno ficaria sem treino', () => {
    for (const tiers of Object.values(EQUIPMENT_ALLOWED_TIERS)) {
      expect(tiers).toContain('peso_corporal');
    }
  });

  it('quem treina com halteres em casa não recebe exercício de máquina', () => {
    expect(EQUIPMENT_ALLOWED_TIERS['Halteres em casa']).not.toContain('maquina');
    expect(EQUIPMENT_ALLOWED_TIERS['Barra e anilhas']).not.toContain('maquina');
  });
});

describe('isMobilityOnly', () => {
  it.each([
    'Alongamento de Isquiotibiais',
    'Postura do Cachorro Olhando para Baixo',
    'Rolo de Espuma na Lombar',
    'Abraços nos Joelhos em Pé',
    'Rotação da Coluna Deitado',
  ])('"%s" é mobilidade', (nome) => {
    expect(isMobilityOnly(nome)).toBe(true);
  });

  it.each([
    'Supino Reto com Barra',
    'Agachamento Livre',
    'Remada Curvada',
  ])('"%s" é exercício de força', (nome) => {
    expect(isMobilityOnly(nome)).toBe(false);
  });

  describe('override de resistência', () => {
    it('"Rotação Externa do Ombro com Cabo" é força, apesar de "rotação"', () => {
      // Tem carga real. Sem o override, cairia como mobilidade e sumiria do gerador.
      expect(isMobilityOnly('Rotação Externa do Ombro com Cabo')).toBe(false);
    });

    it('mas sem carga, a mesma rotação é mobilidade', () => {
      expect(isMobilityOnly('Rotação Externa do Ombro')).toBe(true);
    });

    it.each(['cabo', 'faixa elástica', 'haltere'])(
      'a palavra "%s" no nome vence a de mobilidade', (acessorio) => {
        expect(isMobilityOnly(`Alongamento com ${acessorio}`)).toBe(false);
      });
  });

  it('nome vazio não é mobilidade', () => {
    expect(isMobilityOnly('')).toBe(false);
  });
});
