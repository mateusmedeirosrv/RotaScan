-- RotaScan — Policies de escrita (INSERT/UPDATE) para RLS
-- Complementa 001_initial_schema.sql, que só tinha policies de SELECT.
-- Idempotente: pode ser executado múltiplas vezes sem erro.

-- ============================================================
-- HELPER: colaborador_id do usuário autenticado
-- ============================================================

CREATE OR REPLACE FUNCTION auth_colaborador_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT id FROM colaboradores WHERE user_id = auth.uid()
$$;

-- Hardening dos helpers existentes (mitiga search_path hijacking em SECURITY DEFINER)
CREATE OR REPLACE FUNCTION auth_papel()
RETURNS papel_usuario LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT papel FROM colaboradores WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION auth_galpao_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT galpao_id FROM colaboradores WHERE user_id = auth.uid()
$$;

-- ============================================================
-- CADASTROS GLOBAIS — escrita restrita a admin
-- ============================================================

DROP POLICY IF EXISTS "escrita_admin" ON cidades;
CREATE POLICY "escrita_admin" ON cidades FOR INSERT WITH CHECK (auth_papel() = 'admin');
DROP POLICY IF EXISTS "atualizacao_admin" ON cidades;
CREATE POLICY "atualizacao_admin" ON cidades FOR UPDATE
  USING (auth_papel() = 'admin') WITH CHECK (auth_papel() = 'admin');

DROP POLICY IF EXISTS "escrita_admin" ON bairros;
CREATE POLICY "escrita_admin" ON bairros FOR INSERT WITH CHECK (auth_papel() = 'admin');
DROP POLICY IF EXISTS "atualizacao_admin" ON bairros;
CREATE POLICY "atualizacao_admin" ON bairros FOR UPDATE
  USING (auth_papel() = 'admin') WITH CHECK (auth_papel() = 'admin');

DROP POLICY IF EXISTS "escrita_admin" ON transportadoras;
CREATE POLICY "escrita_admin" ON transportadoras FOR INSERT WITH CHECK (auth_papel() = 'admin');
DROP POLICY IF EXISTS "atualizacao_admin" ON transportadoras;
CREATE POLICY "atualizacao_admin" ON transportadoras FOR UPDATE
  USING (auth_papel() = 'admin') WITH CHECK (auth_papel() = 'admin');

DROP POLICY IF EXISTS "escrita_admin" ON galpoes;
CREATE POLICY "escrita_admin" ON galpoes FOR INSERT WITH CHECK (auth_papel() = 'admin');
DROP POLICY IF EXISTS "atualizacao_admin" ON galpoes;
CREATE POLICY "atualizacao_admin" ON galpoes FOR UPDATE
  USING (auth_papel() = 'admin') WITH CHECK (auth_papel() = 'admin');

-- colaboradores: papel é campo sensível (privilégio) — escrita restrita a admin.
DROP POLICY IF EXISTS "escrita_admin" ON colaboradores;
CREATE POLICY "escrita_admin" ON colaboradores FOR INSERT WITH CHECK (auth_papel() = 'admin');
DROP POLICY IF EXISTS "atualizacao_admin" ON colaboradores;
CREATE POLICY "atualizacao_admin" ON colaboradores FOR UPDATE
  USING (auth_papel() = 'admin') WITH CHECK (auth_papel() = 'admin');

-- ============================================================
-- MOTORISTAS / ROTAS — admin ou gerente do próprio galpão
-- ============================================================

DROP POLICY IF EXISTS "escrita_admin_gerente" ON motoristas;
CREATE POLICY "escrita_admin_gerente" ON motoristas FOR INSERT
  WITH CHECK (
    auth_papel() = 'admin' OR
    (auth_papel() = 'gerente' AND galpao_id = auth_galpao_id())
  );
DROP POLICY IF EXISTS "atualizacao_admin_gerente" ON motoristas;
CREATE POLICY "atualizacao_admin_gerente" ON motoristas FOR UPDATE
  USING (
    auth_papel() = 'admin' OR
    (auth_papel() = 'gerente' AND galpao_id = auth_galpao_id())
  )
  WITH CHECK (
    auth_papel() = 'admin' OR
    (auth_papel() = 'gerente' AND galpao_id = auth_galpao_id())
  );

