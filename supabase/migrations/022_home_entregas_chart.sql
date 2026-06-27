-- RotaScan — Função para gráfico de entregas da tela inicial
-- Retorna contagem de ENTREGA agrupada por período de 15 dias e transportadora
-- nos últimos 3 meses, respeitando isolamento de galpão via auth_galpao_id().

CREATE OR REPLACE FUNCTION home_entregas_chart()
RETURNS JSON LANGUAGE sql STABLE AS $$
  SELECT coalesce(json_agg(
    json_build_object(
      'periodo',        periodo,
      'transportadora', transportadora,
      'total',          total
    ) ORDER BY periodo, transportadora
  ), '[]')
  FROM (
    SELECT
      -- Bucketa cada data em 1-15 (dia 1) ou 16-fim (dia 16) do mesmo mês
      (date_trunc('month', b.bipado_em) +
        CASE WHEN extract(day FROM b.bipado_em) <= 15
          THEN interval '0 days'
          ELSE interval '15 days'
        END
      )::date AS periodo,
      t.nome          AS transportadora,
      count(*)::int   AS total
    FROM bipagens b
    JOIN operacoes      o ON o.id = b.operacao_id
    JOIN transportadoras t ON t.id = b.transportadora_id
    WHERE b.bipado_em >= now() - interval '3 months'
      AND b.tipo_evento = 'ENTREGA'
      AND (auth_galpao_id() IS NULL OR o.galpao_id = auth_galpao_id())
    GROUP BY 1, 2
  ) x
$$;

REVOKE ALL ON FUNCTION home_entregas_chart() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION home_entregas_chart() TO authenticated;
