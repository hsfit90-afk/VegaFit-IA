/**
 * Larguras e espaçamento das telas, em um lugar só.
 *
 * O problema que isto resolve: cada tela escolhia a própria largura máxima, e o app tinha
 * OITO diferentes — de `max-w-sm` (384px) no onboarding a `max-w-7xl` (1280px) no dashboard,
 * com paddings variando entre p-4, p-5, p-6 e p-8. Navegando entre telas num monitor grande,
 * o conteúdo pulava de largura a cada troca, e o app parecia mudar de tamanho sozinho.
 *
 * Piorava no notebook: a barra lateral fixa ocupa 260px, então numa tela de 1366px sobram
 * 1106px. O dashboard (1280px) ficava espremido enquanto o treino (896px) sobrava folga dos
 * dois lados — dois comportamentos bem diferentes na mesma máquina.
 *
 * Agora são três faixas, escolhidas pelo QUE a tela faz, não por gosto de quem a escreveu.
 *
 * Sobre o Tailwind: as classes aparecem aqui como texto literal, então o scanner dele as
 * encontra normalmente. O que NÃO funciona é montar a classe por concatenação
 * (`max-w-${tamanho}`) — aí o Tailwind não gera o CSS.
 */

/** Formulário curto: login, cadastro, recuperar senha, onboarding. Largo demais atrapalha. */
export const LARGURA_AUTH = 'max-w-md';

/** Tela de tarefa: treino, gerador, anamnese, ajustes, coach. Coluna única, leitura focada. */
export const LARGURA_FOCO = 'max-w-3xl';

/** Tela de conteúdo: dashboard, histórico, progresso, biblioteca, admin. Listas e gráficos. */
export const LARGURA_CONTEUDO = 'max-w-5xl';

/**
 * Espaçamento externo padrão. Menor no celular, onde cada pixel de largura conta; confortável
 * a partir do tablet.
 */
export const PADDING_TELA = 'p-5 md:p-8';

/**
 * Respiro no rodapé para o conteúdo não terminar embaixo da navegação inferior do celular
 * (Navigation.tsx usa uma barra fixa em telas menores que md).
 */
export const RODAPE_SEGURO = 'pb-28 md:pb-12';
