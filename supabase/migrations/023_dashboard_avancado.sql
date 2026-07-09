-- RotaScan — Dashboard avançado (Fase de expansão de gráficos)
-- Estende dashboard_kpis (mesma assinatura/filtros de 021) com os agregados
-- necessários para os novos gráficos: funil operacional, sankey de fluxo,
-- heatmap galpão x tipo de evento, treemap por rota, série comparativa por
-- transportadora e rankings de colaboradores/motoristas com médias por dia
-- trabalhado.

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS sig
    FROM pg_proc
    WHERE proname = 'dashboard_kpis'
  LOOP
    EXECUTE 'DROP FUNCTION ' || r.sig;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION dashboard_kpis(
  p_data_inicio        DATE,
  p_data_fim           DATE,
  p_galpao_ids         UUID[]        DEFAULT NULL,
  p_transportadora_ids UUID[]        DEFAULT NULL,
  p_tipos_evento       tipo_evento[] DEFAULT NULL,
  p_operacao_ids       UUID[]        DEFAULT NULL,
  p_rota_ids           UUID[]        DEFAULT NULL,
  p_colaborador_ids    UUID[]        DEFAULT NULL,
  p_motorista_ids      UUID[]        DEFAULT NULL
)
RETURNS JSON LANGUAGE sql STABLE AS $$
  WITH base AS MATERIALIZED (
    SELECT b.*, o.galpao_id
    FROM bipagens b
    JOIN operacoes o ON o.id = b.operacao_id
    WHERE b.bipado_em::date BETWEEN p_data_inicio AND p_data_fim
      AND (p_galpao_ids         IS NULL OR o.galpao_id         = ANY(p_galpao_ids))
      AND (p_transportadora_ids IS NULL OR b.transportadora_id = ANY(p_transportadora_ids))
      AND (p_tipos_evento       IS NULL OR b.tipo_evento        = ANY(p_tipos_evento))
      AND (p_operacao_ids       IS NULL OR b.operacao_id        = ANY(p_operacao_ids))
      AND (p_rota_ids           IS NULL OR b.rota_id            = ANY(p_rota_ids))
      AND (p_colaborador_ids    IS NULL OR b.colaborador_id     = ANY(p_colaborador_ids))
      AND (p_motorista_ids      IS NULL OR b.motorista_id       = ANY(p_motorista_ids))
  ),
  -- Comparação Recebimento x Entrega e demais indicadores multi-etapa ignoram
  -- o filtro de tipo (precisam de todos os tipos para montar funil/sankey),
  -- mas respeitam os demais filtros.
  base_comparacao AS MATERIALIZED (
    SELECT b.*, o.galpao_id
    FROM bipagens b
    JOIN operacoes o ON o.id = b.operacao_id
    WHERE b.bipado_em::date BETWEEN p_data_inicio AND p_data_fim
      AND (p_galpao_ids         IS NULL OR o.galpao_id         = ANY(p_galpao_ids))
      AND (p_transportadora_ids IS NULL OR b.transportadora_id = ANY(p_transportadora_ids))
      AND (p_operacao_ids       IS NULL OR b.operacao_id        = ANY(p_operacao_ids))
      AND (p_rota_ids           IS NULL OR b.rota_id            = ANY(p_rota_ids))
      AND (p_colaborador_ids    IS NULL OR b.colaborador_id     = ANY(p_colaborador_ids))
      AND (p_motorista_ids      IS NULL OR b.motorista_id       = ANY(p_motorista_ids))
  ),
  -- Itens do manifesto (planejado) das operações de RECEBIMENTO no período e
  -- filtros aplicáveis. Manifesto não tem rota/motorista (dimensão só existe
  -- por bipagem), então só os filtros de galpão/transportadora/operação/
  -- colaborador se aplicam aqui.
  recebido_planejado AS MATERIALIZED (
    SELECT count(*) AS total
    FROM manifesto_itens mi
    JOIN manifestos m ON m.id = mi.manifesto_id
    JOIN operacoes  o ON o.id = m.operacao_id
    WHERE o.tipo_evento = 'RECEBIMENTO'
      AND o.data BETWEEN p_data_inicio AND p_data_fim
      AND (p_galpao_ids         IS NULL OR o.galpao_id         = ANY(p_galpao_ids))
      AND (p_transportadora_ids IS NULL OR o.transportadora_id = ANY(p_transportadora_ids))
      AND (p_operacao_ids       IS NULL OR o.id                = ANY(p_operacao_ids))
      AND (p_colaborador_ids    IS NULL OR o.colaborador_id    = ANY(p_colaborador_ids))
  ),
  -- Sankey: para cada código recebido no período/filtros, encontra o evento
  -- de saída mais recente (Entrega, Devolução à Origem ou Retorno) do mesmo
  -- código + transportadora, em qualquer data (rastreio real do item).
  sankey_recebidos AS MATERIALIZED (
    SELECT codigo, transportadora_id
    FROM base_comparacao
    WHERE tipo_evento = 'RECEBIMENTO'
  ),
  sankey_saidas AS MATERIALIZED (
    SELECT DISTINCT ON (b.codigo, b.transportadora_id)
      b.codigo, b.transportadora_id, b.tipo_evento
    FROM bipagens b
    WHERE b.tipo_evento IN ('ENTREGA', 'DEVOLUCAO_ORIGEM', 'RETORNO')
    ORDER BY b.codigo, b.transportadora_id, b.bipado_em DESC
  )
  SELECT json_build_object(
    'total', (SELECT count(*) FROM base),
    'por_dia', (
      SELECT coalesce(json_agg(json_build_object('dia', dia, 'total', total) ORDER BY dia), '[]')
      FROM (SELECT bipado_em::date AS dia, count(*) AS total FROM base GROUP BY 1) x
    ),
    'por_transportadora', (
      SELECT coalesce(json_agg(json_build_object('transportadora', t.nome, 'total', x.total) ORDER BY x.total DESC), '[]')
      FROM (SELECT transportadora_id, count(*) AS total FROM base GROUP BY 1) x
      JOIN transportadoras t ON t.id = x.transportadora_id
    ),
    'por_motorista', (
      SELECT coalesce(json_agg(json_build_object(
        'motorista', m.nome,
        'total', x.total,
        'dias_trabalhados', x.dias,
        'media_dia', round(x.total::numeric / x.dias, 1)
      ) ORDER BY x.total DESC), '[]')
      FROM (
        SELECT motorista_id, count(*) AS total, count(DISTINCT bipado_em::date) AS dias
        FROM base
        WHERE motorista_id IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 15
      ) x
      JOIN motoristas m ON m.id = x.motorista_id
    ),
    'ranking_colaboradores', (
      SELECT coalesce(json_agg(json_build_object(
        'colaborador', c.nome,
        'total', x.total,
        'dias_trabalhados', x.dias,
        'media_dia', round(x.total::numeric / x.dias, 1)
      ) ORDER BY x.total DESC), '[]')
      FROM (
        SELECT colaborador_id, count(*) AS total, count(DISTINCT bipado_em::date) AS dias
        FROM base GROUP BY 1 ORDER BY 2 DESC LIMIT 15
      ) x
      JOIN colaboradores c ON c.id = x.colaborador_id
    ),
    'por_tipo_evento', (
      SELECT coalesce(json_agg(json_build_object('tipo_evento', tipo_evento, 'total', total)), '[]')
      FROM (SELECT tipo_evento, count(*) AS total FROM base GROUP BY 1) x
    ),
    'por_dia_transportadora', (
      SELECT coalesce(json_agg(json_build_object('dia', dia, 'transportadora', t.nome, 'total', x.total) ORDER BY dia, t.nome), '[]')
      FROM (SELECT bipado_em::date AS dia, transportadora_id, count(*) AS total FROM base GROUP BY 1, 2) x
      JOIN transportadoras t ON t.id = x.transportadora_id
    ),
    'heatmap_galpao_tipo', (
      SELECT coalesce(json_agg(json_build_object('galpao', g.nome, 'tipo_evento', x.tipo_evento, 'total', x.total)), '[]')
      FROM (SELECT galpao_id, tipo_evento, count(*) AS total FROM base GROUP BY 1, 2) x
      JOIN galpoes g ON g.id = x.galpao_id
    ),
    'por_rota_treemap', (
      SELECT coalesce(json_agg(json_build_object(
        'galpao', g.nome,
        'rota', r.nome,
        'total', x.total,
        'insucesso', x.insucesso
      )), '[]')
      FROM (
        SELECT rota_id,
          count(*) AS total,
          count(*) FILTER (WHERE tipo_evento IN ('DEVOLUCAO_ORIGEM', 'RETORNO')) AS insucesso
        FROM base
        WHERE tipo_evento IN ('ENTREGA', 'DEVOLUCAO_ORIGEM', 'RETORNO')
        GROUP BY 1
      ) x
      JOIN rotas   r ON r.id = x.rota_id
      JOIN galpoes g ON g.id = r.galpao_id
    ),
    'funil', json_build_object(
      'recebido', (SELECT total FROM recebido_planejado),
      'bipado',   (SELECT count(*) FROM base_comparacao WHERE tipo_evento = 'RECEBIMENTO'),
      'em_rota',  (SELECT count(*) FROM base_comparacao WHERE tipo_evento IN ('ENTREGA', 'DEVOLUCAO_ORIGEM', 'RETORNO')),
      'entregue', (SELECT count(*) FROM base_comparacao WHERE tipo_evento = 'ENTREGA')
    ),
    'sankey_fluxo', json_build_object(
      'recebido',    (SELECT count(*) FROM sankey_recebidos),
      'entregue',    (SELECT count(*) FROM sankey_recebidos r JOIN sankey_saidas s ON s.codigo = r.codigo AND s.transportadora_id = r.transportadora_id WHERE s.tipo_evento = 'ENTREGA'),
      'devolvido',   (SELECT count(*) FROM sankey_recebidos r JOIN sankey_saidas s ON s.codigo = r.codigo AND s.transportadora_id = r.transportadora_id WHERE s.tipo_evento = 'DEVOLUCAO_ORIGEM'),
      'retornado',   (SELECT count(*) FROM sankey_recebidos r JOIN sankey_saidas s ON s.codigo = r.codigo AND s.transportadora_id = r.transportadora_id WHERE s.tipo_evento = 'RETORNO'),
      'em_aberto',   (SELECT count(*) FROM sankey_recebidos r LEFT JOIN sankey_saidas s ON s.codigo = r.codigo AND s.transportadora_id = r.transportadora_id WHERE s.tipo_evento IS NULL)
    ),
    'recebimento_total',   (SELECT count(*) FROM base_comparacao WHERE tipo_evento = 'RECEBIMENTO'),
    'entrega_total',       (SELECT count(*) FROM base_comparacao WHERE tipo_evento = 'ENTREGA'),
    'overrides_aplicados', (SELECT count(*) FROM base WHERE override_aplicado)
  );
$$;

REVOKE ALL ON FUNCTION dashboard_kpis(DATE,DATE,UUID[],UUID[],tipo_evento[],UUID[],UUID[],UUID[],UUID[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION dashboard_kpis(DATE,DATE,UUID[],UUID[],tipo_evento[],UUID[],UUID[],UUID[],UUID[]) TO authenticated;
