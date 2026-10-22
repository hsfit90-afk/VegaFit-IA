# Mudanças

As datas são de quando entrou em produção. A explicação completa de cada item está na mensagem
do commit — elas foram escritas para serem lidas.

---

## 22/10/2026 — Os métodos de treino, medidos contra a evidência

O profissional levantou uma revisão de literatura dos seis métodos e trouxe para o app. O
achado que atravessa tudo: **com volume equivalente, nenhum dos seis supera o tradicional**
para hipertrofia ou força. Eles se justificam por tempo, fadiga e objetivo — nunca por prometer
mais músculo. Os seis cartões do seletor foram conferidos: todos são descrição factual, nenhum
promete ganho. Não havia nada a desmentir.

### Superset e Circuito eram só rótulo

Pirâmide, Rest-Pause e Drop Set ganharam estrutura no dado em 27/09/2026. Estes dois ficaram de
fora porque **não havia onde gravar o par**. O prompt pedia "certifique-se de parear exercícios
coerentes", e o par existia só na cabeça do modelo: sumia no salvamento. Quem esperou três meses
pelo Superset recebia uma lista igual à do tradicional.

Era a quarta vez no projeto que uma regra pedida só no prompt não chegou ao aluno.

Agora a IA **ordena** a sessão — isso é prescrição — e o código **monta** o bloco a partir dessa
ordem, garantindo a estrutura. Se a IA ordenar mal, sai um par do mesmo músculo, que não é erro:
é um bi-set, e a tela avisa que a carga tende a cair. A falha é suave de propósito.

Reordenar por conta própria foi descartado: moveria um composto pesado para o fim da sessão,
trocando um problema pequeno por um grande.

### O teto que faltava desde 28/09

Medido em 27/09/2026: a IA aplicou drop set em **21 de 21 exercícios**. Ficou como suspeita a
confirmar, e a decisão de fixar os protocolos em código nunca saiu do papel porque os números
não existiam. A revisão responde: drop set e rest-pause elevam esforço percebido, lactato e
fadiga, e devem ficar em poucos exercícios por sessão.

O teto ficou em **um exercício intensificado por grupo muscular do dia**, decisão do
profissional. Por grupo, não por sessão, porque escala com o tamanho do treino.

Ele escolhe entre os exercícios que **já têm** a técnica, não o último do grupo em absoluto: se
a IA marcou só o primeiro, mirar no último deixaria a sessão sem técnica nenhuma — o aluno que
pediu Drop Set receberia treino tradicional, que é o defeito que a regra existe para evitar.

### Três números já estavam certos

| | Código | Evidência |
|---|---|---|
| Queda do drop | 20% | 20 a 25% |
| Descanso antes do drop | 0 s | sem descanso |
| Microdescanso do rest-pause | 15 s | 10 a 20 s |

Não foram mexidos. O código não estava errado — estava incompleto.

### O rest-pause inflava o volume semanal

O gráfico contava toda série concluída, então "S1 · RP1 · RP2" entrava como 3 séries. As
retomadas são continuação da mesma: o aluno não largou o peso. Drop set continua contando tudo,
de propósito — cada queda é série de trabalho com carga menor.

Repetição e tonelagem não mudaram, que é o que a revisão pede. São duas perguntas diferentes
sobre o mesmo treino: quantas séries, e quanto trabalho.

### O local que o app descartava em silêncio

O seletor do gerador deixava escolher "Academia completa" e o servidor descartava sem avisar,
porque a anamnese dizia "Em casa" — e o perfil ganha do corpo da requisição, para que ninguém na
sala receba Leg Press. O profissional testou, recebeu peso livre e concluiu que o app tinha
ignorado o que ele preencheu.

A trava não foi afrouxada. A escolha agora chega à **fonte da verdade**: trocar o local pergunta
se é para atualizar o perfil, e aí não sobra contradição para o servidor resolver. Escreve só a
coluna `training_location`, como `banExerciseForUser` — o upsert grande já apagou listas uma vez.

### Nenhum número novo foi inventado

As estações do circuito são os exercícios do dia, cuja quantidade já saía do nível e da duração
(3 a 8). As voltas são as séries do protocolo: 3 na semana 1, +1 por semana. O circuito herdou a
periodização que o resto do app já tinha, em vez de criar um segundo lugar para envelhecer.

Ombro ficou sem antagonista, com teste: a oposição do deltoide é entre porções do próprio
músculo, não entre grupos do catálogo. Inventar um par seria dizer da evidência o que ela não
diz.

### Dois erros meus, registrados

Eu disse que o cronômetro do bloco precisaria ser construído. **Já funcionava** desde que
superset e circuito ganharam mecânica. E eu criei duas regras para a mesma coisa — a tela
pareando por paridade, o servidor gravando o campo. Concordavam, e era esse o risco. Agora é
uma só.

Percebi o segundo escrevendo um comentário que prometia o que o código não fazia.

---


## 22/10/2026 — O service worker nunca instalou

Publicado em `5a0be34`. Achado por acidente, ao conferir se o som novo tinha subido.

O matcher do `middleware.ts` isenta estático por extensão e por nome. Em 08/10 `manifest.json`
e `sw.js` entraram na lista, depois de os dois responderem 307 e o PWA não instalar. **Aquela
correção era metade.**

O `sw.js` faz `importScripts` de dois arquivos que o next-pwa gera ao lado dele, e nenhum dos
dois estava isento. Medido em produção, antes:

