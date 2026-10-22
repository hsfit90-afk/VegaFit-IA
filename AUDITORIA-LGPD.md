# Auditoria de LGPD — VegaFit

Levantada do código em **22/10/2026**, commit `dfcde67`.

**Isto não é parecer jurídico.** É o levantamento técnico do que o app faz com dado pessoal,
comparado ao que a política publicada promete. Os itens marcados como jurídicos precisam de um
advogado; os demais são correções de código ou de texto que eu posso fazer.

---

## O que já está certo

Vale começar por aqui, porque é mais do que o relatório anterior dava a entender.

**O consentimento para dado de saúde existe e é explícito.** A anamnese não salva sem a caixa
marcada, e a aceitação fica gravada com data e hora em `profiles.consent_accepted_at`. É o que
o Art. 11 pede para dado sensível.

**A transferência internacional está declarada.** A política diz, com todas as letras, que o
processamento pela API Gemini ocorre fora do Brasil e cita os arts. 33 a 36.

**O que vai para a IA está descrito item a item** — objetivo, nível, equipamentos, lesões,
condições médicas, medicamentos contínuos e restrições alimentares. Poucos apps fazem isso.

**A exclusão de conta funciona de verdade.** Apaga os arquivos do storage primeiro (porque
`storage.objects` não tem chave estrangeira para `auth.users` e ficariam órfãos), depois remove
o usuário do Auth, e as tabelas caem por `ON DELETE CASCADE`. E ainda confere o resíduo depois,
em vez de confiar na cascata no escuro.

**A RLS está ligada** em todas as tabelas, com a política padrão de cada um ver só a própria
linha.

---

## Lacunas, por gravidade

> Nove lacunas. As de número **3, 4 e 6 já foram corrigidas** em 22/10/2026 — o que foi feito
> está na seção "O que já foi corrigido", no fim.
>
> As lacunas ficam como saíram do levantamento, sem reescrever o passado, **com duas exceções
> assinaladas no próprio texto**: a 3, onde eu listei um operador que não existe, e a 5, onde
> eu errei para menos e a correção mudou a gravidade de média para alta. Deixo os dois erros
> à vista porque apagá-los esconderia como foram achados.
>
> As lacunas 7 e 8 vieram de uma auditoria anterior, de 09/10/2026, e esta tinha perdido as
> duas. Reconferi no código antes de trazê-las de volta.

### ALTA — 1. A política está publicada com texto de preenchimento

`app/privacy/page.tsx`, linhas 32 e 97:

```
[RAZÃO SOCIAL / NOME DO RESPONSÁVEL — completar antes de publicar]
[E-MAIL DE CONTATO — completar antes de publicar]
```

O e-mail aparece duas vezes, e a segunda é justamente onde a política diz como o titular exerce
os direitos dele. **Hoje não há como exercer nenhum direito** — não existe canal publicado.

O Art. 9º exige identificação clara do controlador, e o Art. 18 exige um meio de contato. Está
no ar assim desde que a página foi publicada.

**Correção:** trocar os dois placeholders. É a única coisa desta lista que eu não consigo fazer
sozinho — preciso dos dados reais.

### ALTA — 2. Não existe Termo de Uso

O app cobra R$ 37/mês ou R$ 297/ano, e o Treino do Personal é R$ 147 na primeira turma
(R$ 397 na renovação). Não há nenhum documento
que estabeleça o que o serviço entrega, o que acontece em caso de cancelamento, quem responde
por quê, e qual a limitação de responsabilidade de um app que prescreve exercício físico.

A política de privacidade **não cumpre esse papel** — ela trata de dado pessoal, não da relação
comercial.

**Isto é trabalho de advogado**, não meu. Um app de treino que cobra e que sugere carga tem
exposição real se alguém se lesionar.

### MÉDIA — 3. Quatro terceiros não estão declarados

A seção 5 cita Google (Gemini) e Supabase. Não cita:

| Terceiro | O que recebe | Onde |
|---|---|---|
| **Vercel** | Hospeda o app: IP, dispositivo e dados de requisição de todo acesso | infraestrutura |
| **Mercado Pago** | O e-mail do pagador e um identificador interno | `lib/mercadopago.ts:66` |
| **YouTube (Google)** | IP, referrer e cookies, quando o aluno abre um exercício sem mídia própria | `app/library/page.tsx:643` |
| **Mixkit** | IP, a cada início de treino, para buscar o som do cronômetro | `app/active/page.tsx:94` |

Os dois últimos eu só encontrei conferindo os domínios externos chamados pelo código, e os dois
têm correção técnica fácil, além da declaração:

