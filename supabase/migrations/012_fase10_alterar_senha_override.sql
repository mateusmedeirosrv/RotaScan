-- RotaScan — Fase 10: troca de senha de override pelo admin
-- Idempotente: pode ser executado múltiplas vezes sem erro.
--
-- SECURITY DEFINER porque precisa chamar crypt(...)/gen_salt('bf') do
-- pgcrypto com search_path controlado (mesmo padrão de
-- verificar_senha_override, 006_funcoes_bipagem_auditoria.sql). Como esse
-- modo ignora a RLS, a checagem de papel é feita manualmente dentro da
-- função — não dá para confiar só na policy de UPDATE de configuracoes.

CREATE OR REPLACE FUNCTION alterar_senha_override(p_nova_senha TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp AS $$
BEGIN
  IF auth_papel() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a senha de override.';
  END IF;

  UPDATE configuracoes
  SET valor = crypt(p_nova_senha, gen_salt('bf')),
      atualizado_em = now(),
      atualizado_por = auth.uid()
  WHERE chave = 'senha_override';

  INSERT INTO auditoria (tipo, descricao, usuario_id)
  VALUES ('senha_override_alterada', 'Senha de override alterada pelo admin.', auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION alterar_senha_override(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alterar_senha_override(TEXT) TO authenticated;
