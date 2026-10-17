-- ============================================================
-- BIPAGENS — gerente também pode excluir bipagens (botão "Excluir bipagem"
-- da tela de bipagem), de qualquer colaborador do próprio galpão, desde que
-- a operação ainda esteja EM_ANDAMENTO. Colaborador segue excluindo só as
-- próprias; admin, qualquer uma.
-- ============================================================

DROP POLICY IF EXISTS "remocao_bipagem" ON bipagens;
CREATE POLICY "remocao_bipagem" ON bipagens FOR DELETE
  USING (
    auth_papel() = 'admin' OR
    (
      auth_papel() = 'gerente' AND
      operacao_id IN (
        SELECT id FROM operacoes
        WHERE galpao_id = auth_galpao_id() AND status = 'EM_ANDAMENTO'
      )
    ) OR
    (
      colaborador_id = auth_colaborador_id() AND
      operacao_id IN (
        SELECT id FROM operacoes
        WHERE galpao_id = auth_galpao_id() AND status = 'EM_ANDAMENTO'
      )
    )
  );
