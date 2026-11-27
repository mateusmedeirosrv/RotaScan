-- RotaScan — Painel de entregas pendentes (tela inicial). Idempotente.
--
-- Lista as encomendas CONFERIDAS (têm bipagem CONFERENCIA) por dia de prazo,
-- com o motorista a quem foram disponibilizadas (ENTREGA ativa da mesma
-- encomenda: chave_encomenda = Nr. Entrega|NF|Volume, migration 030).
--
--   dia      = prazo_final; prazo vencido ou ausente cai em p_hoje (D).
--   atrasada = prazo_final < p_hoje.
-- Ficam de fora: encomendas devolvidas à origem e encomendas atrasadas que
-- já estão com motorista (entrega concluída em dias anteriores).
-- Retorno fecha o ciclo da Entrega → a encomenda volta a ficar sem motorista.
-- SECURITY INVOKER: respeita o RLS do galpão.

CREATE INDEX IF NOT EXISTS idx_bipagens_chave_encomenda
  ON bipagens(transportadora_id, chave_encomenda)
  WHERE chave_encomenda IS NOT NULL;

CREATE OR REPLACE FUNCTION painel_entregas_pendentes(
  p_hoje DATE DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date
)
RETURNS TABLE (
  dia                 DATE,
  atrasada            BOOLEAN,
  transportadora_id   UUID,
  transportadora      TEXT,
  encomenda_id        UUID,
  nr_entrega          TEXT,
  nota_fiscal         TEXT,
  volumes             INT,
  vol_nr              INT,
  nome_pessoa         TEXT,
  endereco            TEXT,
  bairro              TEXT,
  prazo_final         DATE,
  prazo_texto         TEXT,
  motorista           TEXT,
  rota                TEXT,
  disponibilizado_em  TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp AS $$
  WITH conferidas AS (
    -- Uma linha por Nr. Entrega + NF + Volume (planilha reimportada não duplica)
    SELECT DISTINCT ON (e.transportadora_id, e.nr_entrega, e.nota_fiscal, e.vol_nr)
      e.*,
      coalesce(e.nr_entrega, '') || '|' || coalesce(e.nota_fiscal, '') || '|' || coalesce(e.vol_nr::text, '') AS chave
    FROM encomendas e
    WHERE EXISTS (
      SELECT 1 FROM bipagens c
      WHERE c.encomenda_id = e.id AND c.tipo_evento = 'CONFERENCIA'
    )
    ORDER BY e.transportadora_id, e.nr_entrega, e.nota_fiscal, e.vol_nr, e.importado_em DESC
  ),
  com_entrega AS (
    SELECT c.*, ent.motorista_id, ent.rota_id, ent.bipado_em
    FROM conferidas c
    LEFT JOIN LATERAL (
      SELECT b.motorista_id, b.rota_id, b.bipado_em
      FROM bipagens b
      WHERE b.tipo_evento = 'ENTREGA' AND NOT b.ciclo_fechado
        AND b.transportadora_id = c.transportadora_id
        AND b.chave_encomenda = c.chave
      ORDER BY b.bipado_em DESC
      LIMIT 1
    ) ent ON true
    WHERE NOT EXISTS (
      SELECT 1 FROM bipagens d
      WHERE d.tipo_evento = 'DEVOLUCAO_ORIGEM'
        AND d.transportadora_id = c.transportadora_id
        AND (
          d.codigo IN (c.nr_entrega, c.pedido) OR
          d.codigo IN (
            SELECT cc.codigo FROM bipagens cc
            WHERE cc.encomenda_id = c.id AND cc.tipo_evento = 'CONFERENCIA'
          )
        )
    )
  )
  SELECT
    greatest(coalesce(x.prazo_final, p_hoje), p_hoje) AS dia,
    coalesce(x.prazo_final < p_hoje, false)           AS atrasada,
    x.transportadora_id,
    t.nome,
    x.id,
    x.nr_entrega,
    x.nota_fiscal,
    x.volumes,
    x.vol_nr,
    x.nome_pessoa,
    x.endereco,
    x.bairro,
    x.prazo_final,
    x.prazo_texto,
    m.nome,
    r.nome,
    x.bipado_em
  FROM com_entrega x
  JOIN transportadoras t ON t.id = x.transportadora_id
  LEFT JOIN motoristas m ON m.id = x.motorista_id
  LEFT JOIN rotas r ON r.id = x.rota_id
  WHERE NOT (coalesce(x.prazo_final < p_hoje, false) AND x.motorista_id IS NOT NULL);
$$;

REVOKE ALL ON FUNCTION painel_entregas_pendentes(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION painel_entregas_pendentes(DATE) TO authenticated;
