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
| `GEMINI_API_KEY` | aistudio.google.com/apikey | Todas as 6 rotas de IA respondem 401 |

`NEXT_PUBLIC_*` é embutida no bundle do navegador em build time — se você trocar uma delas,
precisa de um novo build, não basta reiniciar.

## Variáveis opcionais

| Variável | Padrão | Para que serve |
|---|---|---|
| `AI_TPM_LIMIT` | `250000` | Teto de tokens/minuto da conta. **Ajuste aqui ao subir de tier** — é o que libera mais usuários simultâneos, sem mexer em código |
| `AI_MAX_QUEUE_WAIT_MS` | `10000` | Quanto uma requisição pode esperar por capacidade antes de devolver 429. Precisa caber no `maxDuration` junto com a geração |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | — | Notificações push |
| `CRON_SECRET` | — | Protege `/api/cron/send-reminders` |
| `R2_*` / `NEXT_PUBLIC_R2_PUBLIC_URL` | — | Mídia dos exercícios no Cloudflare R2 |

## Banco

As migrations em `database/` são aplicadas **manualmente** no SQL Editor do Supabase, em ordem
numérica. Não há ferramenta de migration automática neste projeto.

Ao apontar para um Supabase novo, rode todas da `01` à `27`. No banco atual, todas já estão
aplicadas.

## Limites do plano de IA

O provedor é o **Gemini** (`gemini-3.5-flash-lite`, ver `lib/geminiClient.ts`). A migração saiu
do Groq em 22/09/2026 por dois motivos medidos, não estimados:

- **Throughput**: o free tier do Groq era 8.000 tokens/minuto e uma geração custa ~6.900, o que
  dava UMA geração por minuto para o app inteiro. O free tier da família Flash é ~250.000 TPM.
- **Qualidade**: com o mesmo teto de 4.096 tokens de saída, o modelo do Groq gastava ~692 em
  reasoning e truncava o JSON — era a causa dos treinos com 5 de 7 exercícios. O Gemini fecha
  o plano completo (7, 7, 7) e aceita até 65.536 de saída.

Consumo real medido por rota, já com o Gemini: treino ~6.800, progression ~9.200, swap ~750,
nutrition ~590, coach-chat ~475, daily-tip ~170.

Atenção ao outro teto: o Gemini limita REQUISIÇÕES por minuto (~15 RPM no free tier do
Flash-Lite) e por dia. Com ~7.000 tokens por chamada, o RPM estoura antes do TPM. Confirme os
limites da sua conta em aistudio.google.com/rate-limit.

## Timeout das funções

As seis rotas de IA declaram `export const maxDuration = 60`. A geração leva ~13s medidos e a fila de
capacidade pode somar mais 10s, o que estoura o padrão da Vercel. 60s é o máximo do plano Hobby;
no Pro dá para subir mais.

## Ambientes compartilhando o mesmo banco

Hoje o desenvolvimento local e o deploy apontam para o mesmo projeto Supabase e a mesma conta
de IA. Consequências:

- A tabela `ai_usage_log` é compartilhada, então testes locais consomem o orçamento de tokens
  da produção e podem disparar o 429 para usuários reais.
- Um `delete` de limpeza local apaga dados de produção.

Para uso sério, vale um projeto Supabase separado para desenvolvimento.
