-- Migration 114: novo modo apresentação "SDG dos Gerentes" (/sdg-gerentes) —
-- primeira leva só com o slide "Assuntos Gerais", no mesmo molde do que já
-- existe no SDG Financeiro/SDG Corp Fin, mas com conteúdo PRÓPRIO (não
-- reaproveita o texto do SDG Financeiro) — indicador novo
-- 'assuntos-gerais-gerentes' na mesma tabela `sdg_justificativas`, por
-- unidade (cada gerente escreve o seu, igual o SDG Financeiro).
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE sdg_justificativas DROP CONSTRAINT IF EXISTS sdg_justificativas_indicador_check;
ALTER TABLE sdg_justificativas ADD CONSTRAINT sdg_justificativas_indicador_check
  CHECK (indicador IN (
    'ebitda', 'adm-geral', 'despesa-adm', 'vales', 'multas',
    'vales-financeiros', 'vales-fisicos', 'refugo', 'quebras', 'encontro-contas',
    'assuntos-gerais', 'assuntos-gerais-gerentes'
  ));

NOTIFY pgrst, 'reload schema';
