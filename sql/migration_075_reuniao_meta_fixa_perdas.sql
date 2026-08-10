-- Meta fixa opcional pra indicadores da Reunião de Resultados com fonte
-- 'perdas' — quando preenchida, substitui a meta do Painel de Perdas
-- (metas_perdas_indicadores/12) só na apuração da Reunião, sem mexer em
-- nada do Painel de Perdas/RV. Ex: Indisponibilidade da Distribuição tem
-- orçamento de desconto > 0, mas na Reunião (reconhecimento) a meta
-- combinada é 0 — qualquer desconto conta contra.
ALTER TABLE reuniao_resultados_indicadores ADD COLUMN IF NOT EXISTS meta_fixa numeric(14,2);

NOTIFY pgrst, 'reload schema';
