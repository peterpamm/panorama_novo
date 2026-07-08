-- ============================================================
-- MIGRAÇÃO 003 — corrige renomear_unidade_codigo pra também
-- servir de MESCLAGEM quando o código novo já existe (ex: você
-- já tinha cadastrado "PRAIA_GRANDE" como unidade nova, mas
-- existem lançamentos antigos importados sob o código "LITORAL"
-- referentes à mesma unidade).
--
-- Antes (migração 002): só funcionava se o código novo NÃO
-- existisse ainda (inserção falhava com violação de unique se já
-- existisse). Agora: se já existir, migra os lançamentos da
-- unidade antiga pro código novo, descartando (mantendo o que já
-- está na unidade principal) qualquer lançamento que colida no
-- mesmo negócio/ano/conta — e remove a unidade antiga ao final.
--
-- Rode isso no SQL Editor do Supabase.
-- ============================================================

CREATE OR REPLACE FUNCTION renomear_unidade_codigo(p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM unidades WHERE codigo = p_novo) THEN
    INSERT INTO unidades (nome, codigo, nome_ginfo)
    SELECT nome, p_novo, nome_ginfo FROM unidades WHERE codigo = p_antigo;
  END IF;

  -- migra só os lançamentos que não colidem com algo que a unidade
  -- principal já tenha pro mesmo negócio/ano/conta; o que colide fica
  -- pra trás (a versão da unidade principal é a que vale) e é
  -- descartado pela limpeza abaixo.
  UPDATE dre_lancamentos d
  SET unidade = p_novo
  WHERE unidade = p_antigo
    AND NOT EXISTS (
      SELECT 1 FROM dre_lancamentos d2
      WHERE d2.unidade = p_novo AND d2.negocio = d.negocio AND d2.ano = d.ano AND d2.conta_codigo = d.conta_codigo
    );
  DELETE FROM dre_lancamentos WHERE unidade = p_antigo;

  UPDATE metas m
  SET unidade = p_novo
  WHERE unidade = p_antigo
    AND NOT EXISTS (
      SELECT 1 FROM metas m2
      WHERE m2.unidade = p_novo AND m2.negocio = m.negocio AND m2.ano = m.ano AND m2.codigo = m.codigo AND m2.mes = m.mes
    );
  DELETE FROM metas WHERE unidade = p_antigo;

  DELETE FROM unidades WHERE codigo = p_antigo;
END;
$$;

-- ------------------------------------------------------------
-- Fix pontual: mescla o que foi importado como "LITORAL" pra
-- dentro da unidade "Praia Grande" (ajuste o código do segundo
-- parâmetro se o código que você cadastrou for diferente de
-- PRAIA_GRANDE — confira em Administração > Unidades).
-- ------------------------------------------------------------
-- SELECT renomear_unidade_codigo('LITORAL', 'PRAIA_GRANDE');