- O `<iframe>` aponta para `youtube.com/embed`. Trocar por **`youtube-nocookie.com/embed`** faz
  o YouTube parar de gravar cookie de rastreio antes de a pessoa dar play. Uma palavra.
- O som do descanso é baixado de `assets.mixkit.co` **a cada treino**. Guardar o arquivo em
  `public/` resolve: para de vazar IP, e o som para de depender de um CDN de terceiro estar no
  ar (hoje, se o Mixkit cair, o aluno treina sem aviso de descanso).

Fora da lista, mas vale saber: a notificação push passa pelo serviço do navegador do aluno
(Google, Mozilla ou Apple, conforme o navegador). Isso é inerente ao Web Push — não dá para
evitar —, mas também não está dito na política.

O Art. 9º, inciso V, dá ao titular o direito de saber com quem o dado é compartilhado.

**Correção:** acrescentar os quatro à seção 5. Eu faço.

> **Correção do meu próprio relatório.** A primeira versão deste documento listava
> **Cloudflare R2** como operador. Não existe: zero referências no código inteiro. A mídia dos
> exercícios está no Supabase Storage, bucket `exercise-media`, que já estava declarado. Eu
> afirmei sem medir — exatamente o que o AGENTS.md manda não fazer. Em compensação, foi ao
> conferir que apareceram o YouTube e o Mixkit, que eram achados de verdade.

### MÉDIA — 4. A exclusão não confere uma tabela com dado do titular

`app/api/account/delete/route.ts` verifica 9 tabelas. Existem 11 com vínculo a usuário, e
**`treino_personalizado_pedidos` não está na lista de verificação.**

A boa notícia: ela **tem** `ON DELETE CASCADE` (migração 35, linha 27), então o dado é apagado
de fato. O defeito é que a verificação não cobre — se a cascata falhasse ali, ninguém saberia,
e o log diria "resíduo: nenhum".

(`modelos_de_sessao` usa `master_id` e guarda os modelos do profissional, não dado de aluno.
Fica fora com razão.)

**Correção:** acrescentar a tabela à lista. Uma linha. Eu faço — mas é `app/api/`, área
protegida, e preciso da sua aprovação.

### ALTA — 5. O app oferece 14 anos; a política promete 18

**Esta lacuna subiu de média para alta depois que eu conferi direito.** A primeira versão deste
relatório dizia que a idade não era validada em lugar nenhum. Está errado, e a verdade é pior.

A política diz: *"O VegaFit não é direcionado a menores de 18 anos."*

Mas o onboarding tem um seletor de idade com botões de mais e menos, e o piso dele é **14**
(`app/onboarding/page.tsx:318`). Não é ausência de regra: é uma regra escrita que **contradiz
a política publicada**. O app não deixa o aluno descer abaixo de 14 — ou seja, alguém decidiu
que 14 era aceitável.

Já a anamnese, onde entra o dado de saúde, tem um campo de número livre, sem mínimo nem máximo
(`lib/anamneseSteps.ts:40`). Aceita qualquer coisa.

Os dois juntos: o app convida um garoto de 14, aceita que ele declare lesão, medicamento
contínuo e condição médica, e prescreve carga — enquanto a política afirma que isso não
acontece. Se um responsável reclamar, o documento publicado contradiz o próprio produto.

**Isto é decisão sua antes de ser código.** Três caminhos:
- manter 18 e **validar de fato** nos dois lugares (trocar o piso para 18 e pôr limite na
  anamnese)
- assumir os 14 na política e exigir consentimento de responsável, como o Art. 14 pede
- manter como está, sabendo que os dois se contradizem

Prescrição de exercício para menor sem anuência de responsável é risco além da LGPD.

### BAIXA — 6. O Art. 20 não é mencionado

O app usa IA para **decidir** o treino, a carga sugerida e a progressão. O Art. 20 dá ao titular
o direito de pedir revisão de decisão automatizada que afete seus interesses.

Na prática o VegaFit já é melhor que a média aqui — tem o profissional CREF por trás, e o aluno
pode pedir o Treino do Personal montado à mão. Mas a política não informa esse direito.

**Correção:** um parágrafo na seção 7. Eu faço.

### MÉDIA — 7. Não há Encarregado nomeado (Art. 41)

A palavra "encarregado" não aparece em lugar nenhum do app — nem a ANPD. O Art. 41 manda o
controlador indicar um encarregado e **divulgar publicamente** a identidade e o contato dele.

Na prática, para uma operação do seu tamanho, o encarregado é você mesmo ou alguém que você
indique: não precisa ser cargo, nem pessoa contratada. O que a lei pede é que esteja publicado.
Resolve junto com a lacuna 1, no mesmo parágrafo, assim que você me passar o e-mail.

