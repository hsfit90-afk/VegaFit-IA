"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Zap, Dumbbell, PlayCircle, History, MessageSquare, Settings, TrendingUp, Apple, LogOut, BarChart2, ClipboardList , UserCheck , StretchHorizontal , Waves, Flame, Timer, Users} from 'lucide-react';
import { useAppContext } from '@/app/context/AppContext';

/**
 * `somenteMaster` esconde a tela de todo mundo que não é master.
 *
 * É a marca de "ainda em teste": a funcionalidade existe e funciona, mas o aluno comum não
 * deve nem saber que ela está lá. Para liberar uma delas ao público depois, basta apagar a
 * propriedade desta lista — e para esconder outra, basta acrescentá-la.
 *
 * Ver ROTAS_SOMENTE_MASTER logo abaixo: esconder do menu não basta sozinho, porque o
 * endereço continua acessível por link direto.
 */
/**
 * A ORDEM SEGUE O DIA DO ALUNO, não o gosto de quem escreveu.
 *
 * O ciclo real é: ver o treino, gerar se não tiver, treinar, registrar o que mudou. A lista
 * antiga punha Anamnese em segundo lugar — um formulário que se preenche uma vez e depois
 * quase nunca. Ela desceu para junto do Perfil, onde já estava linkada.
 *
 * As quatro sessões avulsas ficam juntas no fim. Cardio faltava aqui: no dashboard as quatro
 * são irmãs, mesmo card, mesmo rótulo, e só o aeróbico não tinha entrada no menu.
 */
/** Um item do menu. */
type ItemDeNav = {
  href: string;
  label: string;
  icon: typeof Home;
  somenteMaster?: boolean;
};

/**
 * TREINAR SAI DA LISTA E VIRA BOTÃO.
 *
 * Numa lista de dezoito linhas iguais, a coisa que a pessoa veio fazer tinha o mesmo peso
 * visual de "Alongamento". O app vende treino; abrir o treino é a ação, não um item de menu.
 *
 * Fica fora de SECOES_DESKTOP de propósito, para não aparecer duas vezes.
 */
const ACAO_PRINCIPAL: ItemDeNav = { href: '/active', label: 'Treinar agora', icon: PlayCircle };

/**
 * `somenteMaster` esconde a tela de todo mundo que não é master.
 *
 * É a marca de "ainda em teste": a funcionalidade existe e funciona, mas o aluno comum não
 * deve nem saber que ela está lá. Para liberar uma delas ao público depois, basta apagar a
 * propriedade desta lista — e para esconder outra, basta acrescentá-la.
 *
 * Ver ROTAS_SOMENTE_MASTER logo abaixo: esconder do menu não basta sozinho, porque o
 * endereço continua acessível por link direto.
 */
/**
 * A LATERAL EM SEÇÕES — redesenhada em 01/11/2026.
 *
 * O QUE ESTAVA ERRADO, MEDIDO: dezoito itens para o master e treze para o aluno, numa lista
 * plana só. Dezoito linhas a 52px pedem 936px e sobram ~780px numa tela de 1080p, então a
 * lista rolava — e, pior que rolar, nada nela tinha hierarquia. "Treinar" e "Alongamento"
 * eram visualmente a mesma coisa.
 *
 * A ORDEM CONTINUA SEGUINDO O DIA DO ALUNO, como antes: ver o treino, gerar se não tiver,
 * treinar, registrar o que mudou. O que mudou é que o ciclo agora tem nome em cima dele.
 *
 * As quatro sessões avulsas continuam juntas, agora sob "Complementos" — no painel elas já
 * são irmãs (mesmo card, mesmo rótulo), e a lateral passa a dizer isso também.
 *
 * Não cabe tudo sem rolar para o master, e isso é aceito: dezoito itens não cabem em tela
 * nenhuma. A diferença é que agora a rolagem tem referência — você sabe que Mobilidade está
 * em Complementos, em vez de varrer uma lista.
 */
