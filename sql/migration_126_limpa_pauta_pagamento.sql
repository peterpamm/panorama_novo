-- Migration 126: Limpa Pauta — rastreio de pagamento parcial da Ambev
-- (às vezes o valor solicitado não é pago por completo, ou é pago num mês
-- diferente da competência original — por isso Mês/Ano de pagamento
-- separados da competência em `ano`/`mes`). Edição admin-only, mesma trava
-- das outras colunas (sem function nova — já existe a policy de UPDATE
-- admin da migration_122).

ALTER TABLE limpa_pauta
  ADD COLUMN IF NOT EXISTS valor_pago     numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mes_pagamento  int CHECK (mes_pagamento BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS ano_pagamento  int;

NOTIFY pgrst, 'reload schema';
