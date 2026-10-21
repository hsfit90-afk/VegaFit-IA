# VegaFit — Relatório Técnico

Levantado do código em 21/10/2026, a partir do commit `d5e0b82`.
Nenhum arquivo do projeto foi alterado para produzir este documento.

**Para quem é:** quem vai mexer no visual do app sem conhecer o código. As seções 9 e 10 são
as que mais importam para esse trabalho; as anteriores existem para dar o contexto.

**Números do projeto:** 31 telas, 23 rotas de API, 29 componentes, 28 módulos de regra,
24 arquivos de teste (498 testes), 41 migrações de banco, ~23.800 linhas de TypeScript.

---

## 1. Stack

Não há separação entre front-end e back-end: é uma aplicação **Next.js** única, em que as
telas e as rotas de servidor convivem no mesmo projeto e na mesma pasta `app/`.

| Camada | O que é | Versão |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.25 |
| Interface | React | 19.3 |
| Linguagem | TypeScript, modo `strict` | 5.9.3 |
| Back-end | Route Handlers do próprio Next (`app/api/**/route.ts`) | — |
| Banco | PostgreSQL gerenciado pelo Supabase | — |
| Autenticação | Supabase Auth (`@supabase/ssr` 0.12, `supabase-js` 2.116) | — |
| Estilo | Tailwind CSS v4 | 4.3.3 |
| IA | Google Gemini (`@google/genai`) | 2.24 |
| Gráficos | Recharts | 3.10 |
| Ícones | lucide-react | 0.553 |
| Animação | motion (ex-framer-motion) | 12.23 |
| Testes | Vitest | 5.0 |
| PWA | next-pwa | 5.6 |
| Notificações | web-push (VAPID) | 3.6 |

Node com `npm`. Sem monorepo, sem Docker, sem camada de ORM — o acesso ao banco é pelo
cliente do Supabase, que fala PostgREST.

---

## 2. Estilização

### Como funciona hoje

**Tailwind CSS v4, sem arquivo de configuração.** Na v4 o tema vive dentro do próprio CSS, no
bloco `@theme`. Existe **um único arquivo de estilo no projeto inteiro**:

```
app/globals.css        148 linhas — todo o tema, utilitários e animações
```

Não há CSS por componente, nem CSS Modules, nem styled-components. Todo o visual é escrito
como classes utilitárias direto no JSX.

**Não existe biblioteca de componentes de terceiros** (nada de Material UI, shadcn, Chakra).
O que há é um conjunto próprio, pequeno, em `components/ui/` — 10 arquivos, 611 linhas no
total.

### O tema

`app/globals.css` define, dentro de `@theme`, cerca de 30 tokens de cor:

| Grupo | Tokens |
|---|---|
| Superfícies | `background` `#151718`, `surface` `#202325`, `surface-hover`, `surface-light`, `background-deep` `#0A0A0F` |
| Marca | `primary` `#05D590` (verde menta), `primary-hover`, `primary-active`, `primary-foreground` |
| Apoio | `secondary` `#0DA3A0` (turquesa), `accent` `#7C3AED` (roxo), `gold` `#FFD700` |
| Texto | `foreground` `#f5f5f7`, `foreground-muted` `#8e8e93` |
| Estado | `destructive` `#ff453a`, `success` `#32d74b`, `warning` `#ffd60a` |
| Gráficos | 6 tokens próprios (`chart-axis`, `chart-label`, `chart-weight`…) |

O app é **só escuro**. `:root { color-scheme: dark }` e nenhum bloco de tema claro. Isso é uma
decisão, não um esquecimento — mas significa que trocar para claro é trabalho real, não um
interruptor.

Há também `--color-primary-rgb` e `--color-accent-rgb` (canais separados), usados para montar
brilhos com opacidade variável: `shadow-[0_0_20px_rgb(var(--color-primary-rgb)/0.3)]`.

### Utilitários próprios

