-- Migration 103: Pagamento da Reunião Resultados — cadastro das lideranças
-- (nome + número do cartão Extratta) que recebem o prêmio de quem vencer o
-- mês em cada um dos 6 setores, e o valor único do prêmio.
--
-- Uma linha por unidade×negócio×setor×pessoa — negócio só varia (ROTA/ARM)
-- pra Camaçari fora do Financeiro, mesma régua de `unidadesParticipaveis`
-- (reuniao-resultados.ts). Mais de uma pessoa na mesma unidade×negócio×setor
-- = o prêmio daquele setor é dividido entre elas (ver `calcularPagamentos`,
-- reuniao-pagamento.ts).
--
-- 'empurrada' é o 7º valor aceito em `setor`, além dos 6 setores reais da
-- Reunião Resultados — rótulo próprio de Ponta Grossa/Estância (a única
-- operação dessas duas unidades, sem "Distribuição" tradicional), mas cujo
-- VENCEDOR do mês continua saindo do ranking do setor 'distribuicao' — é um
-- alias de cadastro/exibição pra ele, não um setor com ranking próprio (ver
-- `setorCompativel`, reuniao-pagamento.ts).
--
-- Dado sensível (cartão/conta de pagamento) — só admin lê e escreve, nunca
-- exposto por unidade (diferente de rotinas/calendário, que são de leitura
-- geral). A rota também é admin-only (App.tsx, pagina 'reuniao_pagamento').
--
-- Rodar no SQL Editor do Supabase (idempotente — pode rodar de novo mesmo
-- quem já tinha rodado a versão sem 'empurrada', o bloco ALTER corrige a
-- constraint numa tabela já existente).

CREATE TABLE IF NOT EXISTS reuniao_pagamento_liderancas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade         text NOT NULL REFERENCES unidades(codigo),
  negocio         text NOT NULL DEFAULT 'CONS' CHECK (negocio IN ('CONS', 'ROTA', 'ARM')),
  setor           text NOT NULL CONSTRAINT reuniao_pagamento_liderancas_setor_check
                     CHECK (setor IN ('financeiro', 'gente', 'frota', 'seguranca', 'distribuicao', 'armazem', 'empurrada')),
  nome            text NOT NULL,
  numero_extratta text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, negocio, setor, nome)
);

-- Tabela já existia de uma versão anterior desta migration (sem 'empurrada')
-- — corrige a constraint sem precisar recriar a tabela.
ALTER TABLE reuniao_pagamento_liderancas DROP CONSTRAINT IF EXISTS reuniao_pagamento_liderancas_setor_check;
ALTER TABLE reuniao_pagamento_liderancas ADD CONSTRAINT reuniao_pagamento_liderancas_setor_check
  CHECK (setor IN ('financeiro', 'gente', 'frota', 'seguranca', 'distribuicao', 'armazem', 'empurrada'));

ALTER TABLE reuniao_pagamento_liderancas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_reuniao_pagamento_liderancas" ON reuniao_pagamento_liderancas;
CREATE POLICY "admin_reuniao_pagamento_liderancas" ON reuniao_pagamento_liderancas
  FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

DROP TRIGGER IF EXISTS reuniao_pagamento_liderancas_updated_at ON reuniao_pagamento_liderancas;
CREATE TRIGGER reuniao_pagamento_liderancas_updated_at
  BEFORE UPDATE ON reuniao_pagamento_liderancas FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Valor único do prêmio (R$200 por setor vencido, dividido se houver mais de
-- uma liderança cadastrada) — singleton, mesmo padrão de rv_armazem_quebras_meta.
CREATE TABLE IF NOT EXISTS reuniao_pagamento_premio (
  id         boolean PRIMARY KEY DEFAULT true CHECK (id),
  valor      numeric(10, 2) NOT NULL DEFAULT 200.00,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO reuniao_pagamento_premio (id, valor) VALUES (true, 200.00)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE reuniao_pagamento_premio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_reuniao_pagamento_premio" ON reuniao_pagamento_premio;
CREATE POLICY "admin_reuniao_pagamento_premio" ON reuniao_pagamento_premio
  FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

DROP TRIGGER IF EXISTS reuniao_pagamento_premio_updated_at ON reuniao_pagamento_premio;
CREATE TRIGGER reuniao_pagamento_premio_updated_at
  BEFORE UPDATE ON reuniao_pagamento_premio FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
