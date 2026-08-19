-- Migration 106: exceção de dia pra um evento do Calendário (Área
-- Financeira > Rotinas > Calendário) — permite arrastar uma ocorrência
-- pontual do evento (ex: o RPS desta sexta) pra outro dia do mesmo mês, sem
-- mexer no cadastro recorrente (nas semanas seguintes continua caindo na
-- sexta normal). Mesma ideia de `rotinas_financeiras_ajuste_dia` (migration
-- 100), mas aqui `dia_original` é obrigatório: um evento semanal pode ter
-- várias ocorrências no mesmo mês (várias sextas), então precisa dizer QUAL
-- delas está sendo movida — a rotina só vence uma vez por mês, não precisa
-- dessa distinção.
--
-- Sem `permanente` (diferente da rotina): mover um evento é sempre uma
-- exceção pontual dessa ocorrência. Se o dia certo da recorrência mudou de
-- vez (toda sexta virou toda quinta), o jeito é editar o evento mesmo, não
-- empilhar exceção — não faz sentido nesse caso.
--
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS calendario_eventos_ajuste_dia (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id     uuid NOT NULL REFERENCES calendario_eventos(id) ON DELETE CASCADE,
  -- Código da unidade, ou '*' pra valer em todas as unidades do evento
  -- (mesma sentinela de sempre) — só importa de fato quando o evento tem
  -- mais de uma unidade; com uma só, tanto faz.
  unidade       text NOT NULL DEFAULT '*',
  ano           int  NOT NULL,
  mes           int  NOT NULL,
  dia_original  int  NOT NULL CHECK (dia_original BETWEEN 1 AND 31),
  dia_novo      int  NOT NULL CHECK (dia_novo BETWEEN 1 AND 31),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evento_id, unidade, ano, mes, dia_original)
);

CREATE INDEX IF NOT EXISTS idx_calendario_eventos_ajuste_dia_evento ON calendario_eventos_ajuste_dia(evento_id);

ALTER TABLE calendario_eventos_ajuste_dia ENABLE ROW LEVEL SECURITY;

-- Mesma divisão do evento em si (migration 101): todo mundo logado vê, só admin arrasta/ajusta.
DROP POLICY IF EXISTS "leitura_calendario_eventos_ajuste_dia" ON calendario_eventos_ajuste_dia;
CREATE POLICY "leitura_calendario_eventos_ajuste_dia" ON calendario_eventos_ajuste_dia
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_calendario_eventos_ajuste_dia" ON calendario_eventos_ajuste_dia;
CREATE POLICY "admin_calendario_eventos_ajuste_dia" ON calendario_eventos_ajuste_dia
  FOR ALL TO authenticated
  USING (auth_role() = 'admin');

NOTIFY pgrst, 'reload schema';