| Classe | Para quê |
|---|---|
| `.hide-scrollbar` | Esconde a barra em faixas de filtro horizontais |
| `.barra-fina` | Barra fina e translúcida; usada no menu lateral, que chega a 16 itens |
| `.glass-panel` | Vidro fosco: `backdrop-blur-2xl` + borda clara + sombra |
| `.vf-entrada` | Animação de entrada do toast e do diálogo, com `prefers-reduced-motion` respeitado |

### Onde ficam as medidas

`lib/layout.ts` centraliza largura e espaçamento em cinco constantes (`LARGURA_AUTH`,
`LARGURA_FOCO`, `LARGURA_CONTEUDO`, `PADDING_TELA`, `RODAPE_SEGURO`). Foi criado justamente
porque cada tela escolhia a própria largura. **A adoção é parcial — ver seção 10.**

---

## 3. Estrutura de pastas

```
app/                 telas e rotas de API (App Router)
  api/               23 endpoints de servidor (route.ts)
  admin/             6 telas exclusivas do master
  context/           AppContext.tsx — estado global do aluno no navegador
  auth/callback/     retorno do fluxo de autenticação
  layout.tsx         único layout; carrega fontes e provedores
  globals.css        ÚNICO arquivo de estilo do projeto
components/
  ui/                o sistema de design próprio (Button, Card, Input, Toast…)
  workout/           blocos do treino (aquecimento, abdominal, cronômetro, mídia)
  charts/            gráficos de progresso (Recharts)
  admin/             componentes só do montador
  (raiz)             Navigation, ClientLayout, InstallPrompt, cards diversos
lib/                 REGRA DE NEGÓCIO em funções puras — sem banco, sem rede
  db/                acesso a tabela (exercises.ts)
hooks/               cronômetro, descanso, persistência do treino em andamento
utils/
  supabase/          clientes (browser, server, middleware) e guardas de acesso
  (raiz)             rate-limit da IA, push, cache do treino, cálculo de carga
database/            41 migrações SQL numeradas, rodadas à mão no Supabase
tests/               24 arquivos, 498 testes — cobrem lib/ e utils/
scripts/             classificarEquipamento.mjs (classificação offline do catálogo)
worker/              index.js — handler de push do service worker
public/              manifest.json, sw.js, ícones, imagens de medidas
middleware.ts        renova a sessão e barra rota privada sem login
```

**A regra mais importante da arquitetura:** tudo em `lib/` é função pura, sem banco e sem rede.
É o que permite testar, e o que impede a mesma decisão de divergir entre o servidor e a tela.
Mexer no visual não deve encostar em `lib/`.

---

## 4. Telas

### Do aluno (20)

| Rota | Arquivo | O que faz |
|---|---|---|
| `/` | `app/page.tsx` | Dashboard. Treino ativo, próximo dia, atalhos, conquistas, dica do dia |
| `/generator` | `app/generator/page.tsx` | Gerador por IA: configuração e geração do plano |
| `/active` | `app/active/page.tsx` | Executar o treino. **Maior arquivo do projeto (1.291 linhas)** |
| `/progression` | `app/progression/page.tsx` | Check-in de progressão de carga |
| `/history` | `app/history/page.tsx` | Histórico de treinos feitos |
| `/progress` | `app/progress/page.tsx` | Gráficos: volume, peso corporal, evolução |
| `/personalizado` | `app/personalizado/page.tsx` | Treino do Personal: oferta, vagas e pedido |
| `/cardio` | `app/cardio/page.tsx` | Aeróbico |
| `/abdominal` | `app/abdominal/page.tsx` | Abdominal avulso |
| `/mobilidade` | `app/mobilidade/page.tsx` | Mobilidade, com as articulações do dia no topo |
| `/alongamento` | `app/alongamento/page.tsx` | Alongamento livre |
| `/anamnese` | `app/anamnese/page.tsx` | Anamnese guiada por passos |
| `/anamnese/history` | `app/anamnese/history/page.tsx` | Anamneses anteriores |
| `/settings` | `app/settings/page.tsx` | Perfil e preferências |
| `/assinar` | `app/assinar/page.tsx` | Planos e checkout |
| `/assinar/retorno` | `app/assinar/retorno/page.tsx` | Volta do Mercado Pago |
| `/onboarding` | `app/onboarding/page.tsx` | Primeiros passos após o cadastro |
| `/login` `/register` | — | Entrada e cadastro |
| `/forgot-password` `/reset-password` | — | Recuperação de senha |
| `/privacy` | `app/privacy/page.tsx` | Política de privacidade. **Rota pública** |

