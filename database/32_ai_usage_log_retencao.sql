/*
  Achado M1 da auditoria: nenhuma tabela tem política de retenção.

  Esta migration resolve a mais fácil e sem risco: `ai_usage_log`. As demais (anamnese,
  histórico de treino, peso) exigem decisão de negócio sobre prazo — não dá para escolher
  por você.

  POR QUE ESTA TABELA É SEGURA DE EXPURGAR

  Ela existe só para o throttle (utils/rate-limit.ts), que consulta três janelas:
    - capacidade global: últimos 60 SEGUNDOS
    - cota por usuário: no máximo 1440 minutos (24h)
    - calibração da reserva: as últimas 20 linhas COM consumo real, por rota

  As duas primeiras nunca olham além de 24h. A terceira é a que exige cuidado: ela não
  filtra por data, então um DELETE ingênuo por idade apagaria as amostras de uma rota pouco
  usada e ela voltaria a usar a estimativa fixa.

  Medido em 23/09/2026: 123 linhas, 38 dias, e apenas UMA com consumo real gravado (o resto
  é anterior à migration 27). `nutrition` e `progression` tinham zero. Por isso o DELETE
  abaixo preserva explicitamente as 20 últimas linhas com `tokens` de cada rota.

  COMO APLICAR: Execute este SQL no SQL Editor do Supabase Dashboard.
*/

-- ---------------------------------------------------------------------------------------
-- 1. Limpeza imediata
-- ---------------------------------------------------------------------------------------

DELETE FROM public.ai_usage_log
WHERE created_at < now() - interval '30 days'
  AND id NOT IN (
    -- As linhas que alimentam a calibração do throttle, preservadas independentemente da
    -- idade: 20 por rota, as mais recentes que tenham consumo real.
    SELECT id FROM (
      SELECT id,
             row_number() OVER (PARTITION BY endpoint ORDER BY created_at DESC) AS posicao
      FROM public.ai_usage_log
      WHERE tokens IS NOT NULL
    ) recentes
    WHERE posicao <= 20
  );

-- ---------------------------------------------------------------------------------------
-- 2. Rotina diária
-- ---------------------------------------------------------------------------------------
/*
  Sem isto, a limpeza acima é um evento único e a tabela volta a crescer.

  Requer a extensão pg_cron, que no Supabase se habilita em
  Database > Extensions > pg_cron. Se preferir não habilitá-la, dá para chamar o mesmo
  DELETE a partir de uma rota protegida por CRON_SECRET, como já é feito em
  app/api/cron/send-reminders.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'expurgo-ai-usage-log',
  '0 4 * * *',  -- 04:00 UTC, fora do horário de uso
  $$
    DELETE FROM public.ai_usage_log
    WHERE created_at < now() - interval '30 days'
      AND id NOT IN (
        SELECT id FROM (
          SELECT id,
                 row_number() OVER (PARTITION BY endpoint ORDER BY created_at DESC) AS posicao
          FROM public.ai_usage_log
          WHERE tokens IS NOT NULL
        ) recentes
        WHERE posicao <= 20
      );
  $$
);

/*
  Para conferir depois:      SELECT * FROM cron.job;
  Para remover a rotina:     SELECT cron.unschedule('expurgo-ai-usage-log');
*/
