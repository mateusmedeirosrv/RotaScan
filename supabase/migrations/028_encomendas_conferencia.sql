-- RotaScan v2.0 — Encomendas importadas no Recebimento + Conferência.
-- Idempotente: pode ser executado múltiplas vezes sem erro.
--
-- 1. ENCOMENDAS: cada linha da planilha de Recebimento (layout com
--    Romaneio, Nro. Entrega, Nota Fiscal, Endereço...) vira uma encomenda,
--    vinculada ao manifesto/operação de RECEBIMENTO que a importou.
-- 2. CONFERENCIA: novo tipo de evento. Cada QR Code / código de barras bipado
--    numa operação de Conferência vira uma bipagem CONFERENCIA com
--    encomenda_id apontando para a encomenda importada. A unicidade
--    (transportadora, código, tipo) garante que um código físico fique
--    vinculado a uma única encomenda.
-- 3. encomendas_por_codigos(): devolve os dados da encomenda para códigos
--    bipados (usado na Entrega e no PDF paisagem).

-- ============================================================
-- ENCOMENDAS
-- ============================================================

CREATE TABLE IF NOT EXISTS encomendas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manifesto_id      UUID NOT NULL REFERENCES manifestos(id) ON DELETE CASCADE,
  operacao_id       UUID NOT NULL REFERENCES operacoes(id),
  galpao_id         UUID NOT NULL REFERENCES galpoes(id),
  transportadora_id UUID NOT NULL REFERENCES transportadoras(id),
  data_importacao   DATE NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  importado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  romaneio          TEXT,
  data_romaneio     DATE,
  motorista         TEXT,
  placa             TEXT,
  remetente         TEXT,
  nr_entrega        TEXT,
  nome_pessoa       TEXT,
  telefone          TEXT,
  prazo_texto       TEXT,
  prazo_final       DATE,
  situacao          TEXT,
  dias_ate_prazo    INT,
  cep               TEXT,
  endereco          TEXT,
  ponto_referencia  TEXT,
  bairro            TEXT,
  cidade_uf         TEXT,
  regiao            TEXT,
  nome_regiao       TEXT,
  nota_fiscal       TEXT,
  volumes           INT,
  vol_nr            INT,
  pedido            TEXT,
  -- Texto único pesquisável (campo PESQUISA da Conferência)
  busca             TEXT GENERATED ALWAYS AS (
    lower(
      coalesce(romaneio, '') || ' ' || coalesce(motorista, '') || ' ' ||
      coalesce(placa, '') || ' ' || coalesce(remetente, '') || ' ' ||
      coalesce(nr_entrega, '') || ' ' || coalesce(nome_pessoa, '') || ' ' ||
      coalesce(telefone, '') || ' ' || coalesce(prazo_texto, '') || ' ' ||
      coalesce(situacao, '') || ' ' || coalesce(cep, '') || ' ' ||
      coalesce(endereco, '') || ' ' || coalesce(ponto_referencia, '') || ' ' ||
      coalesce(bairro, '') || ' ' || coalesce(cidade_uf, '') || ' ' ||
      coalesce(regiao, '') || ' ' || coalesce(nome_regiao, '') || ' ' ||
      coalesce(nota_fiscal, '') || ' ' || coalesce(pedido, '')
    )
  ) STORED
);

CREATE INDEX IF NOT EXISTS idx_encomendas_transp_data ON encomendas(transportadora_id, data_importacao DESC);
CREATE INDEX IF NOT EXISTS idx_encomendas_manifesto   ON encomendas(manifesto_id);
CREATE INDEX IF NOT EXISTS idx_encomendas_operacao    ON encomendas(operacao_id);
CREATE INDEX IF NOT EXISTS idx_encomendas_nr_entrega  ON encomendas(transportadora_id, nr_entrega);
CREATE INDEX IF NOT EXISTS idx_encomendas_pedido      ON encomendas(transportadora_id, pedido);

