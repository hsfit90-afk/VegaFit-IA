# Mudanças

As datas são de quando entrou em produção. A explicação completa de cada item está na mensagem
do commit — elas foram escritas para serem lidas.

---

## 21/10/2026 — Refino visual e redesenho de três telas

Publicado em `1b25440`. 58 arquivos, 1.800 linhas a mais e 737 a menos.

### Três defeitos que estavam no ar

**As duas fontes do projeto eram baixadas e nenhuma era aplicada.**
`font-outfit` aparecia 105 vezes em 43 arquivos e a classe **nunca existiu** — no Tailwind v4
ela só é gerada a partir de um token no `@theme`, e não havia nenhum. O `<body>` usava
`font-sans`, que é a pilha do sistema, porque `--font-sans` também nunca foi apontado para a
Inter. Resultado: 9 arquivos `.woff2` pagos e não usados, e o app mudando de cara conforme o
aparelho — Segoe UI no Windows, San Francisco no iPhone, Roboto no Android.

A correção precisou de dois lados: mover as variáveis do `<body>` para o `<html>` (o `@theme`
emite em `:root`, que *é* o `<html>`) e renomeá-las de `--font-*` para `--fonte-*`, senão o
token do tema apontaria para si mesmo.

**Erro do Supabase chegava cru e em inglês na tela do aluno.**
Em 20/10 uma cliente errou a senha e leu `Invalid login credentials`. Não tinha como saber se
era a senha, a conta ou o app quebrado.

**O botão de entrar era roxo num app verde.**
Login, esqueci-a-senha e redefinir-senha usavam `--color-accent`; cadastrar usava
`--color-primary`. Telas irmãs do mesmo fluxo com cor de ação diferente — e o roxo justamente
na mais vista. O foco dos campos também era roxo, e discordava do próprio anel verde que já
estava no componente.

### O que mudou em todas as telas

| | |
|---|---|
| Tipografia | Inter no corpo, Outfit nos títulos — pela primeira vez |
| Erros | Português, dizendo o que fazer. 21 pontos, não os 17 estimados |
| Carregamento | Um só componente; o bloco copiado em 10 arquivos saiu |
| Espaçamento | De 7 valores para 3: `p-3` · `p-5` · `p-8` |
| Raio | De 6 valores para 3: `rounded-lg` · `rounded-xl` · `rounded-full` |
| Largura | `lib/layout.ts` adotado em 29 das 31 telas |
| Estados vazios | De 3 telas para 7, todas com saída |

Dois pontos escondiam coisa pior: `app/admin/page.tsx` concatenava a mensagem de erro no texto,
e `app/onboarding/page.tsx` despejava `JSON.stringify(error)` na tela de quem tinha acabado de
se cadastrar.

### O redesenho

**Dashboard.** Eram 15 cards de mesmo peso. Agora o treino de hoje ocupa a primeira dobra, com
o GIF do primeiro exercício ao fundo — são 882 exercícios com vídeo no catálogo e nenhum
aparecia na tela que mais abre. Os quatro complementos viraram uma faixa de atalhos; as quatro
métricas viraram números grandes com barra contra a meta da semana; conquistas e dica do dia
desceram para baixo da dobra.

**Treinar.** O cronômetro foi de 16px para 36px, monoespaçado e tabular. Carga e repetição
foram de 18px para 24px — é o dado mais importante do app e estava do tamanho de um rótulo. O
RIR ficou menor de propósito: é opcional. A barra de progresso passou a sangrar de ponta a
ponta, cada exercício mostra sua posição (`01 / 06`), a série da vez ganhou borda acesa, e o
botão de finalizar passou a dizer quantas séries faltam.

**Progresso.** O peso foi de 36px para 60px. O ícone numa caixa com gradiente saiu — eram 56px
de decoração. Quatro títulos de card de 20px com ícone colorido viraram etiqueta, porque numa
tela de gráficos eles competiam com os próprios gráficos. Os gráficos cresceram de 200px para
240.

### Dois erros corrigidos durante o próprio trabalho

O botão de concluir série foi para 44px (mínimo de toque) numa coluna de **40px** — a conta
para um aparelho de 360px mostrou que ele transbordava sobre o campo de RIR. Colunas
rebalanceadas.

E no cabeçalho de treinar, cronômetro e título dividiam a linha: em 360px sobravam ~200px e
"Treino C - Glúteos, Posterior e Abdômen" virava "Treino C - G…", cortado na parte que
informa. Agora empilha no celular.

### O que não foi tocado

Nada em `lib/`, `app/api/`, `middleware.ts`, `utils/supabase/` ou `database/`. Nenhuma linha de
regra, nenhuma rota, nenhuma migração. **528 testes passando** — 30 novos, do tradutor de erros.

---

## 19/10/2026 — Treinos dos alunos, mobilidade e prévia

**A lista que faltava.** `/admin/treinos` mostra todo aluno com o estado do treino — tem plano
ativo, quantos salvos, quando treinou — em ordem de atenção, não alfabética.

**Dois bugs que ela expôs.** Editar um plano gerado apagava a carga alvo e a periodização de
*todos* os exercícios: o editor devolve a sessão inteira, e campo ausente não significa "não
mudou", significa "apaga". E o seletor de exercício do montador não filtrava nada — oferecia
os 882 a quem treina na sala de casa, terceira aparição do mesmo bug.

**A mobilidade preparava a articulação errada.** A escolha casava grupo muscular com grupo
muscular, e o catálogo não tem mobilidade etiquetada "Peito" nem "Bíceps" — quem prepara o
ombro está etiquetado "Ombro". Medido: dia de peito tinha **0** candidatos e caía em
dorsiflexão plantar, mobilidade de tornozelo antes do supino. O mapa que resolve isso já
existia no app, usado só para escrever na tela. Passou a escolher. Dia de peito foi de 0 para 3
candidatos em casa, e de 1 para 8 na academia.

**A prévia do aluno** ganhou a linguagem do dashboard, com um card por dia e os verbos de
edição no lugar dos de execução.

---

## Antes disso

Ver `git log`. As mensagens de commit carregam a justificativa de cada decisão.
