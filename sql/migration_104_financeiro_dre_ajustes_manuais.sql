-- Migration 104: Ajustes manuais de Multas/Vales do Financeiro — solução
-- TEMPORÁRIA pro bug atual do DRE, que não está subindo a receita que as
-- unidades recebem da Ambev em multas (contas 137/222) e vales (contas
-- 051/052), fazendo o DRE parecer que ninguém recebeu nada nesses meses.
--
-- NÃO mexe na base do DRE (que é oficial) — é uma correção só de exibição,
-- restrita a Multas/Vales do setor Financeiro, só na Reunião Resultados e na
-- Remuneração Variável (ver `resultadoEMeta` em useReuniaoDados.ts e o uso de
-- `ajustesFinanceiro` em useRvApuracao.ts). Quando o bug do DRE for corrigido
-- e a base subir retroativa, os ajustes viram redundantes — é só apagar as
-- linhas do(s) mês(es) corrigido(s) (ou a tabela inteira), sem precisar
-- mexer em código.
--
-- Só o dono do sistema lê/escreve (`auth_dono()`, migration_065) — nenhum
-- outro usuário sequer sabe que essa tabela existe.
--
-- Rodar no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS financeiro_dre_ajustes_manuais (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade    text NOT NULL REFERENCES unidades(codigo),
  ano        int  NOT NULL,
  mes        int  NOT NULL CHECK (mes BETWEEN 1 AND 12),
  indicador  text NOT NULL CHECK (indicador IN ('multas', 'vales')),
  valor      numeric(14, 2) NOT NULL,
  observacao text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unidade, ano, mes, indicador)
);

ALTER TABLE financeiro_dre_ajustes_manuais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dono_financeiro_dre_ajustes_manuais" ON financeiro_dre_ajustes_manuais;
CREATE POLICY "dono_financeiro_dre_ajustes_manuais" ON financeiro_dre_ajustes_manuais
  FOR ALL TO authenticated
  USING (auth_dono())
  WITH CHECK (auth_dono());

DROP TRIGGER IF EXISTS trg_financeiro_dre_ajustes_manuais_updated_at ON financeiro_dre_ajustes_manuais;
CREATE TRIGGER trg_financeiro_dre_ajustes_manuais_updated_at
  BEFORE UPDATE ON financeiro_dre_ajustes_manuais FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
