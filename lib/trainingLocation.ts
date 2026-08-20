// A anamnese ("Local de treino") e o gerador de IA ("Equipamentos disponíveis") usam
// vocabulários diferentes pro mesmo conceito. Esse mapeamento conecta os dois, pra
// pré-preencher o dropdown do gerador com o que o aluno já respondeu na anamnese,
// em vez de sempre cair em "Academia completa" fixo.
export function mapAnamneseLocationToEquipment(local: string | undefined | null): string {
  switch (local) {
    case 'Academia completa':
      return 'Academia completa';
    case 'Casa com equipamentos':
      return 'Halteres em casa';
    case 'Casa sem equipamentos':
      return 'Sem equipamento (calistenia)';
    case 'Ar livre / parque':
      return 'Sem equipamento (calistenia)';
    default:
      return 'Academia completa';
  }
}