### Do master (8)

Escondidas por `somenteMaster` em `components/Navigation.tsx`. O cliente não acessa nenhuma.

| Rota | O que faz |
|---|---|
| `/admin` | Painel: alunos, assinaturas, fila do Treino do Personal |
| `/admin/treinos` | Lista de alunos com estado do treino, busca, ordem por urgência |
| `/admin/montar` | Montador manual. 2º maior arquivo (1.017 linhas) |
| `/admin/preview` | O treino do aluno como ele vê, um card por dia |
| `/admin/exercicios` | Favoritos e banidos por aluno |
| `/admin/equipamentos` | Revisão do catálogo: Casa / Academia / Ambos |
| `/library` | Catálogo de exercícios (cadastro, mídia, grupo) |
| `/nutrition` `/coach` | Nutrição IA e chat com IA |

### Rotas de API (23)

`/api/treino` (gera o plano) · `/api/swap` (troca exercício) · `/api/progression` ·
`/api/nutrition` · `/api/coach-chat` · `/api/daily-tip` · `/api/personalizado` ·
`/api/checkout` · `/api/webhooks/mercadopago` · `/api/assinatura/sincronizar` ·
`/api/push/subscribe` · `/api/push/unsubscribe` · `/api/cron/send-reminders` ·
`/api/account/delete` · e 9 rotas sob `/api/admin/` (plano, aluno, alunos, catalogo,
exercicios, equipamentos, modelos, personalizado, assinatura).

---

## 5. Componentes reutilizáveis

### O sistema de design (`components/ui/`)

| Componente | Linhas | O que oferece |
|---|---|---|
| `Button.tsx` | 47 | 5 variantes (`default`, `outline`, `ghost`, `secondary`, `danger`) e 4 tamanhos. Anima no toque |
| `Card.tsx` | 69 | 3 variantes (`default`, `glass`, `neon-hover`) + `CardHeader`, `CardContent`, `CardTitle`, `CardDescription` |
| `Input.tsx` | 42 | Campo de texto padrão |
| `Field.tsx` | 57 | Campo com rótulo e erro |
| `Toast.tsx` | 109 | Avisos flutuantes: `sucesso`, `erro`, `aviso`, `info`. Usado via `useToast()` |
| `ConfirmDialog.tsx` | 162 | Confirmação. No celular entra como bottom sheet |
| `EmptyState.tsx` | 43 | Estado vazio com ícone e ação |
| `LoadingSpinner.tsx` | 44 | Carregando, com rótulo acessível |
| `Skeleton.tsx` | 5 | Esqueleto de carregamento |
| `PageHeader.tsx` | 33 | Cabeçalho de tela |

### Específicos de domínio

| Pasta | Componentes |
|---|---|
| `components/workout/` | `BlocoAquecimento`, `BlocoAbdominal`, `BlocoAlongamento`, `ListaComCronometro`, `RestTimerOverlay`, `VisualizadorDeMidia`, `PeriodizationResetNotice` |
| `components/charts/` | `ProgressCharts`, `VolumeHistoryChart`, `ChartSkeleton` |
| `components/admin/` | `EditorDePreparo` (aquecimento/abdominal/alongamento no montador) |
| Raiz | `Navigation` (menu lateral no desktop, barra inferior no celular), `ClientLayout`, `InstallPrompt`, `AvisoDeAssinatura`, `CardPersonalizado`, `FilaPersonalizado`, `MinhaAcademia`, `AtivarLembretes` |

**Não existem** componentes de tabela nem de modal genérico. As tabelas são `<table>` escritas
à mão (em `/admin`), e o único diálogo é o `ConfirmDialog`.

