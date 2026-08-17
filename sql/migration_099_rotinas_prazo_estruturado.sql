-- Migration 099: prazo estruturado das rotinas financeiras — etapa 1 do
-- Calendário de Rotinas (Área Financeira > Rotinas). O `prazo` da migration
-- 024 continua sendo o texto livre que aparece na tela ("Dia 10",
-- "4º dia útil", "1 dia após envio da matriz"); as duas colunas novas são a
-- versão que a máquina entende, pra saber em que dia do mês desenhar a
-- rotina no calendário.
--
-- `prazo_tipo` = 'sem_data' é o padrão de propósito: rotina cujo prazo
-- depende de outro evento não tem dia nenhum, e aparece na lista "sem data
-- definida" ao lado do calendário em vez de cair num dia chutado. O
-- pré-preenchimento a partir do texto é feito na tela (Cadastro > "Sugerir
-- prazos"), com revisão humana — não aqui, porque interpretar o texto em SQL
-- seria pior e sem teste.
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE rotinas_financeiras
  ADD COLUMN IF NOT EXISTS prazo_tipo text NOT NULL DEFAULT 'sem_data'
    CHECK (prazo_tipo IN ('dia_fixo', 'dia_util', 'sem_data')),
  ADD COLUMN IF NOT EXISTS prazo_dia int
    CHECK (prazo_dia IS NULL OR prazo_dia BETWEEN 1 AND 31);

COMMENT ON COLUMN rotinas_financeiras.prazo_tipo IS
  'Como ler prazo_dia: dia_fixo = dia do mês (31 = último dia); dia_util = n-ésimo dia útil (seg-sex, sem feriado); sem_data = não vai pro calendário.';
COMMENT ON COLUMN rotinas_financeiras.prazo_dia IS
  'Dia do mês (dia_fixo) ou o n-ésimo dia útil (dia_util). NULL quando prazo_tipo = sem_data.';

NOTIFY pgrst, 'reload schema';
