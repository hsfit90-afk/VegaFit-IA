// A anamnese ("Local de treino") e o gerador ("Equipamentos") falam do mesmo assunto com
// vocabulários diferentes. Este mapeamento conecta os dois, para o dropdown do gerador já vir
// com o que o aluno respondeu, em vez de cair sempre em "Academia completa".
//
// MUDOU EM 08/10/2026: o gerador tinha quatro opções e passou a ter duas.
//
// "Halteres em casa" e "Barra e anilhas" obrigavam o aluno a traduzir o que ele tem num rótulo
// só. Quem tem banco, halteres E barra escolhia um dos dois e perdia equipamento nas duas
// escolhas. E "Ar livre / parque" caía em calistenia pura, embora parque tenha barra fixa e
// paralelas.
//
// O erro não era ter quatro opções — era tentar resumir um inventário num rótulo. O
// inventário agora é uma lista de caixas (lib/equipamentoCasa.ts), e o dropdown só responde
// onde a pessoa treina.

export const LOCAL_ACADEMIA = 'Academia completa';
export const LOCAL_CASA = 'Em casa';

export function mapAnamneseLocationToEquipment(local: string | undefined | null): string {
  switch (local) {
    case 'Academia completa':
      return LOCAL_ACADEMIA;
    // Os valores antigos da anamnese continuam sendo reconhecidos: perfil preenchido antes
    // desta mudança não pode voltar a cair em "Academia completa" por engano e receber um
    // treino de leg press para fazer na sala.
    case 'Casa com equipamentos':
    case 'Casa sem equipamentos':
    case 'Ar livre / parque':
    case 'Em casa':
      return LOCAL_CASA;
    default:
      return LOCAL_ACADEMIA;
  }
}

/** Treina em casa? Decide qual filtro de equipamento aplicar. */
export function treinaEmCasa(equipamento: string | undefined | null): boolean {
  return equipamento === LOCAL_CASA;
}
