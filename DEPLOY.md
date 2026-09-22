# Deploy

O `.env.local` é ignorado pelo git de propósito. Nenhuma credencial viaja com o repositório,
então toda variável abaixo precisa ser cadastrada no painel do host antes do primeiro deploy.
Os valores estão no seu `.env.local`.

## Variáveis obrigatórias

| Variável | Onde obter | Sem ela |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | O middleware quebra em toda rota |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/publishable | Login não funciona |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role/secret | Rate limit, exclusão de conta e cron falham |
| `GROQ_API_KEY` | console.groq.com/keys | Todas as 6 rotas de IA respondem 401 |

`NEXT_PUBLIC_*` é embutida no bundle do navegador em build time — se você trocar uma delas,
precisa de um novo build, não basta reiniciar.

## Variáveis opcionais

| Variável | Padrão | Para que serve |
|---|---|---|
| `GROQ_TPM_LIMIT` | `8000` | Teto de tokens/minuto da conta Groq. **Ajuste aqui ao subir de tier** — é o que libera mais usuários simultâneos, sem mexer em código |
| `AI_MAX_QUEUE_WAIT_MS` | `10000` | Quanto uma requisição pode esperar por capacidade antes de devolver 429. Precisa caber no `maxDuration` junto com a geração |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | — | Notificações push |
| `CRON_SECRET` | — | Protege `/api/cron/send-reminders` |
| `R2_*` / `NEXT_PUBLIC_R2_PUBLIC_URL` | — | Mídia dos exercícios no Cloudflare R2 |

## Banco

As migrations em `database/` são aplicadas **manualmente** no SQL Editor do Supabase, em ordem
numérica. Não há ferramenta de migration automática neste projeto.

Ao apontar para um Supabase novo, rode todas da `01` à `27`. No banco atual, todas já estão
aplicadas.

## Limites do plano Groq

Medido em 22/09/2026 com o catálogo de 882 exercícios: **uma geração de treino custa ~6900
tokens**. No free tier (`x-ratelimit-limit-tokens: 8000`, 1000 requisições/dia), isso significa
aproximadamente **uma geração por minuto para o app inteiro** — não por usuário.

Enquanto esse for o teto, o app atende você e poucos testadores. Para usuários reais, o upgrade
de tier em console.groq.com/settings/billing é pré-requisito, e depois é só ajustar
`GROQ_TPM_LIMIT`.

## Timeout das funções

As seis rotas de IA declaram `export const maxDuration = 60`. A geração leva ~15s e a fila de
capacidade pode somar mais 10s, o que estoura o padrão da Vercel. 60s é o máximo do plano Hobby;
no Pro dá para subir mais.

## Ambientes compartilhando o mesmo banco

Hoje o desenvolvimento local e o deploy apontam para o mesmo projeto Supabase e a mesma conta
Groq. Consequências:

- A tabela `ai_usage_log` é compartilhada, então testes locais consomem o orçamento de tokens
  da produção e podem disparar o 429 para usuários reais.
- Um `delete` de limpeza local apaga dados de produção.

Para uso sério, vale um projeto Supabase separado para desenvolvimento.