Vale dizer que a Resolução CD/ANPD nº 2/2022 dispensa o agente de **pequeno porte** de nomear
encarregado — mas o regime não vale para tratamento de alto risco, e dado de saúde pesa nessa
avaliação. **Essa é pergunta de advogado**, não minha, e é a mesma que decide o tamanho de
várias outras obrigações suas.

### BAIXA — 8. A transferência internacional não diz sob qual hipótese ocorre

A política cita "os arts. 33 a 36" duas vezes, para o Google e para a Vercel. Citar a faixa de
artigos não é o mesmo que declarar a hipótese: o Art. 33 lista várias (cláusulas contratuais
padrão, certificação, consentimento específico do titular, entre outras), e o titular tem
direito de saber qual delas sustenta o envio dos dados dele para fora.

É ajuste de texto, mas de texto que precisa estar certo — depende de quais cláusulas os
contratos do Google e da Vercel efetivamente trazem. Vai junto com o Termo de Uso, no advogado.

### BAIXA — 9. O prazo de retenção é indefinido

A seção 6 diz "enquanto sua conta estiver ativa", sem prazo para conta abandonada. O histórico
de anamnese é explicitamente **cumulativo e sem expurgo** — cada resposta cria um registro novo
com dado de saúde, para sempre.

O Art. 16 pede eliminação após o fim do tratamento. "Enquanto a conta existir" é aceitável, mas
vale definir o que acontece com uma conta inativa há dois anos.

Há uma migração que já trata disso para outra tabela (`32_ai_usage_log_retencao.sql`), então o
padrão existe no projeto.

---

## O que já foi corrigido

Na branch `lgpd/politica`, em 22/10/2026. Nenhum deles fecha uma lacuna sozinho — fecham o que
dependia só de código.

| | O quê | Onde |
|---|---|---|
| ✅ | Vercel, Mercado Pago, YouTube, Mixkit e o push declarados | seção 5 da política |
| ✅ | Art. 20 — direito a revisão humana da decisão automatizada | seção 7 da política |
| ✅ | `youtube.com/embed` → `youtube-nocookie.com/embed` | `app/library/page.tsx:643` |
| ✅ | Som do descanso servido pelo próprio app | `public/sons/descanso.mp3` |
| ✅ | `treino_personalizado_pedidos` na verificação da exclusão | `app/api/account/delete/route.ts` |

Em todos: `tsc` 0 erros, `lint` 0 erros, 528 testes passando, build compila.

Sobre o último: ele **não muda o que é apagado**. A cascata do banco já apagava, e a consulta
acrescentada é um `count` que roda depois que a conta deixou de existir. O que faltava era o
alarme — sem a tabela na lista, uma cascata quebrada no futuro produziria um comprovante de
exclusão dizendo "resíduo: nenhum" sem ter olhado lá.

---

## O que ainda falta

**Depende de você, e eu não consigo fazer:**

1. **Os dados reais da política** — razão social (ou seu nome, se for pessoa física) e e-mail de
   contato. É o item de maior gravidade da auditoria, e o único que deixa a política sem
   serventia: hoje a seção que explica como exercer direitos aponta para um colchete.
2. **A regra de idade** — manter 18 e validar de fato, baixar e exigir responsável, ou assumir
   a divergência. Depois que você decidir, eu implemento.
3. **O Termo de Uso** — advogado. Não é trabalho meu, e não é a política de privacidade.

**Em aberto, de menor urgência:**

4. **Nomear o Encarregado e publicar o contato** (lacuna 7). Sai junto com o item 1 — é o mesmo
   parágrafo da política. Só depende do e-mail.
5. **A hipótese do Art. 33** para a transferência internacional (lacuna 8). Depende de ler os
   contratos do Google e da Vercel; vai com o advogado.
6. O prazo de retenção para conta abandonada (lacuna 9). O padrão já existe no projeto, em
   `database/32_ai_usage_log_retencao.sql`.

---

## Uma observação sobre urgência

Nada disso é teórico agora. Enquanto o app tinha só alunos seus, que te conhecem e te procuram
pelo WhatsApp, o canal de contato ausente na política era uma formalidade. Hoje a cobrança está
ligada e existe página de vendas — o próximo cadastro pode ser de alguém que não te conhece,
que paga, e que lê a política antes de entregar lesão, medicamento e condição médica.

É nesse cadastro que o placeholder `[E-MAIL DE CONTATO — completar antes de publicar]` deixa de
ser detalhe.