---

## 6. Fluxo do usuário

```
cadastro (/register)
   ↓
onboarding (/onboarding)
   ↓
anamnese (/anamnese)  ← objetivo, nível, local, dias, tempo, lesões, equipamentos de casa
   ↓                     + um campo livre OBRIGATÓRIO de limitações/intenção
dashboard (/)
   ↓
gerar treino (/generator) → POST /api/treino
   ↓                          lê perfil/banidos/local DO BANCO,
   ↓                          filtra o catálogo EM CÓDIGO,
   ↓                          só então monta o prompt do Gemini
treinar (/active)
   ↓  vídeo de cada exercício, cronômetro de descanso,
   ↓  registro de carga e repetições, troca de exercício (/api/swap)
   ↓
concluir → grava em workout_history → avança o rodízio A-B-C
   ↓
check-in (/progression) → sugestão de progressão de carga
   ↓
progresso (/progress), histórico (/history)
```

Em paralelo, fora do rodízio: aeróbico, abdominal (dias alternados), mobilidade e alongamento.

**Acesso:** `middleware.ts` roda em toda rota não-estática, renova a sessão e manda para
`/login` quem não tem login. Rotas públicas: `/login`, `/register`, `/forgot-password`,
`/reset-password`, `/auth/callback`, `/privacy`, `/api/cron/*`, `/api/webhooks/*`.

**Assinatura:** 7 dias de teste, depois R$ 37/mês ou R$ 297/ano. Estados: `cortesia`,
`trial`, `ativo`, `vencido`, `cancelado`. Rota de IA sem acesso responde **402**, não 403.

---

## 7. Integrações externas

| Serviço | Para quê | Como |
|---|---|---|
| **Supabase** | Banco, autenticação, storage | `@supabase/ssr` no navegador e no servidor; `service_role` nas rotas de admin, que ignora RLS |
| **Google Gemini** | Geração de treino, nutrição, chat, dica | `@google/genai`. Modelo `gemini-3.5-flash-lite` + 6 reservas; orçamento de 40s, teto de 25s por tentativa |
| **Mercado Pago** | Assinatura recorrente (`preapproval`) | `fetch` direto na API, sem SDK (`lib/mercadopago.ts`). Webhook validado por HMAC |
| **Web Push (VAPID)** | Lembrete diário de treino | `web-push` + `worker/index.js`; cron da Vercel às 22h UTC |
| **Cloudflare R2** | Vídeos dos exercícios | URLs públicas em `exercises.media_url`; todos `.mp4` |
| **Google Fonts** | Inter e Outfit | `next/font/google` — **ver o achado na seção 10** |

**E-mail:** não há serviço próprio. Recuperação de senha depende do SMTP do Supabase.

**Variáveis de ambiente (16):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `AI_TPM_LIMIT`, `AI_MAX_QUEUE_WAIT_MS`,
`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `COBRANCA_ATIVA`,
`VAGAS_PERSONALIZADO`, `WHATSAPP_PROFISSIONAL`, `CRON_SECRET`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NODE_ENV`.

---

## 8. Hospedagem e deploy

- **Vercel**, conectada ao repositório `hsfit90-afk/VegaFit-IA`.
- **Push na branch `main` publica em produção.** Não há staging, não há aprovação manual.
- Endereço: `https://vega-fit-ia.vercel.app`
- `vercel.json` define um cron: `/api/cron/send-reminders`, todo dia às 22:00 UTC.
- `next.config.ts` aplica `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` e
  `Permissions-Policy` bloqueando câmera, microfone e localização.
- O PWA é gerado no build (`next-pwa`), desligado em desenvolvimento.
- **Migrações de banco NÃO são automáticas.** Cada arquivo de `database/` é colado à mão no
  SQL Editor do Supabase. A próxima é a `42`.
- Comandos: `npm run dev`, `npm run build`, `npm test`, `npm run lint`.

---

## 9. O que NÃO pode ser alterado ao mexer no visual

### Intocável

