-- Migration 074: matrícula da liderança em rv_liderancas — exigida pelo time
-- de Matriz/Folha pra importar o valor de RV na folha de pagamento. Nullable
-- porque cadastros já existentes não têm até reimportar a planilha com a
-- coluna nova. Rodar no SQL Editor do Supabase.

ALTER TABLE rv_liderancas ADD COLUMN IF NOT EXISTS matricula text;

NOTIFY pgrst, 'reload schema';
