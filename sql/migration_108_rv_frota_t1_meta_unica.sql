-- Migration 108: meta e peso dos 4 indicadores importados da RV de Frota T1
-- (Ad. Checklist, Ad. Milimetragem, Indisponibilidade Manutenção,
-- Disponibilidade Empilhadeira) passam a ser ÚNICOS — uma linha só por
-- indicador, valendo igual pras unidades que participam dele (Estância/
-- Ponta Grossa/CDR Bahia, conforme o caso — ver `OPERACOES_FROTA_T1` em
-- rv-frota-t1.ts), em vez de uma linha por unidade (migration 107).
--
-- Recria as 4 tabelas de meta do zero (formato de PK muda de `unidade` pra
-- singleton `id boolean`, não dá pra fazer ALTER) — mesmo padrão de
-- rv_desconto_civf_meta/rv_desconto_stress_test_meta. As 4 tabelas de
-- resultado (resultados_ad_checklist_frota etc.) não mudam.
--
-- Rodar no SQL Editor do Supabase.

DROP TABLE IF EXISTS rv_frota_ad_checklist_meta;
DROP TABLE IF EXISTS rv_frota_ad_milimetragem_meta;
DROP TABLE IF EXISTS rv_frota_indisp_manutencao_meta;
DROP TABLE IF EXISTS rv_frota_disp_empilhadeira_meta;

CREATE TABLE rv_frota_ad_checklist_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_pct   numeric(5,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rv_frota_ad_milimetragem_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_pct   numeric(5,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rv_frota_indisp_manutencao_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_pct   numeric(5,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rv_frota_disp_empilhadeira_meta (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  meta_valor numeric(12,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS + trigger de updated_at — mesmo padrão de rv_desconto_civf_meta pras 4 tabelas.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'rv_frota_ad_checklist_meta', 'rv_frota_ad_milimetragem_meta',
    'rv_frota_indisp_manutencao_meta', 'rv_frota_disp_empilhadeira_meta'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS "admin_%s" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "admin_%s" ON %I FOR ALL TO authenticated USING (auth_role() = ''admin'' OR auth_unidade() = ''AMBEV'')',
      t, t
    );

    EXECUTE format('DROP POLICY IF EXISTS "leitura_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "leitura_%s" ON %I FOR SELECT TO authenticated USING (true)', t, t);

    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t, t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