DROP POLICY IF EXISTS "escrita_admin_gerente" ON rotas;
CREATE POLICY "escrita_admin_gerente" ON rotas FOR INSERT
  WITH CHECK (
    auth_papel() = 'admin' OR
    (auth_papel() = 'gerente' AND galpao_id = auth_galpao_id())
  );
DROP POLICY IF EXISTS "atualizacao_admin_gerente" ON rotas;
CREATE POLICY "atualizacao_admin_gerente" ON rotas FOR UPDATE
  USING (
    auth_papel() = 'admin' OR
    (auth_papel() = 'gerente' AND galpao_id = auth_galpao_id())
  )
  WITH CHECK (
    auth_papel() = 'admin' OR
    (auth_papel() = 'gerente' AND galpao_id = auth_galpao_id())
  );

DROP POLICY IF EXISTS "escrita_admin_gerente" ON rota_bairros;
CREATE POLICY "escrita_admin_gerente" ON rota_bairros FOR INSERT
  WITH CHECK (
    auth_papel() = 'admin' OR
    (auth_papel() = 'gerente' AND rota_id IN (
      SELECT id FROM rotas WHERE galpao_id = auth_galpao_id()
    ))
  );
DROP POLICY IF EXISTS "atualizacao_admin_gerente" ON rota_bairros;
CREATE POLICY "atualizacao_admin_gerente" ON rota_bairros FOR UPDATE
  USING (
    auth_papel() = 'admin' OR
    (auth_papel() = 'gerente' AND rota_id IN (
      SELECT id FROM rotas WHERE galpao_id = auth_galpao_id()
    ))
  )
  WITH CHECK (
    auth_papel() = 'admin' OR
    (auth_papel() = 'gerente' AND rota_id IN (
      SELECT id FROM rotas WHERE galpao_id = auth_galpao_id()
    ))
  );

-- ============================================================
-- OPERAÇÕES — colaborador cria/edita as próprias; gerente, as do galpão;
-- finalizada é imutável para não-admin (regra de negócio nº 3 do CLAUDE.md)
-- ============================================================

DROP POLICY IF EXISTS "escrita_operacoes" ON operacoes;
CREATE POLICY "escrita_operacoes" ON operacoes FOR INSERT
  WITH CHECK (
    auth_papel() = 'admin' OR
    (auth_papel() = 'gerente' AND galpao_id = auth_galpao_id()) OR
    (auth_papel() = 'colaborador' AND galpao_id = auth_galpao_id() AND colaborador_id = auth_colaborador_id())
  );

DROP POLICY IF EXISTS "atualizacao_operacoes" ON operacoes;
CREATE POLICY "atualizacao_operacoes" ON operacoes FOR UPDATE
  USING (
    auth_papel() = 'admin' OR
    (
      status = 'EM_ANDAMENTO' AND (
        (auth_papel() = 'gerente' AND galpao_id = auth_galpao_id()) OR
        (auth_papel() = 'colaborador' AND galpao_id = auth_galpao_id() AND colaborador_id = auth_colaborador_id())
      )
    )
  )
  WITH CHECK (
    auth_papel() = 'admin' OR
    (auth_papel() = 'gerente' AND galpao_id = auth_galpao_id()) OR
    (auth_papel() = 'colaborador' AND galpao_id = auth_galpao_id() AND colaborador_id = auth_colaborador_id())
  );

-- ============================================================
-- BIPAGENS — colaborador grava as próprias, numa operação EM_ANDAMENTO
-- do seu galpão; edição (sync/override) segue a mesma regra de imutabilidade
-- ============================================================

DROP POLICY IF EXISTS "criacao_bipagem" ON bipagens;
CREATE POLICY "criacao_bipagem" ON bipagens FOR INSERT
  WITH CHECK (
    auth_papel() = 'admin' OR
    (
      colaborador_id = auth_colaborador_id() AND
      operacao_id IN (
        SELECT id FROM operacoes
        WHERE galpao_id = auth_galpao_id() AND status = 'EM_ANDAMENTO'
      )
    )
  );

