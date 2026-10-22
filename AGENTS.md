# Regras para quem mexer neste código

Vale para qualquer IA e para qualquer pessoa. Foi escrito depois de cair em cada uma das
armadilhas listadas aqui — todas são reincidentes, nenhuma é teórica.

Última verificação contra o código: **22/10/2026**, commit `5a0be34`.

---

## A stack, em uma tela

Next.js 15.5 (App Router) · React 19.3 · TypeScript strict · Tailwind v4 · Vitest
Supabase (Postgres + Auth + RLS) · Google Gemini · Mercado Pago · Vercel

Não há separação front/back: as telas e as rotas de servidor vivem juntas em `app/`.

| | |
|---|---|
| Telas | 31 |
| Rotas de API | 23 |
| Componentes | 29 |
| Módulos de regra em `lib/` | 29 |
| Testes | **551**, em 26 arquivos |
| Migrações | 41 (a próxima é a **42**) |
| Linhas de TypeScript | ~24.200 |

---

## O que não se toca sem o profissional aprovar

**`lib/`** — 29 módulos de regra pura, sem banco e sem rede. Protocolo de séries, periodização
de 4 semanas, progressão de nível, desbloqueio de métodos, filtro de equipamento, escolha de
mobilidade por articulação, estado de assinatura. Os 551 testes cobrem exatamente isso. Mudar
visual nunca precisa entrar aqui.

**`app/api/`** — as 23 rotas decidem prescrição e dinheiro.

**`middleware.ts`** e **`utils/supabase/`** — sessão e guardas de acesso.

**`database/`** — arquivo já rodado em produção não se edita. Migração nova é arquivo novo com
o próximo número. **Nunca executar SQL no banco: só propor o arquivo.**

### Cuidado redobrado — só classe visual, nunca lógica

| Arquivo | Por quê |
|---|---|
| `app/active/page.tsx` | Registra carga e repetição do aluno e grava o histórico |
| `app/context/AppContext.tsx` | Estado global; um upsert errado apaga favoritos ou banidos |
| `utils/workoutCache.ts` | Guarda o treino em andamento; mexer faz o aluno perder séries |
| `components/workout/*` | Têm regra dentro (abdominal em dias alternados, filtro de equipamento) |

---

## As seis armadilhas deste repositório

Todas já morderam. Em ordem de frequência.

**1. Classe Tailwind montada por concatenação não existe.**
`border-${cor}/25` não gera CSS — o Tailwind lê o código como texto e não executa nada. Passe
a classe inteira como propriedade.

**2. Token que não está no `@theme` não vira classe.**
Aconteceu com a cor `accent`, usada em 27 lugares antes do token existir: os elementos ficavam
sem cor, herdando do pai. Aconteceu de novo com a tipografia — `font-outfit` era usado 105
vezes em 43 arquivos e **nunca existiu**, então o app inteiro rodava na fonte do sistema
operacional enquanto baixava 9 arquivos de fonte que ninguém usava.

Nada quebra, nada avisa. Se você usar um token novo, **declare em `app/globals.css` e confira
no CSS compilado**.

**3. Fim de linha misturado (CRLF e LF).**
Edição por regex sobre o arquivo inteiro corrompe. Use edição ancorada em trecho exato, ou
script que detecte e devolva o fim de linha original.

**4. Comentário JSX quebra o build em dois lugares.**
`{/* */}` dentro de um braço de ternário, logo depois de `return (`, ou **entre atributos de
uma tag**. Para comentar uma propriedade, use `/* */` ou escreva acima do componente.

**5. `.github/workflows/` nunca entra em commit.**
O token atual não tem permissão de `workflow` e o push inteiro é recusado por causa dele.

**6. Arquivo novo em `public/` precisa da extensão dele no matcher do `middleware.ts`.**
O matcher isenta estático por extensão (`svg png jpg jpeg gif webp mp3`) e por padrão de nome
(`manifest.json`, `sw.js`, `workbox-*.js`, `worker-*.js`). O que não estiver ali responde
**307 para `/login`**.

Já mordeu três vezes. Em 08/10/2026, `manifest.json` e `sw.js` — o PWA não instalava. Em
22/10/2026, descobriu-se que aquela correção era metade: o `sw.js` faz `importScripts` de
`worker-<hash>.js`, que continuava em 307, e `importScripts` que falha derruba a instalação
inteira. Na mesma tarefa, um `.mp3` novo caiu na mesma armadilha.

