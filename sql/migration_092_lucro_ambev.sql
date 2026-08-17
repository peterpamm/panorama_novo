-- Migration 092: Lucro (SDG Corp Fin > aba Lucro) — o lucro que a Ambev paga
-- por unidade, baseado no volume de bebida entregue (Volume Atual × R$/HL),
-- importado de uma planilha própria da Ambev. Conteúdo exclusivo da
-- apresentação/gestão corporativa — só o dono acessa (mesma trava de tudo
-- em SDG Corp Fin, ver App.tsx `donoApenas`).
--
-- `negocio` vem direto do prefixo da coluna "Vigencia" da planilha (ex:
-- "ROTA_2_3_2026" → negócio "ROTA", mês 3, ano 2026) — hoje só ROTA e AS,
-- Armazém entra depois numa planilha própria, sem precisar de migration
-- nova (é só um valor de texto, não uma lista fixa).
--
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS lucro_ambev (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  negocio    text NOT NULL,
  ano        int  NOT NULL,
  mes        int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  volume     numeric NOT NULL DEFAULT 0,
  valor_hl   numeric NOT NULL DEFAULT 0,
  -- Lucro vem pronto da planilha da Ambev (não recalculado aqui) — evita
  -- diferença de centavos por arredondamento do R$/HL na fonte.
  lucro      numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, negocio, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_lucro_ambev_periodo ON lucro_ambev(ano, mes);

ALTER TABLE lucro_ambev ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dono_lucro_ambev" ON lucro_ambev;
CREATE POLICY "dono_lucro_ambev" ON lucro_ambev
  FOR ALL TO authenticated
  USING (auth_dono())
  WITH CHECK (auth_dono());

DROP TRIGGER IF EXISTS trg_lucro_ambev_updated_at ON lucro_ambev;
CREATE TRIGGER trg_lucro_ambev_updated_at
  BEFORE UPDATE ON lucro_ambev FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