| | |
|---|---|
| `sw.js` | 200 |
| `manifest.json` | 200 |
| `workbox-4754cb34.js` | **307 → /login** |
| `worker-WDW1zc-m-pa1ZsGf39oT8.js` | **307 → /login** |

E o `sw.js` em produção continha, literalmente, `importScripts("worker-WDW1zc-m-pa1ZsGf39oT8.js")`.
`importScripts` que falha derruba a instalação inteira do service worker — então o PWA seguiu
sem instalar depois de 08/10, só que com o sintoma escondido: quem olhasse `sw.js` via 200.

Os dois agora entram por padrão, não por nome, porque o hash muda a cada build. Depois da
correção, os seis estáticos respondem 200 — inclusive o `worker-NoySyDbzGmLAifFNyos2s.js`, cujo
hash mudou neste build, o que prova que o padrão pega hash novo. `/active`, `/progress`,
`/admin/treinos` e `/api/admin/alunos` continuam em 307 para `/login`.

**O `.mp3` entrou junto, e esse defeito foi meu.** O som do descanso tinha acabado de sair do
CDN do Mixkit para `public/sons/descanso.mp3`, e `mp3` não estava na lista. Das 104 entradas do
precache, 98 são `_next/` e as outras seis eram `.png` ou o manifest — todas isentas. A minha
era a única entrada do precache que o middleware interceptava. Li o comentário de 08/10 nessa
mesma tarefa e repeti o erro assim mesmo: pensei no som, não no service worker.

Virou a sexta armadilha do `AGENTS.md`, com o comando que a detecta — pedir o arquivo em
produção **sem estar logado**. É a única verificação que pega: o 307 não aparece em `tsc`,
`lint`, teste nem build, e o usuário logado recebe 200 porque manda o cookie.

---

## 22/10/2026 — Auditoria de LGPD: dois vazamentos e um comprovante falho

Auditoria em `AUDITORIA-LGPD.md`. Nove lacunas levantadas, três fechadas aqui — as outras
seis dependem de dado que o código não tem (razão social, e-mail de contato) ou de decisão
do profissional (idade mínima, Termo de Uso).

### Dois terceiros recebiam dado do aluno sem estar declarados

Nenhum dos dois foi deduzido: apareceram ao listar os domínios externos que o código chama.

**O player do YouTube rastreava antes do play.** Exercício sem mídia própria abre um `<iframe>`
de `youtube.com/embed` — e nesse domínio o Google grava cookie de rastreio assim que o player
carrega, dê a pessoa play ou não. Virou `youtube-nocookie.com/embed`: mesmo vídeo, cookie só se
houver play.

**O som do descanso vinha de um CDN alheio, a cada treino.** `assets.mixkit.co` recebia o IP do
aluno toda vez que um treino começava. O arquivo passou para `public/sons/descanso.mp3`. Além
da privacidade, tirou uma dependência boba: se o Mixkit saísse do ar, o aluno treinava sem
aviso de descanso e ninguém descobriria o motivo.

### O comprovante de exclusão conferia 9 tabelas de 11

A rota de excluir conta não apaga tabela por tabela — quem apaga é o `ON DELETE CASCADE`. A
lista de `app/api/account/delete/route.ts` serve a uma etapa que roda **depois** e conta se
sobrou linha, para a exclusão ser verificável em vez de "melhor esforço".

`treino_personalizado_pedidos` nunca esteve nessa lista, desde a migração 35. O dado **era**
apagado — a cascata está lá. O que faltava era o alarme: com a cascata quebrada por uma
migração futura, a verificação varreria as outras nove, não acharia nada e registraria
"resíduo: nenhum". Um comprovante de exclusão afirmando que está tudo limpo.

De quebra, o comentário do topo do arquivo dizia "9 tabelas" desde antes de existirem 11.

### A política ganhou o que faltava

Seção 5: Vercel, Mercado Pago, YouTube, Mixkit e o serviço de push do navegador. Está dito que
dados de cartão nunca passam pelos servidores do VegaFit — o que o Mercado Pago recebe é o
e-mail e um identificador interno.

Seção 7: o Art. 20. Treino, carga e progressão são decisão automatizada, e o aluno tem direito
a pedir revisão por uma pessoa. No VegaFit quem revisa é o profissional com CREF; a política
não dizia.

### O que não foi corrigido, e é o mais grave

A política continua no ar com `[RAZÃO SOCIAL]` e `[E-MAIL DE CONTATO]` por preencher. O e-mail
aparece justamente onde ela explica como exercer os direitos do titular — ou seja, hoje não há
canal. São dados reais, que ninguém inventa pelo dono.

E a política promete 18 anos enquanto o seletor de idade do onboarding
(`app/onboarding/page.tsx:318`) tem piso **14**. Não é ausência de regra: é uma regra escrita
que contradiz o documento publicado. A anamnese, onde entra o dado de saúde, aceita qualquer
número. Qual dos dois vale é decisão do profissional, não efeito colateral de uma auditoria.

### Um erro meu, registrado

A primeira versão da auditoria listava **Cloudflare R2** como operador. Não existe: zero
referências no código. A mídia está no Supabase Storage, que já era declarado. Afirmei sem
medir — o que o `AGENTS.md` manda não fazer. Foi ao conferir que apareceram o YouTube e o
Mixkit, que eram achados de verdade.

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
