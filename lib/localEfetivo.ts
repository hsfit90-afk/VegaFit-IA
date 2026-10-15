// Onde o aluno vai treinar, quando o pedido e o perfil discordam.
//
// O BUG QUE ISTO FECHA
//
// Achado em 15/10/2026 olhando planos reais: perfil dizia "Em casa" e o treino saiu com Leg
// Press, Mesa flexora e Cadeira extensora.
//
// A cadeia: o formulário do gerador montava ANTES de o perfil carregar, nascia em "Academia
// completa" e mandava isso explícito no corpo da requisição. A rota tinha uma rede de
// segurança que buscava o local no banco — mas só quando o corpo vinha VAZIO, e ele vinha
// preenchido com o valor errado. Rede de segurança embaixo do lugar errado.
//
// A tela foi corrigida para sincronizar com o perfil. Isto aqui é a trava que sobrevive à
// próxima tela que alguém escrever.
//
// A ASSIMETRIA É DE PROPÓSITO
//
// Quem treina em casa e hoje foi à academia recebe menos do que podia: chato, recuperável, e
// ele percebe na hora. O contrário — quem treina na sala recebendo leg press — é prescrição
// impossível de executar, e é o caso que de fato aconteceu. Entre errar para menos e errar
// para o impossível, erra para menos.

import { treinaEmCasa, mapAnamneseLocationToEquipment } from './trainingLocation';

export interface DecisaoDeLocal {
  /** O que vale para filtrar o catálogo e para o prompt. */
  local: string;
  emCasa: boolean;
  /** true quando o pedido contradisse o perfil e o perfil ganhou. Serve para logar. */
  contradisse: boolean;
}

/**
 * Decide onde o treino acontece.
 *
 * `pedido` é o que veio do corpo da requisição (pode ser vazio); `localDoPerfil` é o
 * training_location do banco, já normalizado ou cru — a função normaliza de novo, porque
 * perfil antigo gravou "Casa com equipamentos".
 */
export function decidirLocal(
  pedido: string | null | undefined,
  localDoPerfil: string | null | undefined
): DecisaoDeLocal {
  const doPerfil = mapAnamneseLocationToEquipment(localDoPerfil);
  const pedidoOuPerfil = pedido || doPerfil;

  // Só o perfil que DIZ casa trava. Perfil sem anamnese cai em "Academia completa" por padrão
  // e não pode travar nada — senão quem nunca respondeu ficaria presa a um palpite.
  const perfilDizCasa = treinaEmCasa(doPerfil);
  const contradisse = perfilDizCasa && !treinaEmCasa(pedidoOuPerfil);

  const local = perfilDizCasa ? doPerfil : pedidoOuPerfil;
  return { local, emCasa: treinaEmCasa(local), contradisse };
}
