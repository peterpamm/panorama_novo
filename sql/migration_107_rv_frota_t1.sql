-- Migration 107: indicadores novos da RV de Frota, específicos das 3
-- lideranças T1 — Estância, Ponta Grossa (rota/empurrada) e CDR Bahia
-- (armazém, negócio ARM de Camaçari) — ver `OPERACOES_FROTA_T1`,
-- rv-frota-t1.ts.
--
-- Custos Gerais (DRE conta 113) — AVR direto do DRE vs meta do Orçamento,
-- mesmo mecanismo de Manutenção/Pneus/Diesel (só restrito às 3 unidades em
-- vez da frota inteira) — sem tabela própria aqui, o peso mora junto deles
-- em rv_frota_pesos_dre (id '113'). Se você já rodou uma versão anterior
-- desta migration, este bloco derruba a tabela `rv_frota_custos_gerais_meta`
-- que ela criava (não é mais usada).
--
-- Aderência ao Checklist / Aderência à Milimetragem / Indisponibilidade
-- Manutenção (%) e Disponibilidade Empilhadeira (R$, meta é zero desconto) —
-- resultado mensal importado (aba RESULTADO da planilha de Frota, mesmo
-- lugar de Desconto CIVF/Stress Test) + meta/peso por unidade:
--   * Aderência Checklist e Aderência Milimetragem: as 3 unidades.
--   * Indisponibilidade Manutenção: só Estância e Ponta Grossa.
--   * Disponibilidade Empilhadeira: só CDR Bahia.
-- Mesma tabela pra todo mundo (restrição de quem participa é o cadastro de
-- meta ter ou não uma linha pra aquela unidade, não uma CHECK constraint).
--
-- Rodar no SQL Editor do Supabase.

DROP TABLE IF EXISTS rv_frota_custos_gerais_meta;

CREATE TABLE IF NOT EXISTS rv_frota_ad_checklist_meta (
  unidade    text PRIMARY KEY REFERENCES unidades(codigo),
  meta_pct   numeric(5,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rv_frota_ad_milimetragem_meta (
  unidade    text PRIMARY KEY REFERENCES unidades(codigo),
  meta_pct   numeric(5,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rv_frota_indisp_manutencao_meta (
  unidade    text PRIMARY KEY REFERENCES unidades(codigo),
  meta_pct   numeric(5,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rv_frota_disp_empilhadeira_meta (
  unidade    text PRIMARY KEY REFERENCES unidades(codigo),
  meta_valor numeric(12,2) NOT NULL DEFAULT 0,
  peso       numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resultados_ad_checklist_frota (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL,
  valor      numeric(5,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE TABLE IF NOT EXISTS resultados_ad_milimetragem_frota (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL,
  valor      numeric(5,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE TABLE IF NOT EXISTS resultados_indisp_manutencao_frota (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL,
  valor      numeric(5,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

CREATE TABLE IF NOT EXISTS resultados_disp_empilhadeira_frota (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL,
  valor      numeric(12,2) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes)
);

-- RLS + trigger de updated_at — mesmo padrão de rv_dto_t1_meta/resultados_desconto_civf pras 8 tabelas.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'rv_frota_ad_checklist_meta', 'rv_frota_ad_milimetragem_meta',
    'rv_frota_indisp_manutencao_meta', 'rv_frota_disp_empilhadeira_meta',
    'resultados_ad_checklist_frota', 'resultados_ad_milimetragem_frota',
    'resultados_indisp_manutencao_frota', 'resultados_disp_empilhadeira_frota'
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
