-- Migration 122: Limpa Pauta (Área Financeira) — descontos que nós cobramos
-- da Ambev e subimos pro sistema deles (Freightech), que aprova ou reprova.
-- Fase 1: só a importação da planilha do Freightech (Segmentos/Categoria/
-- Unidades/Status/Valor solicitado) e o filtro de acompanhamento (Unidade/
-- Ano/Mês). Campos de tratativa manual (equivalentes a Tratativas do
-- Encontro de Contas) entram numa migration futura, quando o usuário pedir.
--
-- `status_freightech` fica livre (sem CHECK) de propósito: só vimos
-- 'EM_ANALISE' e 'CANCELADA_PELO_SOLICITANTE' numa amostra pequena da
-- planilha — o vocabulário completo do Freightech (ex: aprovado/reprovado)
-- ainda não foi confirmado, e travar um CHECK agora só pra descobrir que
-- falta valor quebraria a importação. Mesmo raciocínio pra `segmento`
-- ('ARMAZEM'/'AS' na amostra) e `categoria` (textos variados, ex: "QLP ADM",
-- "Finame") — ambos textos livres vindos direto da planilha.
--
-- `unidade_planilha` guarda o texto original (truncado) da coluna Unidades,
-- pra auditoria de quando o fuzzy-match (`resolverUnidadeFlexivel`) acertar
-- errado. Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS limpa_pauta (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano               int NOT NULL,
  mes               int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  unidade           text NOT NULL REFERENCES unidades(codigo),
  unidade_planilha  text NOT NULL,
  segmento          text NOT NULL,
  categoria         text NOT NULL,
  status_freightech text NOT NULL,
  valor_solicitado  numeric(12,2) NOT NULL,
  criado_por_email  text,
  criado_por_role   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_limpa_pauta_unidade  ON limpa_pauta(unidade);
CREATE INDEX IF NOT EXISTS idx_limpa_pauta_ano_mes   ON limpa_pauta(ano, mes);

ALTER TABLE limpa_pauta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_limpa_pauta" ON limpa_pauta;
CREATE POLICY "leitura_limpa_pauta" ON limpa_pauta
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin' OR unidade = auth_unidade());

DROP POLICY IF EXISTS "admin_insere_limpa_pauta" ON limpa_pauta;
CREATE POLICY "admin_insere_limpa_pauta" ON limpa_pauta
  FOR INSERT TO authenticated
  WITH CHECK (auth_role() = 'admin');

DROP POLICY IF EXISTS "admin_atualiza_limpa_pauta" ON limpa_pauta;
CREATE POLICY "admin_atualiza_limpa_pauta" ON limpa_pauta
  FOR UPDATE TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

DROP POLICY IF EXISTS "admin_exclui_limpa_pauta" ON limpa_pauta;
CREATE POLICY "admin_exclui_limpa_pauta" ON limpa_pauta
  FOR DELETE TO authenticated
  USING (auth_role() = 'admin');

DROP TRIGGER IF EXISTS trg_limpa_pauta_updated_at ON limpa_pauta;
CREATE TRIGGER trg_limpa_pauta_updated_at
  BEFORE UPDATE ON limpa_pauta FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