const SECOES_DESKTOP: { titulo: string | null; itens: ItemDeNav[] }[] = [
  {
    // Sem título: o painel é a casa, e rotular um item só seria ruído.
    titulo: null,
    itens: [{ href: '/', label: 'Dashboard', icon: Home }],
  },
  {
    titulo: 'Treino',
    itens: [
      { href: '/generator', label: 'Gerador IA', icon: Zap },
      { href: '/progression', label: 'Check-in', icon: TrendingUp },
    ],
  },
  {
    titulo: 'Complementos',
    itens: [
      { href: '/cardio', label: 'Aeróbico', icon: Timer },
      { href: '/abdominal', label: 'Abdominal', icon: Flame },
      { href: '/mobilidade', label: 'Mobilidade', icon: Waves },
      { href: '/alongamento', label: 'Alongamento', icon: StretchHorizontal },
    ],
  },
  {
    titulo: 'Evolução',
    itens: [
      { href: '/progress', label: 'Progresso', icon: BarChart2 },
      { href: '/history', label: 'Histórico', icon: History },
    ],
  },
  {
    titulo: 'Conta',
    itens: [
      { href: '/personalizado', label: 'Personal', icon: UserCheck },
      { href: '/anamnese', label: 'Anamnese', icon: ClipboardList },
      { href: '/settings', label: 'Perfil', icon: Settings },
    ],
  },
  {
    titulo: 'Master',
    itens: [
      /*
       * O /admin ENTRAVA POR `unshift` NO RENDER, e agora é um item como os outros, marcado
       * com somenteMaster. Duas consequências, as duas boas:
       *
       * - ele deixa de ser o primeiro item da barra para o master, posição que pertence ao
       *   painel, e passa a ficar junto das outras telas de administração;
       * - ROTAS_SOMENTE_MASTER passa a cobrir /admin também. Antes não cobria, porque o item
       *   não estava na lista — a rota mais sensível do app era a única fora da trava.
       */
      { href: '/admin', label: 'Admin', icon: Settings, somenteMaster: true },
      { href: '/admin/treinos', label: 'Treinos dos alunos', icon: Users, somenteMaster: true },
      { href: '/library', label: 'Exercícios', icon: Dumbbell, somenteMaster: true },
      { href: '/nutrition', label: 'Nutrição IA', icon: Apple, somenteMaster: true },
      { href: '/coach', label: 'AI Coach', icon: MessageSquare, somenteMaster: true },
    ],
  },
];

/**
 * A lista plana, DERIVADA das seções — não escrita de novo.
 *
 * Duas cópias da mesma lista divergiriam no primeiro item acrescentado numa e não na outra,
 * e a que alimenta a trava de segurança é esta. Derivando, acrescentar item numa seção já
 * entra na trava sem ninguém lembrar de fazer nada.
 */
const DESKTOP_NAV_ITEMS: ItemDeNav[] = SECOES_DESKTOP.flatMap(s => s.itens);

/**
 * Os cinco do rodapé do celular.
 *
 * CONSERTO DE 09/10/2026: `/progression` (Check-in) e `/history` não tinham NENHUM link fora
 * da barra lateral do desktop, que é `hidden md:flex`. No celular as duas telas simplesmente
 * não eram alcançáveis — num app que se instala como PWA e vende acompanhamento de evolução,
 * e sendo o Check-in o que alimenta a progressão de carga.
 *
 * O lugar saiu da Anamnese: formulário de uma vez só, que já tem porta dentro do Perfil. O
 * Histórico ganhou botão no topo do Progresso, que é onde o aluno vai procurar.
 */
const MOBILE_NAV_ITEMS = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/active', label: 'Treinar', icon: PlayCircle },
  { href: '/progression', label: 'Check-in', icon: TrendingUp },
  { href: '/progress', label: 'Progresso', icon: BarChart2 },
  { href: '/settings', label: 'Perfil', icon: Settings },
];

/** As mesmas rotas, para as telas se protegerem por conta própria. */
export const ROTAS_SOMENTE_MASTER = DESKTOP_NAV_ITEMS
  .filter(i => i.somenteMaster)
  .map(i => i.href);

