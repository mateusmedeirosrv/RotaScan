-- RotaScan — Registro de advertências aplicadas a motoristas.
-- Documento gerado em PDF pela tela de Motoristas; este registro é o
-- histórico imutável de que a advertência foi emitida (sem UPDATE/DELETE,
-- mesma filosofia de auditoria/operação finalizada).

CREATE TABLE IF NOT EXISTS advertencias (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorista_id   UUID NOT NULL REFERENCES motoristas(id),
  galpao_id      UUID NOT NULL REFERENCES galpoes(id),
  colaborador_id UUID NOT NULL REFERENCES colaboradores(id),
  motivo         TEXT NOT NULL,
  data_vigencia  DATE NOT NULL,
  local          TEXT,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE advertencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_por_galpao" ON advertencias;
CREATE POLICY "leitura_por_galpao" ON advertencias
  FOR SELECT USING (auth_papel() = 'admin' OR galpao_id = auth_galpao_id());

DROP POLICY IF EXISTS "escrita_admin_gerente" ON advertencias;
CREATE POLICY "escrita_admin_gerente" ON advertencias FOR INSERT
  WITH CHECK (
    auth_papel() = 'admin' OR
    (auth_papel() = 'gerente' AND galpao_id = auth_galpao_id())
  );
