// Leva o aluno para a tela de assinatura quando uma rota de IA responde 402.
//
// Por que 402 e não 403: o app precisa distinguir "sua assinatura acabou, vá assinar" de
// "você não tem permissão para isto". Os dois mandam para telas diferentes, e um toast de
// erro genérico deixa a pessoa sem saber o que fazer — que é a pior forma de perder alguém
// que estava justamente prestes a pagar.
//
// Chamar logo depois de `const data = await res.json()`, antes do `if (!res.ok) throw`. Se
// houver redirecionamento a página descarrega em seguida, então o throw que vier depois não
// chega a aparecer para ninguém — por isso não é preciso mexer no fluxo de erro existente.

const HTTP_ASSINATURA_NECESSARIA = 402;

export function tratarBloqueioDeAssinatura(res: Response, data: unknown): boolean {
  if (res.status !== HTTP_ASSINATURA_NECESSARIA) return false;
  if (typeof window === 'undefined') return false;

  // O motivo muda o texto da tela: quem nunca assinou vê o fim do teste, quem já pagou vê
  // o aviso de pagamento pendente. Sem isso os dois casos recebem a mesma mensagem errada
  // para metade deles.
  const status = (data as { status?: string } | null)?.status;
  const destino = status ? `/assinar?de=${encodeURIComponent(status)}` : '/assinar';

  // replace em vez de href: a tela bloqueada não deve ficar no histórico, senão o botão
  // "voltar" devolve a pessoa para a mesma parede.
  window.location.replace(destino);
  return true;
}
