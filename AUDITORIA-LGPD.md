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

### MÉDIA — 5. A regra de menores não é verificada em lugar nenhum

A política diz: *"O VegaFit não é direcionado a menores de 18 anos."*

O campo de idade da anamnese (`lib/anamneseSteps.ts:40`) é um número sem mínimo, sem máximo e
sem validação. Uma pessoa de 13 anos se cadastra, responde a anamnese, informa lesões e recebe
prescrição de carga — e nada no app registra ou impede.

Não há nem sequer uma pergunta sobre idade no cadastro: ela só aparece na anamnese, depois de a
conta existir.

**Isto é decisão sua antes de ser código.** Três caminhos:
- manter 18 e **validar de fato** (bloquear o cadastro, ou a geração de treino)
- baixar a idade declarada e exigir consentimento do responsável, como o Art. 14 pede
- manter como está e aceitar a divergência

Prescrição de exercício para menor sem anuência de responsável é risco além da LGPD.

### BAIXA — 6. O Art. 20 não é mencionado

O app usa IA para **decidir** o treino, a carga sugerida e a progressão. O Art. 20 dá ao titular
o direito de pedir revisão de decisão automatizada que afete seus interesses.

Na prática o VegaFit já é melhor que a média aqui — tem o profissional CREF por trás, e o aluno
pode pedir o Treino do Personal montado à mão. Mas a política não informa esse direito.

**Correção:** um parágrafo na seção 7. Eu faço.

### BAIXA — 7. O prazo de retenção é indefinido

A seção 6 diz "enquanto sua conta estiver ativa", sem prazo para conta abandonada. O histórico
de anamnese é explicitamente **cumulativo e sem expurgo** — cada resposta cria um registro novo
com dado de saúde, para sempre.

O Art. 16 pede eliminação após o fim do tratamento. "Enquanto a conta existir" é aceitável, mas
vale definir o que acontece com uma conta inativa há dois anos.

Há uma migração que já trata disso para outra tabela (`32_ai_usage_log_retencao.sql`), então o
padrão existe no projeto.

---

## O que eu proponho fazer

Em ordem, e separando o que é meu do que é seu:

**Você:**
1. Os dados reais para a política — razão social (ou seu nome, se for pessoa física) e e-mail
   de contato
2. Decidir a regra de idade
3. Procurar um advogado para o Termo de Uso

**Eu, com sua aprovação:**
4. Acrescentar Vercel, Mercado Pago, YouTube e Mixkit à seção 5, e o push junto
5. Acrescentar o Art. 20 à seção 7
6. Trocar `youtube.com/embed` por `youtube-nocookie.com/embed`
7. Guardar o som do descanso em `public/` em vez de buscar no Mixkit
8. Acrescentar `treino_personalizado_pedidos` à verificação da exclusão
9. Implementar a validação de idade, depois que você decidir qual

Os itens 4 e 5 são texto e não têm risco. O 6 é uma palavra. O 7 e o 8 tocam áreas que você
marcou como protegidas — `app/active/page.tsx` e `app/api/` —, então ficam parados até você
mandar. O 9 depende da sua decisão sobre idade.

---

## Uma observação sobre urgência

Nada disso é teórico agora. Enquanto o app tinha só alunos seus, que te conhecem e te procuram
pelo WhatsApp, o canal de contato ausente na política era uma formalidade. Hoje a cobrança está
ligada e existe página de vendas — o próximo cadastro pode ser de alguém que não te conhece,
que paga, e que lê a política antes de entregar lesão, medicamento e condição médica.

É nesse cadastro que o placeholder `[E-MAIL DE CONTATO — completar antes de publicar]` deixa de
ser detalhe.