**Por que escapa sempre:** o 307 não quebra nada na hora, não aparece em `tsc`, `lint`, teste
nem build, e o usuário logado recebe 200 porque manda o cookie. O estrago aparece semanas
depois, como "o app não instala". A única verificação que pega é pedir o arquivo em produção
**sem estar logado**:

```
curl -sS -o /dev/null -w "%{http_code}\n" https://vega-fit-ia.vercel.app/seu-arquivo.ext
```

### Fora do código, mas reincidente

**Nunca rodar `npm run build` com o `npm run dev` no ar.** Os dois escrevem em `.next` e o
build corrompe o cache de quem está servindo — a tela fica branca e parece bug de código.

**No Windows, `lsof` falha em silêncio.** Ele não mata o processo nem acusa erro; o Next sobe
em outra porta sem avisar. Mate pelo PID com PowerShell:
`Get-NetTCPConnection -LocalPort 3000 -State Listen | Stop-Process -Id $_.OwningProcess -Force`

---

## Decisões do produto que parecem bug e não são

- **O app é só escuro.** `:root { color-scheme: dark }` e nenhum bloco de tema claro.
- **Rota `/api/admin/*` responde 404 para quem não é master**, não 403. Confirmar que a rota
  existe já entrega informação a quem está sondando.
- **Rota de IA sem assinatura responde 402**, não 403. O cliente precisa distinguir "vá pagar"
  de "sem permissão", e os dois levam a telas diferentes.
- **O aluno tem um treino ativo por vez**, de propósito. Mas carga registrada e exercício
  favorito nunca podem ser perdidos.
- **Restrição se resolve em CÓDIGO, antes do prompt.** Equipamento, local, exercício banido e
  nível são filtrados antes de a IA ver qualquer coisa. Pedir para a IA "respeitar" falha — já
  falhou três vezes, em lugares diferentes.

---

## Como trabalhar

**Meça, não deduza.** Antes de acrescentar palavra-chave a um filtro, conte quantos itens ela
pega e quantos pega por engano. Uma vez `frontal` pegou 17 errados para acertar 6.

**Confirme uma linha de base diferente de zero.** Filtro que devolve zero parece correto e
não é.

**Nunca confie em perfil ou configuração vindos do corpo da requisição** para decidir segurança
ou prescrição. Leia do banco com `service_role`, usando o id do aluno.

**Regra nova em `lib/` vem com teste em `tests/`.**

**Nunca usar chave real de produção** (`service_role`, Mercado Pago) fora do servidor.

### O ritual, antes de entregar

```
npx tsc --noEmit      # 0 erros
npm run lint          # 0 erros
npm test              # 551 passando
npm run build         # compila
```

Branch sempre. Commit pequeno. **Nunca push na `main` sem pedir** — `main` publica em produção.

### Quando parar e perguntar

Se a tarefa exigir tocar área proibida, se algo for ambíguo, ou se a correção certa mudar o que
o aluno vê. Mudança de prescrição é decisão do profissional, não efeito colateral.

### O que toda entrega diz

O que mudou · arquivos tocados · resultado de lint, teste e build · o que ficou de fora e por
quê · riscos.

Relatar com honestidade: se um teste falhou, mostre a saída. Se um passo foi pulado, diga.

---

## Onde as coisas estão

```
app/                telas e rotas de API
  api/              23 endpoints (route.ts)
  admin/            6 telas exclusivas do master
  context/          AppContext.tsx — estado global do aluno
  globals.css       ÚNICO arquivo de estilo do projeto
lib/                REGRA DE NEGÓCIO em funções puras
components/ui/      o sistema de design próprio
components/workout/ blocos do treino (têm regra dentro)
hooks/              cronômetro, descanso, persistência do treino
utils/              supabase, rate-limit, push, cache, mensagens de erro
database/           41 migrações numeradas, rodadas à mão no Supabase
tests/              551 testes sobre lib/ e utils/
```

O tema vive em `@theme`, dentro de `app/globals.css`. Não há `tailwind.config` — é Tailwind v4.
