-- Adiciona o campo motivo na função de export do dashboard.
CREATE OR REPLACE FUNCTION dashboard_bipagens_export(
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
    WHERE b.bipado_em::date BETWEEN p_data_inicio AND p_data_fim
      AND (p_galpao_id IS NULL OR o.galpao_id = p_galpao_id)
      AND (p_transportadora_id IS NULL OR b.transportadora_id = p_transportadora_id)
      AND (p_tipo_evento IS NULL OR b.tipo_evento = p_tipo_evento)
      AND (p_operacao_id IS NULL OR b.operacao_id = p_operacao_id)
      AND (p_rota_id IS NULL OR b.rota_id = p_rota_id)
      AND (p_colaborador_id IS NULL OR b.colaborador_id = p_colaborador_id)
      AND (p_motorista_id IS NULL OR b.motorista_id = p_motorista_id)
  ),
  limitado AS (
    SELECT * FROM base ORDER BY bipado_em DESC LIMIT 20000
  )
  SELECT json_build_object(
    'total', (SELECT count(*) FROM base),
    'truncado', (SELECT count(*) FROM base) > 20000,
    'linhas', (
      SELECT coalesce(json_agg(json_build_object(
        'tipo_encomenda', t.nome,
        'tipo_evento', CASE l.tipo_evento
          WHEN 'RECEBIMENTO' THEN 'Recebimento'
          WHEN 'ENTREGA' THEN 'Entrega'
          WHEN 'DEVOLUCAO_ORIGEM' THEN 'Devolução à Origem'
          WHEN 'RETORNO' THEN 'Retorno'
        END,
        'operacao', t.nome || ' · ' || (CASE l.tipo_evento
          WHEN 'RECEBIMENTO' THEN 'Recebimento'
          WHEN 'ENTREGA' THEN 'Entrega'
          WHEN 'DEVOLUCAO_ORIGEM' THEN 'Devolução à Origem'
          WHEN 'RETORNO' THEN 'Retorno'
        END) || ' · ' || o.data,
        'rota', r.nome,
        'colaborador', c.nome,
        'data_hora', l.bipado_em,
        'motorista', m.nome,
        'codigo', l.codigo,
        'status', CASE WHEN l.override_aplicado THEN 'Override aplicado' ELSE 'OK' END,
        'motivo', l.motivo
      ) ORDER BY l.bipado_em DESC), '[]')
      FROM limitado l
      JOIN operacoes o ON o.id = l.operacao_id
      JOIN transportadoras t ON t.id = l.transportadora_id
      JOIN rotas r ON r.id = l.rota_id
      JOIN colaboradores c ON c.id = l.colaborador_id
      LEFT JOIN motoristas m ON m.id = l.motorista_id
    )
  );
$$;

REVOKE ALL ON FUNCTION dashboard_bipagens_export(DATE, DATE, UUID, UUID, tipo_evento, UUID, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dashboard_bipagens_export(DATE, DATE, UUID, UUID, tipo_evento, UUID, UUID, UUID, UUID) TO authenticated;
