-- RotaScan — Entrega única por encomenda. Idempotente.
--
-- Na Conferência uma encomenda recebe vários códigos (QR Code, código de
-- barras da NF, etiqueta...). A unicidade por código (transportadora +
-- código + tipo) deixava cada um desses códigos gerar uma ENTREGA própria
-- para o MESMO volume. Regra nova: na ENTREGA, Nr. Entrega + Nota Fiscal +
-- Volume são únicos — só pode haver uma entrega ativa por encomenda.
--
-- chave_encomenda = 'nr_entrega|nota_fiscal|vol_nr' da encomenda resolvida
-- pelo código (mesma prioridade de encomendas_por_codigos: vínculo da
-- Conferência; depois Nro. Entrega / Pedido iguais ao código). Códigos sem
-- encomenda localizada ficam com chave NULL e seguem só a regra por código.
-- O modo "Duplicado" da Entrega (duplicado = true) continua liberado.

ALTER TABLE bipagens ADD COLUMN IF NOT EXISTS chave_encomenda TEXT;

CREATE OR REPLACE FUNCTION chave_encomenda_do_codigo(p_transportadora_id UUID, p_codigo TEXT)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
  SELECT coalesce(x.nr_entrega, '') || '|' || coalesce(x.nota_fiscal, '') || '|' || coalesce(x.vol_nr::text, '')
  FROM (
    SELECT e.nr_entrega, e.nota_fiscal, e.vol_nr, e.importado_em, 1 AS prioridade
    FROM bipagens c
    JOIN encomendas e ON e.id = c.encomenda_id
    WHERE c.tipo_evento = 'CONFERENCIA'
      AND c.transportadora_id = p_transportadora_id
      AND c.codigo = p_codigo
    UNION ALL
    SELECT e.nr_entrega, e.nota_fiscal, e.vol_nr, e.importado_em, 2 AS prioridade
    FROM encomendas e
    WHERE e.transportadora_id = p_transportadora_id
      AND (e.nr_entrega = p_codigo OR e.pedido = p_codigo)
  ) x
  WHERE x.nr_entrega IS NOT NULL OR x.nota_fiscal IS NOT NULL
  ORDER BY x.prioridade, x.importado_em DESC, x.vol_nr NULLS LAST
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION chave_encomenda_do_codigo(UUID, TEXT) FROM PUBLIC;

-- Preenche a chave antes dos demais triggers (ordem alfabética:
-- trg_bipagem_chave_encomenda < trg_bipagem_transportadora < trg_ciclo_...).
CREATE OR REPLACE FUNCTION preencher_chave_encomenda()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.tipo_evento IN ('ENTREGA', 'RETORNO') THEN
    NEW.chave_encomenda := chave_encomenda_do_codigo(NEW.transportadora_id, NEW.codigo);
  ELSE
    NEW.chave_encomenda := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bipagem_chave_encomenda ON bipagens;
CREATE TRIGGER trg_bipagem_chave_encomenda
BEFORE INSERT ON bipagens
FOR EACH ROW EXECUTE FUNCTION preencher_chave_encomenda();

-- Ciclo Entrega/Retorno também por encomenda: o Retorno bipado com outro
-- código da mesma encomenda fecha a Entrega ativa dela (e vice-versa).
CREATE OR REPLACE FUNCTION gerenciar_ciclo_entrega_retorno()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_entrega_id UUID;
BEGIN
  IF NEW.tipo_evento = 'RETORNO' THEN
    SELECT id INTO v_entrega_id FROM bipagens
    WHERE transportadora_id = NEW.transportadora_id
      AND tipo_evento = 'ENTREGA' AND NOT ciclo_fechado
      AND (codigo = NEW.codigo OR chave_encomenda = NEW.chave_encomenda)
    ORDER BY (codigo = NEW.codigo) DESC, bipado_em ASC
    LIMIT 1;

    IF v_entrega_id IS NULL THEN
      RAISE EXCEPTION 'Nenhuma entrega ativa encontrada para o código %.', NEW.codigo;
    END IF;

    UPDATE bipagens SET ciclo_fechado = true WHERE id = v_entrega_id;

  ELSIF NEW.tipo_evento = 'ENTREGA' THEN
    UPDATE bipagens SET ciclo_fechado = true
    WHERE transportadora_id = NEW.transportadora_id
      AND tipo_evento = 'RETORNO' AND NOT ciclo_fechado
      AND (codigo = NEW.codigo OR chave_encomenda = NEW.chave_encomenda);
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill das bipagens existentes
UPDATE bipagens
SET chave_encomenda = chave_encomenda_do_codigo(transportadora_id, codigo)
WHERE tipo_evento IN ('ENTREGA', 'RETORNO') AND chave_encomenda IS NULL;

-- Entregas já duplicadas impedem o índice: aborta listando-as para revisão.
DO $$
DECLARE v_lista TEXT;
BEGIN
  SELECT string_agg(chave_encomenda || ' (' || n || 'x)', ', ') INTO v_lista
  FROM (
    SELECT chave_encomenda, count(*) AS n FROM bipagens
    WHERE tipo_evento = 'ENTREGA' AND NOT ciclo_fechado AND NOT duplicado
      AND chave_encomenda IS NOT NULL
    GROUP BY transportadora_id, chave_encomenda HAVING count(*) > 1
  ) d;
  IF v_lista IS NOT NULL THEN
    RAISE EXCEPTION 'Entregas ativas duplicadas por encomenda — exclua as bipagens extras antes: %', v_lista;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS bipagens_entrega_encomenda_ativa_key
  ON bipagens(transportadora_id, chave_encomenda)
  WHERE tipo_evento = 'ENTREGA' AND NOT ciclo_fechado AND NOT duplicado
    AND chave_encomenda IS NOT NULL;