DROP POLICY IF EXISTS "atualizacao_bipagem" ON bipagens;
CREATE POLICY "atualizacao_bipagem" ON bipagens FOR UPDATE
  USING (
    auth_papel() = 'admin' OR
    (
      colaborador_id = auth_colaborador_id() AND
      operacao_id IN (
        SELECT id FROM operacoes
        WHERE galpao_id = auth_galpao_id() AND status = 'EM_ANDAMENTO'
      )
    )
  )
  WITH CHECK (
    auth_papel() = 'admin' OR
    (
      colaborador_id = auth_colaborador_id() AND
      operacao_id IN (
        SELECT id FROM operacoes
        WHERE galpao_id = auth_galpao_id() AND status = 'EM_ANDAMENTO'
      )
    )
  );

-- ============================================================
-- MANIFESTOS — escrita por quem tem acesso ao galpão da operação
-- ============================================================

DROP POLICY IF EXISTS "escrita_galpao" ON manifestos;
CREATE POLICY "escrita_galpao" ON manifestos FOR INSERT
  WITH CHECK (
    auth_papel() = 'admin' OR
    operacao_id IN (SELECT id FROM operacoes WHERE galpao_id = auth_galpao_id())
  );
DROP POLICY IF EXISTS "atualizacao_galpao" ON manifestos;
CREATE POLICY "atualizacao_galpao" ON manifestos FOR UPDATE
  USING (
    auth_papel() = 'admin' OR
    operacao_id IN (SELECT id FROM operacoes WHERE galpao_id = auth_galpao_id())
  )
  WITH CHECK (
    auth_papel() = 'admin' OR
    operacao_id IN (SELECT id FROM operacoes WHERE galpao_id = auth_galpao_id())
  );

DROP POLICY IF EXISTS "escrita_galpao" ON manifesto_itens;
CREATE POLICY "escrita_galpao" ON manifesto_itens FOR INSERT
  WITH CHECK (
    auth_papel() = 'admin' OR
    manifesto_id IN (
      SELECT m.id FROM manifestos m
      JOIN operacoes o ON o.id = m.operacao_id
      WHERE o.galpao_id = auth_galpao_id()
    )
  );
DROP POLICY IF EXISTS "atualizacao_galpao" ON manifesto_itens;
CREATE POLICY "atualizacao_galpao" ON manifesto_itens FOR UPDATE
  USING (
    auth_papel() = 'admin' OR
    manifesto_id IN (
      SELECT m.id FROM manifestos m
      JOIN operacoes o ON o.id = m.operacao_id
      WHERE o.galpao_id = auth_galpao_id()
    )
  )
  WITH CHECK (
    auth_papel() = 'admin' OR
    manifesto_id IN (
      SELECT m.id FROM manifestos m
      JOIN operacoes o ON o.id = m.operacao_id
      WHERE o.galpao_id = auth_galpao_id()
    )
  );

-- ============================================================
-- AUDITORIA — só o próprio usuário autenticado pode registrar a própria
-- ação (impede forjar usuario_id/tipo/dados de terceiros). Inserções de
-- sistema (sem ator humano) devem usar a service role, que ignora RLS.
-- ============================================================

DROP POLICY IF EXISTS "insercao_system" ON auditoria;
DROP POLICY IF EXISTS "insercao_autenticados" ON auditoria;
CREATE POLICY "insercao_autenticados" ON auditoria FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND usuario_id = auth.uid());

-- ============================================================
-- CONFIGURAÇÕES — esconde o hash da senha de override de quem não é admin.
-- A verificação da senha passa a ser feita via RPC (abaixo), que nunca
-- expõe o hash ao cliente, em vez de SELECT direto na tabela.
-- ============================================================

DROP POLICY IF EXISTS "leitura_autenticados" ON configuracoes;
CREATE POLICY "leitura_autenticados" ON configuracoes FOR SELECT
  USING (auth.role() = 'authenticated' AND chave <> 'senha_override');

DROP POLICY IF EXISTS "leitura_admin_senha_override" ON configuracoes;
CREATE POLICY "leitura_admin_senha_override" ON configuracoes FOR SELECT
  USING (auth_papel() = 'admin');

CREATE OR REPLACE FUNCTION verificar_senha_override(senha_tentativa TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT valor = crypt(senha_tentativa, valor)
  FROM configuracoes
  WHERE chave = 'senha_override'
$$;

REVOKE ALL ON FUNCTION verificar_senha_override(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verificar_senha_override(TEXT) TO authenticated;
