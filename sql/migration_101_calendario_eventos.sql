-- Migration 101: eventos do Calendário (Área Financeira > Rotinas >
-- Calendário) — etapa 4. É o que permite marcar RPS (reunião de
-- produtividade semanal), visitas e afins por unidade: "Cascavel tem RPS
-- toda sexta".
--
-- Evento NÃO é rotina, de propósito: não tem OK/NOK e não entra em conta
-- nenhuma. Se virasse rotina, cairia no denominador da aderência e
-- contaminaria o Dashboard de Rotinas, o slide de Rotinas do SDG e a
-- pontuação da Reunião de Resultados.
--
-- Recorrência (`tipo`):
--   * 'unico'   — acontece só em `data_inicio`.
--   * 'semanal' — todo `dia_semana` (0=domingo … 6=sábado).
--   * 'mensal'  — todo dia `dia_mes` (31 cai no último dia do mês).
-- Em 'semanal'/'mensal', `data_inicio` é quando passa a valer e `data_fim`
-- (opcional) quando deixa de valer — assim um RPS encerrado some dos meses
-- novos sem apagar o histórico.
--
-- `unidade` usa a mesma sentinela '*' (= todas as unidades) da migration 100.
--
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS calendario_eventos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo      text NOT NULL,
  descricao   text NOT NULL DEFAULT '',
  unidade     text NOT NULL DEFAULT '*',
  tipo        text NOT NULL CHECK (tipo IN ('unico', 'semanal', 'mensal')),
  dia_semana  int  CHECK (dia_semana IS NULL OR dia_semana BETWEEN 0 AND 6),
  dia_mes     int  CHECK (dia_mes IS NULL OR dia_mes BETWEEN 1 AND 31),
  data_inicio date NOT NULL,
  data_fim    date,
  cor         text NOT NULL DEFAULT 'roxo' CHECK (cor IN ('roxo', 'azul', 'ambar', 'verde')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- Cada tipo exige o seu campo: evento semanal sem dia da semana (ou mensal
  -- sem dia do mês) nunca apareceria no calendário.
  CHECK (tipo <> 'semanal' OR dia_semana IS NOT NULL),
  CHECK (tipo <> 'mensal'  OR dia_mes    IS NOT NULL),
  CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);

COMMENT ON COLUMN calendario_eventos.unidade IS
  'Código da unidade, ou ''*'' pra todas — mesma sentinela da migration 100.';
COMMENT ON COLUMN calendario_eventos.data_inicio IS
  'Evento único: a data dele. Semanal/mensal: a partir de quando vale.';

CREATE INDEX IF NOT EXISTS idx_calendario_eventos_unidade ON calendario_eventos(unidade);

ALTER TABLE calendario_eventos ENABLE ROW LEVEL SECURITY;

-- Mesma divisão das tabelas de rotinas (024/043/100): todo mundo logado vê o
-- calendário, só admin cria/edita evento.
DROP POLICY IF EXISTS "leitura_calendario_eventos" ON calendario_eventos;
CREATE POLICY "leitura_calendario_eventos" ON calendario_eventos
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_calendario_eventos" ON calendario_eventos;
CREATE POLICY "admin_calendario_eventos" ON calendario_eventos
  FOR ALL TO authenticated
  USING (auth_role() = 'admin');

DROP TRIGGER IF EXISTS calendario_eventos_updated_at ON calendario_eventos;
CREATE TRIGGER calendario_eventos_updated_at
  BEFORE UPDATE ON calendario_eventos FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
