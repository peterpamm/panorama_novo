-- Migration 113: ajuste manual de Multas/Vales do Financeiro (migration 104)
-- deixa de ser visível só pro dono do sistema — qualquer ADMIN passa a ler,
-- senão o ajuste "não reflete" pra ninguém além de quem lançou (Reunião
-- Resultados > Acompanhamento, RV > Apuração/Painel Geral/Matriz continuavam
-- mostrando o valor furado do DRE pra todo o resto da equipe). Lançar/editar/
-- remover continua só do dono — os botões de edição no app já são todos
-- `souDono &&` (AcompanhamentoReuniaoTab.tsx, RvApuracao.tsx); a RLS de
-- escrita abaixo só reforça isso no banco.
--
-- Rodar no SQL Editor do Supabase.

DROP POLICY IF EXISTS "dono_financeiro_dre_ajustes_manuais" ON financeiro_dre_ajustes_manuais;

DROP POLICY IF EXISTS "admin_leitura_financeiro_dre_ajustes_manuais" ON financeiro_dre_ajustes_manuais;
CREATE POLICY "admin_leitura_financeiro_dre_ajustes_manuais" ON financeiro_dre_ajustes_manuais
  FOR SELECT TO authenticated
  USING (auth_role() = 'admin');

DROP POLICY IF EXISTS "dono_escrita_financeiro_dre_ajustes_manuais" ON financeiro_dre_ajustes_manuais;
CREATE POLICY "dono_escrita_financeiro_dre_ajustes_manuais" ON financeiro_dre_ajustes_manuais
  FOR INSERT TO authenticated
  WITH CHECK (auth_dono());

DROP POLICY IF EXISTS "dono_atualizacao_financeiro_dre_ajustes_manuais" ON financeiro_dre_ajustes_manuais;
CREATE POLICY "dono_atualizacao_financeiro_dre_ajustes_manuais" ON financeiro_dre_ajustes_manuais
  FOR UPDATE TO authenticated
  USING (auth_dono())
  WITH CHECK (auth_dono());

DROP POLICY IF EXISTS "dono_remocao_financeiro_dre_ajustes_manuais" ON financeiro_dre_ajustes_manuais;
CREATE POLICY "dono_remocao_financeiro_dre_ajustes_manuais" ON financeiro_dre_ajustes_manuais
  FOR DELETE TO authenticated
  USING (auth_dono());

NOTIFY pgrst, 'reload schema';