-- Busca por substring (ILIKE '%termo%') acelerada por trigrama, se disponível
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS idx_encomendas_busca_trgm ON encomendas USING gin (busca gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_trgm indisponível — busca de encomendas sem índice trigrama (%).', SQLERRM;
END;
$$;

ALTER TABLE encomendas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_por_galpao" ON encomendas;
CREATE POLICY "leitura_por_galpao" ON encomendas
  FOR SELECT USING (auth_papel() = 'admin' OR galpao_id = auth_galpao_id());

DROP POLICY IF EXISTS "escrita_galpao" ON encomendas;
CREATE POLICY "escrita_galpao" ON encomendas FOR INSERT
  WITH CHECK (
    auth_papel() = 'admin' OR
    (
      galpao_id = auth_galpao_id() AND
      operacao_id IN (
        SELECT id FROM operacoes
        WHERE galpao_id = auth_galpao_id() AND status = 'EM_ANDAMENTO'
      )
    )
  );

DROP POLICY IF EXISTS "remocao_admin" ON encomendas;
CREATE POLICY "remocao_admin" ON encomendas FOR DELETE USING (auth_papel() = 'admin');

-- ============================================================
-- BIPAGENS — vínculo com a encomenda (Conferência)
-- ============================================================

ALTER TABLE bipagens
  ADD COLUMN IF NOT EXISTS encomenda_id UUID REFERENCES encomendas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bipagens_encomenda ON bipagens(encomenda_id) WHERE encomenda_id IS NOT NULL;

-- CHECK de motorista por tipo: CONFERENCIA, assim como RECEBIMENTO, não tem
-- motorista. O CHECK original (001) não tem nome explícito — remove qualquer
-- CHECK de bipagens que trate de motorista_id antes de recriar com nome.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'bipagens'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%motorista_id%'
  LOOP
    EXECUTE format('ALTER TABLE bipagens DROP CONSTRAINT %I', r.conname);
  END LOOP;
END;
$$;

ALTER TABLE bipagens ADD CONSTRAINT bipagens_motorista_por_tipo CHECK (
  (tipo_evento IN ('RECEBIMENTO', 'CONFERENCIA') AND motorista_id IS NULL) OR
  (tipo_evento IN ('ENTREGA', 'DEVOLUCAO_ORIGEM', 'RETORNO') AND motorista_id IS NOT NULL)
);

ALTER TABLE bipagens DROP CONSTRAINT IF EXISTS bipagens_conferencia_encomenda;
ALTER TABLE bipagens ADD CONSTRAINT bipagens_conferencia_encomenda CHECK (
  tipo_evento <> 'CONFERENCIA' OR encomenda_id IS NOT NULL
);

-- ============================================================
-- encomendas_por_codigos: dados da encomenda para uma lista de códigos.
-- Prioridade: (1) código vinculado na Conferência; (2) código igual ao
-- Nro. Entrega ou ao Pedido da planilha (ex.: Amazon TBR). SECURITY INVOKER:
-- respeita o RLS do galpão.
-- ============================================================

CREATE OR REPLACE FUNCTION encomendas_por_codigos(p_transportadora_id UUID, p_codigos TEXT[])
RETURNS TABLE (
  codigo        TEXT,
  encomenda_id  UUID,
  nr_entrega    TEXT,
  nota_fiscal   TEXT,
  nome_pessoa   TEXT,
  endereco      TEXT,
  bairro        TEXT,
  prazo_final   DATE,
  prazo_texto   TEXT,
  volumes       INT,
  vol_nr        INT
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp AS $$
  SELECT DISTINCT ON (c.cod)
    c.cod, x.id, x.nr_entrega, x.nota_fiscal, x.nome_pessoa, x.endereco,
    x.bairro, x.prazo_final, x.prazo_texto, x.volumes, x.vol_nr
  FROM unnest(p_codigos) AS c(cod)
  JOIN LATERAL (
    SELECT e.id, e.nr_entrega, e.nota_fiscal, e.nome_pessoa, e.endereco, e.bairro,
           e.prazo_final, e.prazo_texto, e.volumes, e.vol_nr, e.importado_em, 1 AS prioridade
    FROM bipagens b
    JOIN encomendas e ON e.id = b.encomenda_id
    WHERE b.tipo_evento = 'CONFERENCIA'
      AND b.transportadora_id = p_transportadora_id
      AND b.codigo = c.cod
    UNION ALL
    SELECT e.id, e.nr_entrega, e.nota_fiscal, e.nome_pessoa, e.endereco, e.bairro,
           e.prazo_final, e.prazo_texto, e.volumes, e.vol_nr, e.importado_em, 2 AS prioridade
    FROM encomendas e
    WHERE e.transportadora_id = p_transportadora_id
      AND (e.nr_entrega = c.cod OR e.pedido = c.cod)
  ) x ON true
  ORDER BY c.cod, x.prioridade, x.importado_em DESC, x.vol_nr NULLS LAST;
$$;

REVOKE ALL ON FUNCTION encomendas_por_codigos(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION encomendas_por_codigos(UUID, TEXT[]) TO authenticated;

-- ============================================================
-- dashboard_bipagens_export — rótulo para CONFERENCIA (sem ele o CASE
-- devolvia NULL e anulava a coluna "operacao" inteira). Mesma assinatura
-- de 024_entrega_duplicada.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION dashboard_bipagens_export(
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
    SELECT b.*
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
          WHEN 'CONFERENCIA' THEN 'Conferência'
        END,
        'operacao', t.nome || ' · ' || (CASE l.tipo_evento
          WHEN 'RECEBIMENTO' THEN 'Recebimento'
          WHEN 'ENTREGA' THEN 'Entrega'
          WHEN 'DEVOLUCAO_ORIGEM' THEN 'Devolução à Origem'
          WHEN 'RETORNO' THEN 'Retorno'
          WHEN 'CONFERENCIA' THEN 'Conferência'
        END) || ' · ' || o.data,
        'rota', r.nome,
        'colaborador', c.nome,
        'data_hora', l.bipado_em,
        'motorista', m.nome,
        'codigo', l.codigo,
        'status', CASE WHEN l.override_aplicado THEN 'Override aplicado' ELSE 'OK' END,
        'motivo', l.motivo,
        'duplicado', l.duplicado
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

REVOKE ALL ON FUNCTION dashboard_bipagens_export(DATE,DATE,UUID[],UUID[],tipo_evento[],UUID[],UUID[],UUID[],UUID[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION dashboard_bipagens_export(DATE,DATE,UUID[],UUID[],tipo_evento[],UUID[],UUID[],UUID[],UUID[]) TO authenticated;
