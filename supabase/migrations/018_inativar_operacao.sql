-- RotaScan — Inativar operação (ex.: operações de treinamento) sem excluir
-- os dados. Operações inativas continuam visíveis nas listagens, mas saem
-- dos indicadores do Dashboard.

ALTER TABLE operacoes ADD COLUMN IF NOT EXISTS ativa BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION dashboard_kpis(
  p_data_inicio DATE,
  p_data_fim DATE,
  p_galpao_id UUID DEFAULT NULL,
  p_transportadora_id UUID DEFAULT NULL,
  p_tipo_evento tipo_evento DEFAULT NULL,
  p_operacao_id UUID DEFAULT NULL,
  p_rota_id UUID DEFAULT NULL,
  p_colaborador_id UUID DEFAULT NULL,
  p_motorista_id UUID DEFAULT NULL
)
RETURNS JSON LANGUAGE sql STABLE AS $$
  WITH base AS MATERIALIZED (
    SELECT b.*
    FROM bipagens b
    JOIN operacoes o ON o.id = b.operacao_id
    WHERE o.ativa
      AND b.bipado_em::date BETWEEN p_data_inicio AND p_data_fim
      AND (p_galpao_id IS NULL OR o.galpao_id = p_galpao_id)
      AND (p_transportadora_id IS NULL OR b.transportadora_id = p_transportadora_id)
      AND (p_tipo_evento IS NULL OR b.tipo_evento = p_tipo_evento)
      AND (p_operacao_id IS NULL OR b.operacao_id = p_operacao_id)
      AND (p_rota_id IS NULL OR b.rota_id = p_rota_id)
      AND (p_colaborador_id IS NULL OR b.colaborador_id = p_colaborador_id)
      AND (p_motorista_id IS NULL OR b.motorista_id = p_motorista_id)
  ),
  -- Comparação Recebimento x Entrega ignora o filtro de tipo_evento (precisa
  -- dos dois tipos para comparar), mas respeita os demais filtros.
  base_comparacao AS MATERIALIZED (
    SELECT b.tipo_evento
    FROM bipagens b
    JOIN operacoes o ON o.id = b.operacao_id
    WHERE o.ativa
      AND b.bipado_em::date BETWEEN p_data_inicio AND p_data_fim
      AND (p_galpao_id IS NULL OR o.galpao_id = p_galpao_id)
      AND (p_transportadora_id IS NULL OR b.transportadora_id = p_transportadora_id)
      AND (p_operacao_id IS NULL OR b.operacao_id = p_operacao_id)
      AND (p_rota_id IS NULL OR b.rota_id = p_rota_id)
      AND (p_colaborador_id IS NULL OR b.colaborador_id = p_colaborador_id)
      AND (p_motorista_id IS NULL OR b.motorista_id = p_motorista_id)
      AND b.tipo_evento IN ('RECEBIMENTO', 'ENTREGA')
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
      SELECT coalesce(json_agg(json_build_object('motorista', m.nome, 'total', x.total) ORDER BY x.total DESC), '[]')
      FROM (
        SELECT motorista_id, count(*) AS total FROM base
        WHERE motorista_id IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 15
      ) x
      JOIN motoristas m ON m.id = x.motorista_id
    ),
    'por_tipo_evento', (
      SELECT coalesce(json_agg(json_build_object('tipo_evento', tipo_evento, 'total', total)), '[]')
      FROM (SELECT tipo_evento, count(*) AS total FROM base GROUP BY 1) x
    ),
    'recebimento_total', (SELECT count(*) FROM base_comparacao WHERE tipo_evento = 'RECEBIMENTO'),
    'entrega_total', (SELECT count(*) FROM base_comparacao WHERE tipo_evento = 'ENTREGA'),
    'overrides_aplicados', (SELECT count(*) FROM base WHERE override_aplicado)
  );
$$;

REVOKE ALL ON FUNCTION dashboard_kpis(DATE, DATE, UUID, UUID, tipo_evento, UUID, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dashboard_kpis(DATE, DATE, UUID, UUID, tipo_evento, UUID, UUID, UUID, UUID) TO authenticated;
