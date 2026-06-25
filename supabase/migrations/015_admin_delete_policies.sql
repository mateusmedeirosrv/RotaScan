-- RotaScan — Completa CRUD do admin: adiciona DELETE nas tabelas que só tinham
-- SELECT/INSERT/UPDATE (RLS nega DELETE por padrão quando não há policy).
-- auditoria é intencionalmente excluída: deve permanecer imutável (somente INSERT/SELECT)
-- para preservar o rastro de auditoria mesmo para admin.
-- Idempotente: pode ser executado múltiplas vezes sem erro.

DROP POLICY IF EXISTS "remocao_admin" ON cidades;
CREATE POLICY "remocao_admin" ON cidades FOR DELETE USING (auth_papel() = 'admin');

DROP POLICY IF EXISTS "remocao_admin" ON galpoes;
CREATE POLICY "remocao_admin" ON galpoes FOR DELETE USING (auth_papel() = 'admin');

DROP POLICY IF EXISTS "remocao_admin" ON bairros;
CREATE POLICY "remocao_admin" ON bairros FOR DELETE USING (auth_papel() = 'admin');

DROP POLICY IF EXISTS "remocao_admin" ON transportadoras;
CREATE POLICY "remocao_admin" ON transportadoras FOR DELETE USING (auth_papel() = 'admin');

DROP POLICY IF EXISTS "remocao_admin" ON colaboradores;
CREATE POLICY "remocao_admin" ON colaboradores FOR DELETE USING (auth_papel() = 'admin');

DROP POLICY IF EXISTS "remocao_admin" ON motoristas;
CREATE POLICY "remocao_admin" ON motoristas FOR DELETE USING (auth_papel() = 'admin');

DROP POLICY IF EXISTS "remocao_admin" ON rotas;
CREATE POLICY "remocao_admin" ON rotas FOR DELETE USING (auth_papel() = 'admin');

DROP POLICY IF EXISTS "remocao_admin" ON operacoes;
CREATE POLICY "remocao_admin" ON operacoes FOR DELETE USING (auth_papel() = 'admin');

DROP POLICY IF EXISTS "remocao_admin" ON manifestos;
CREATE POLICY "remocao_admin" ON manifestos FOR DELETE USING (auth_papel() = 'admin');

DROP POLICY IF EXISTS "remocao_admin" ON manifesto_itens;
CREATE POLICY "remocao_admin" ON manifesto_itens FOR DELETE USING (auth_papel() = 'admin');