export function Navigation() {
  const pathname = usePathname();
  const { profile, clearData } = useAppContext();

  const hideNavigation = ['/login', '/register', '/onboarding'].includes(pathname);
  if (hideNavigation) return null;

  // App é B2C: o único papel com menu extra é o master, que cuida da biblioteca global de
  // exercícios pelo /admin. O papel de trainer e suas telas foram removidos.
  const role = profile?.role || 'client';

  const mobileItems = [...MOBILE_NAV_ITEMS];

  const visivel = (item: { href: string; somenteMaster?: boolean }) =>
    !item.somenteMaster || role === 'master';

  /*
   * As seções que este papel enxerga.
   *
   * Filtra os itens primeiro e só depois descarta a seção vazia: sem isso, o aluno comum
   * veria o título "Master" sozinho, sobre nada — que é pior que ver a tela, porque
   * anuncia que existe algo escondido dele.
   */
  const secoesVisiveis = SECOES_DESKTOP
    .map(secao => ({ ...secao, itens: secao.itens.filter(visivel) }))
    .filter(secao => secao.itens.length > 0);

  const filteredMobileNav = mobileItems.filter(visivel);

  return (
    <>
      {/* A LATERAL DO COMPUTADOR, redesenhada em 01/11/2026.

          Ela tinha ficado de fora do redesenho de 31/10: eu mexi só na barra do celular, que
          é o bloco `md:hidden` abaixo, e quem usa no computador não viu nada mudar. */}
      <aside className="hidden md:flex flex-col w-[260px] h-screen fixed top-0 left-0 bg-surface border-r border-border p-5 z-50">
        <div className="flex items-center gap-3 mb-5 shrink-0">
          <div className="w-10 h-10 rounded-dia bg-primary flex items-center justify-center shadow-[0_0_20px_rgb(var(--color-primary-rgb)/0.3)]">
            <Zap className="w-6 h-6 text-primary-foreground" aria-hidden="true" />
          </div>
          <h1 className="font-unbounded text-xl font-bold tracking-tight text-foreground uppercase">VegaFit</h1>
        </div>

        {/* A AÇÃO, antes da navegação.

            Quando já se está em /active ele não vira link morto: continua levando para lá,
            e o anel diz que é onde você está. Botão principal que some quando a pessoa chega
            no destino faz a barra mudar de altura ao navegar. */}
        <Link
          href={ACAO_PRINCIPAL.href}
          className={`shrink-0 mb-5 flex items-center justify-center gap-2 min-h-[48px] rounded-bloco bg-primary text-primary-foreground font-unbounded font-bold text-sm tracking-tight transition-colors duration-[120ms] hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
            pathname === ACAO_PRINCIPAL.href ? 'ring-2 ring-primary/40 ring-offset-2 ring-offset-surface' : ''
          }`}
        >
          <ACAO_PRINCIPAL.icon className="w-5 h-5" aria-hidden="true" />
          {ACAO_PRINCIPAL.label}
        </Link>

        {/* barra-fina, não hide-scrollbar: dezoito itens não cabem em tela de 1080p e o corte
            cai no meio de um item. Sem barra, nada diz que existe mais coisa abaixo — e o
            menu parecia terminar onde a tela terminava. O `pr-1` abre espaço para ela sem
            empurrar o texto dos itens. */}
        <nav className="flex-1 flex flex-col overflow-y-auto barra-fina pr-1">
          {secoesVisiveis.map((secao, i) => (
            <div key={secao.titulo ?? `secao-${i}`} className="shrink-0">
              {secao.titulo && (
                /* `foreground-muted` e não `subtle`: subtle dá 3,66:1 sobre o cartão e reprova
                   em AA. Rótulo de seção é pequeno, mas é texto. */
                <p className="text-nano font-semibold uppercase tracking-widest text-foreground-muted px-3 mt-5 mb-1.5">
                  {secao.titulo}
                </p>
              )}

              {secao.itens.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    // shrink-0 é o que conserta o item cortado ao meio: sem ele, o flex column
                    // espremia os últimos da lista em vez de deixar o <nav> rolar.
                    // truncate + whitespace-nowrap impedem que um rótulo comprido vaze da barra.
                    className={`shrink-0 flex items-center gap-3 px-3 min-h-[44px] rounded-dia text-sm font-semibold transition-colors duration-[120ms] ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground-muted hover:text-foreground hover:bg-surface-light'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-border shrink-0">
          <button
            onClick={() => clearData()}
            className="flex items-center gap-3 px-3 min-h-[44px] rounded-dia text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors duration-[120ms] w-full"
          >
            <LogOut className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </aside>

      {/* A BARRA INFERIOR, REDESENHADA EM 31/10/2026.

          CONTINUA COM CINCO ITENS. O desenho pedia quatro, e cortar um significaria tirar
          a única porta de uma tela no celular — foi exatamente o defeito consertado em
          09/10/2026, quando Check-in e Histórico existiam só na barra lateral do desktop,
          que é `hidden md:flex`. Cinco itens a 70px dão 350px e cabem em tela de 360px; o
          sexto é que não cabe, e é por isso que o Gerador tem link no cartão do painel.

          COLADA EMBAIXO, sem canto arredondado no topo. O canto redondo fazia a barra
          parecer uma folha flutuante sobre a página, e ela não é: é a moldura do app.

          FUNDO SÓLIDO em vez de `surface/80` com desfoque. Translúcida, a cor da barra
          dependia do que estivesse rolando por baixo — e num app onde a barra é a única
          referência fixa da tela, ela não pode mudar de tom conforme a página. Sai também
          o custo de pintar desfoque a cada quadro de rolagem, que em celular de entrada
          aparece como engasgo.

          A borda usa o token `border` em vez de `white/10`: cinza sem nome é cinza
          escolhido na hora, a mesma doença dos 52 cinzas anteriores à reforma. */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 w-full min-h-[84px] bg-surface border-t border-border px-1 pt-2 pb-[env(safe-area-inset-bottom,12px)] z-50 flex flex-row items-center justify-around shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {filteredMobileNav.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center min-w-[70px] pb-3 pt-1 group"
            >
              {isActive && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-1 bg-primary rounded-b-full shadow-[0_0_10px_rgb(var(--color-primary-rgb)/0.5)]" />
              )}
              <div className={`p-3 rounded-dia transition-colors duration-[120ms] ${isActive ? 'bg-primary/15 text-primary' : 'text-foreground-muted group-hover:text-foreground'}`}>
                <Icon className={`w-6 h-6 ${isActive ? 'fill-primary/20' : ''}`} />
              </div>
              <span className={`text-micro font-semibold mt-1 transition-colors duration-[120ms] ${isActive ? 'text-primary' : 'text-foreground-muted group-hover:text-foreground'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
