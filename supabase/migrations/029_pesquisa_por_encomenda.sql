-- RotaScan — Pesquisa: o campo de texto busca no código bipado E em todas as
-- colunas da encomenda (planilha do Recebimento: romaneio, motorista, placa,
-- remetente, Nro. Entrega, destinatário, telefone, prazo, situação, CEP,
-- endereço, ponto de referência, bairro, cidade, região, nota fiscal, pedido).
-- Idempotente.
--
-- Uma bipagem pertence a uma encomenda quando:
--   (1) é a própria bipagem CONFERENCIA (encomenda_id), ou o mesmo código foi
--       vinculado na Conferência (mesma transportadora); ou
--   (2) o código é igual ao Nro. Entrega ou ao Pedido da encomenda.
--
-- Retorna SETOF bipagens: o PostgREST aplica por cima os demais filtros
-- (tipo, transportadora, rota, datas...), ordenação, paginação e contagem.
-- SECURITY INVOKER: respeita o RLS do galpão.

CREATE OR REPLACE FUNCTION pesquisar_bipagens(p_termo TEXT)
RETURNS SETOF bipagens
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp AS $$
  WITH termo AS (
    SELECT '%' || replace(replace(replace(lower(trim(p_termo)), '\', '\\'), '%', '\%'), '_', '\_') || '%' AS padrao
  ),
  enc AS (
    SELECT e.id, e.transportadora_id, e.nr_entrega, e.pedido
    FROM encomendas e, termo
    WHERE e.busca LIKE termo.padrao
  ),
  codigos AS (
    SELECT b.transportadora_id, b.codigo
    FROM bipagens b
    JOIN enc ON enc.id = b.encomenda_id
    WHERE b.tipo_evento = 'CONFERENCIA'
    UNION
    SELECT transportadora_id, nr_entrega FROM enc WHERE nr_entrega IS NOT NULL
    UNION
    SELECT transportadora_id, pedido FROM enc WHERE pedido IS NOT NULL
  )
  SELECT b.*
  FROM bipagens b
  WHERE b.id IN (
    SELECT b1.id FROM bipagens b1, termo WHERE b1.codigo ILIKE termo.padrao
    UNION
    SELECT b2.id FROM bipagens b2
    JOIN codigos c ON c.transportadora_id = b2.transportadora_id AND c.codigo = b2.codigo
  );
$$;

REVOKE ALL ON FUNCTION pesquisar_bipagens(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pesquisar_bipagens(TEXT) TO authenticated;
