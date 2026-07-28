-- Migration 043: Rotinas Financeiras passam a ser visíveis (só leitura) pra
-- qualquer usuário logado — antes só admin enxergava a área inteira. Edição
-- (marcar OK/NOK, cadastro de rotinas, lançamento em massa) continua só pra
-- admin, que é quem já tem a policy "FOR ALL" nas duas tabelas. Rodar no SQL
-- Editor do Supabase.

DROP POLICY IF EXISTS "leitura_rotinas_financeiras" ON rotinas_financeiras;
CREATE POLICY "leitura_rotinas_financeiras" ON rotinas_financeiras
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "leitura_rotinas_financeiras_status" ON rotinas_financeiras_status;
CREATE POLICY "leitura_rotinas_financeiras_status" ON rotinas_financeiras_status
  FOR SELECT TO authenticated
  USING (true);

NOTIFY pgrst, 'reload schema';