**`lib/` inteiro.** São 28 módulos de regra pura — protocolo de séries e repetições,
periodização de 4 semanas, progressão de nível, desbloqueio de métodos, filtro de equipamento,
escolha de mobilidade por articulação, estado de assinatura. Mudar visual nunca precisa entrar
aqui. Os 498 testes cobrem exatamente isso.

**`app/api/**`.** As 23 rotas decidem prescrição e dinheiro. Em especial:
- `/api/treino` e `/api/swap` filtram o catálogo **em código** antes do prompt. Essa ordem é a
  correção de três bugs distintos; inverter reintroduz todos.
- `/api/webhooks/mercadopago` valida HMAC. Qualquer mudança quebra a cobrança.
- Rotas `/api/admin/*` respondem **404** para quem não é master, não 403. É deliberado:
  confirmar que a rota existe já entrega informação a quem sonda.

**`middleware.ts` e `utils/supabase/`.** Sessão e guardas de acesso.

**`database/`.** Arquivos já rodados em produção não se editam. Migração nova é arquivo novo
com o próximo número.

### Cuidado redobrado

| Onde | Por quê |
|---|---|
| `app/active/page.tsx` | Registra carga e repetições do aluno e grava o histórico. É a tela que gera o dado de progressão |
| `app/context/AppContext.tsx` | Estado global. Um `upsert` errado aqui apaga favoritos ou banidos do perfil |
| `utils/workoutCache.ts` | Guarda o treino em andamento no `localStorage`. Mexer pode fazer o aluno perder séries no meio da sessão |
| `components/workout/*` | Têm regra dentro (dias alternados do abdominal, filtro de equipamento da mobilidade) |

### Armadilhas conhecidas do repositório

1. **Classe Tailwind montada por concatenação não funciona.** `border-${cor}/25` não gera CSS —
   o Tailwind lê o código como texto. Passe a classe inteira como propriedade.
2. **Token que não existe no `@theme` não vira classe.** Já aconteceu com `accent`, usado em 27
   lugares antes de o token existir. Os elementos ficavam sem cor, herdando a do pai, e
   ninguém percebia. **Está acontecendo de novo com a tipografia — seção 10.**
3. **Fim de linha misto (CRLF e LF).** Edição por regex em arquivo inteiro corrompe. Use edição
   ancorada em linha.
4. **Comentário JSX (`{/* */}`) quebra o build** dentro de um braço de ternário ou logo depois
   de `return (`.
5. **Nunca comitar `.github/workflows/`** — o token atual não tem permissão e o push é recusado.

---

## 10. Diagnóstico visual

O app **não** parece mal cuidado por falta de critério — o tema tem 30 tokens bem escolhidos, a
acessibilidade é razoável (49 `aria-label`, só 2 casos de foco removido sem substituto), e há um
sistema de componentes próprio. O problema é **adoção**: o sistema existe e é contornado.

### Achado principal: nenhuma das duas fontes está sendo aplicada

`app/layout.tsx` carrega **Inter** e **Outfit** pelo `next/font/google`. O `<body>` recebe as
variáveis `--font-inter` e `--font-outfit`, e 43 arquivos usam a classe `font-outfit` — **105
ocorrências**, em praticamente todo título do app.

Conferi o CSS compilado:

```
.font-outfit          NÃO EXISTE no CSS gerado
.font-sans            → var(--font-sans)
--font-sans           → -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...
```

Duas coisas, somadas:

1. `font-outfit` não gera nada, porque **não há `--font-outfit` no bloco `@theme`**. É
   exatamente a armadilha nº 2 acima, repetida.
2. O `<body>` usa `font-sans`, que no Tailwind v4 é a **pilha do sistema**, não Inter — porque
   `--font-sans` também nunca foi redefinido para `var(--font-inter)`.

**Resultado:** os 9 arquivos de fonte são baixados e nenhum é usado. O app inteiro renderiza na
fonte padrão do sistema operacional — Segoe UI no Windows, San Francisco no iPhone, Roboto no
Android. A hierarquia tipográfica que o código descreve não existe na tela, e o app muda de
cara conforme o aparelho.

