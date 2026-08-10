-- Migration 088: slide final "Assuntos Gerais" no SDG Financeiro — texto
-- livre (assuntos que precisam de ajuda ou outros temas do setor), sem
-- ligação com o Plano de Ação. Usa a mesma tabela `sdg_justificativas`
-- (campo `pontos_positivos`), só ampliando o indicador aceito.
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE sdg_justificativas DROP CONSTRAINT IF EXISTS sdg_justificativas_indicador_check;
ALTER TABLE sdg_justificativas ADD CONSTRAINT sdg_justificativas_indicador_check
  CHECK (indicador IN (
    'ebitda', 'adm-geral', 'despesa-adm', 'vales', 'multas',
    'vales-financeiros', 'vales-fisicos', 'refugo', 'quebras', 'encontro-contas',
    'assuntos-gerais'
  ));

NOTIFY pgrst, 'reload schema';
