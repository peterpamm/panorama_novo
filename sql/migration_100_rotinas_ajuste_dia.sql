-- Migration 100: ajustes de dia das rotinas financeiras — etapa 3 do
-- Calendário (Área Financeira > Rotinas > Calendário). É o que grava o
-- "arrastei o chip pra outro dia": o cadastro (prazo_tipo/prazo_dia,
-- migration 099) continua sendo a regra geral, e cada linha aqui é uma
-- exceção por cima dela.
--
-- Os dois interruptores do dialog de soltar viram duas colunas:
--   * `unidade`   — código da unidade, ou '*' pra "todas as unidades".
--                   É sentinela mesmo (sem FK): com NULL, o UNIQUE do
--                   Postgres trataria cada linha como distinta e deixaria
--                   duplicar o mesmo ajuste.
--   * `permanente`— false = só no mês (ano/mes) em que foi arrastado;
--                   true  = vale desse mês EM DIANTE (ano/mes viram a
--                   vigência inicial). Guardar a vigência em vez de
--                   sobrescrever preserva o histórico: meses passados
--                   continuam mostrando o dia que valia na época.
--
-- Qual ajuste vence quando mais de um se aplica está em
-- `rotina-ajuste-dia.ts` (com testes), não no banco.
--
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS rotinas_financeiras_ajuste_dia (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotina_id  uuid NOT NULL REFERENCES rotinas_financeiras(id) ON DELETE CASCADE,
  unidade    text NOT NULL DEFAULT '*',
  ano        int  NOT NULL,
  mes        int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  dia        int  NOT NULL CHECK (dia BETWEEN 1 AND 31),
  permanente boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rotina_id, unidade, ano, mes, permanente)
);

COMMENT ON COLUMN rotinas_financeiras_ajuste_dia.unidade IS
  'Código da unidade, ou ''*'' pra todas — sentinela, sem FK (ver o UNIQUE acima).';
COMMENT ON COLUMN rotinas_financeiras_ajuste_dia.permanente IS
  'false = vale só no mês ano/mes; true = ano/mes é a vigência inicial e o ajuste vale desse mês em diante.';

CREATE INDEX IF NOT EXISTS idx_rotinas_ajuste_dia_rotina ON rotinas_financeiras_ajuste_dia(rotina_id);

ALTER TABLE rotinas_financeiras_ajuste_dia ENABLE ROW LEVEL SECURITY;

-- Mesma divisão das outras tabelas de rotinas (migrations 024/043): todo
-- mundo logado enxerga o calendário, só admin arrasta.
DROP POLICY IF EXISTS "leitura_rotinas_ajuste_dia" ON rotinas_financeiras_ajuste_dia;
CREATE POLICY "leitura_rotinas_ajuste_dia" ON rotinas_financeiras_ajuste_dia
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_rotinas_ajuste_dia" ON rotinas_financeiras_ajuste_dia;
CREATE POLICY "admin_rotinas_ajuste_dia" ON rotinas_financeiras_ajuste_dia
  FOR ALL TO authenticated
  USING (auth_role() = 'admin');

DROP TRIGGER IF EXISTS rotinas_financeiras_ajuste_dia_updated_at ON rotinas_financeiras_ajuste_dia;
CREATE TRIGGER rotinas_financeiras_ajuste_dia_updated_at
  BEFORE UPDATE ON rotinas_financeiras_ajuste_dia FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