É o maior responsável pelo ar de "modo desenvolvedor", e o conserto são duas linhas.

### Os outros sintomas, medidos

| Sintoma | Medição |
|---|---|
| **Botões fora do sistema** | 86 `<button>` cru nas telas contra 15 telas que importam `<Button>` |
| **Carregamento sem padrão** | 19 telas com `Loader2` próprio; **1** usa o `LoadingSpinner` compartilhado. O mesmo bloco `min-h-[60vh] flex items-center justify-center` está copiado em 11 telas |
| **Estado vazio quase ausente** | `EmptyState` existe e é usado em **3 telas de 31** |
| **Esqueleto quase ausente** | `Skeleton` usado em 2 telas |
| **Larguras à mão** | 11 telas usam `lib/layout.ts`; **19 definem `max-w-` direto**, em 6 valores diferentes (`md`, `3xl`, `5xl`, `sm`, `lg`, `2xl`) |
| **Espaçamento sem escala** | `p-4` (52×), `p-3` (44×), `p-6` (26×), `p-2` (20×), `p-5` (19×), `p-8` (10×) — seis valores concorrentes |
| **Raio de borda sem escala** | `rounded-xl` (157×), `rounded-full` (73×), `rounded-lg` (52×), `rounded-2xl` (43×), `rounded-md` (16×), `rounded-3xl` (12×) |
| **Erro cru do backend na tela** | 17 lugares fazem `setError(error.message)`. Inclui as 4 telas de autenticação — é assim que um aluno lê **"Invalid login credentials"**, em inglês |

### As 5 melhorias de maior impacto

**1. Fazer as fontes funcionarem.** Acrescentar ao `@theme` de `app/globals.css`:

```css
--font-sans: var(--font-inter);
--font-outfit: var(--font-outfit-raw);  /* ou expor a variável do next/font */
```

Duas linhas devolvem a tipografia que o projeto já paga para baixar. É a mudança com a maior
diferença visual por linha escrita em todo o app, e some com a variação entre aparelhos.

**2. Traduzir e humanizar as mensagens de erro.** Trocar os 17 `error.message` por um tradutor
que mapeie os erros conhecidos do Supabase e do Mercado Pago para português, dizendo o que
fazer. "Invalid login credentials" vira *"E-mail ou senha incorretos. Se não lembra a senha, use
'Esqueceu sua senha?' logo abaixo."* Custo baixo, e é o ponto em que o app hoje parece quebrado
para quem não é técnico.

**3. Um só estado de carregamento.** Substituir os 19 `Loader2` soltos pelo `LoadingSpinner`, e
nas telas de lista (histórico, progresso, biblioteca, treinos dos alunos) trocar o spinner por
`Skeleton` com a forma do conteúdo. Spinner centralizado em tela cheia é a assinatura visual de
protótipo; esqueleto com a silhueta certa é a de produto.

**4. Fechar a escala de espaçamento e de raio.** Reduzir os seis paddings a três
(`p-3` compacto, `p-5` padrão, `p-8` destaque) e os seis raios a três (`rounded-lg` controles,
`rounded-xl` cartões, `rounded-full` pílulas). E adotar `lib/layout.ts` nas 19 telas que ainda
escolhem a própria largura — o módulo já existe exatamente para isso, com a explicação de por
que foi criado.

**5. Estado vazio em toda lista.** `EmptyState` já existe e cobre 3 telas. Faltam histórico,
progresso, anamneses anteriores, modelos do montador, pedidos do Personal. Hoje essas telas
ficam simplesmente em branco quando não há dado — e tela em branco é indistinguível de tela
quebrada para quem está usando.

### Uma ressalva sobre ordem

As cinco acima são seguras: nenhuma encosta em `lib/`, em `app/api/` ou no banco. Mas a
primeira muda o tamanho aparente de **todo texto do app** de uma vez — a fonte do sistema e a
Outfit têm métricas diferentes. Depois de aplicá-la, vale repassar as telas mais densas
(`/active`, `/admin/montar`) antes de mexer em qualquer outra coisa.
