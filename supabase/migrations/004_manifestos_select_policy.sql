-- ============================================================
-- MANIFESTOS — faltava policy de SELECT (só havia INSERT/UPDATE em
-- 002_rls_write_policies.sql). Sem ela, `.insert().select().single()`
-- não consegue ler a linha recém-criada via RETURNING (RLS também
-- filtra RETURNING pela policy de SELECT) e o PostgREST desfaz o
-- insert por não encontrar a linha esperada — manifesto nunca persiste.
-- ============================================================

DROP POLICY IF EXISTS "leitura_por_galpao" ON manifestos;
CREATE POLICY "leitura_por_galpao" ON manifestos
  FOR SELECT USING (
    auth_papel() = 'admin' OR
    operacao_id IN (SELECT id FROM operacoes WHERE galpao_id = auth_galpao_id())
  );
