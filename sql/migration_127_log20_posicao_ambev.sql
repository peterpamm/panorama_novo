-- Migration 127: Posição da LOG20 no ranking Ambev (1 linha por ano,
-- preenchida manualmente em Importação > Financeiro > Dados auxiliares)
-- — substitui o Scorecard por unidade (`scorecard_acumulado`, migration
-- 098/117/118): a Ambev não dá mais um score por unidade, dá uma faixa de
-- posição da LOG20 como operador inteiro (ex: "1-5", "6-10"). Meta fixa de
-- top 5 (`META_POSICAO_LOG20` em farol-gerentes.ts), não vem de coluna —
-- mesmo padrão do antigo `META_SCORECARD`. Mesmo valor aparece em todo
-- card do Farol Gerentes (como o EBITDA Global já faz), não é por unidade.
--
-- `scorecard_acumulado` e a RPC `farol_gerentes_scorecard` (migration 098)
-- ficam como estão, sem uso do app a partir de agora — não apagamos
-- infraestrutura/histórico só porque parou de ser lido.
--
-- Leitura liberada pra todo autenticado (é informação da empresa toda,
-- mostrada pra qualquer usuário no Farol Gerentes/SDG Gerentes); escrita
-- só admin. Sem RPC — tabela pequena, sem filtro por unidade, dá pra ler
-- direto com RLS normal (diferente do resto do dataset do Farol Gerentes).

CREATE TABLE IF NOT EXISTS log20_posicao_ambev (
  ano                   int PRIMARY KEY,
  faixa                 text NOT NULL,
  atualizado_por_email  text,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE log20_posicao_ambev ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_log20_posicao_ambev" ON log20_posicao_ambev;
CREATE POLICY "leitura_log20_posicao_ambev" ON log20_posicao_ambev
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_escreve_log20_posicao_ambev" ON log20_posicao_ambev;
CREATE POLICY "admin_escreve_log20_posicao_ambev" ON log20_posicao_ambev
  FOR ALL TO authenticated
  USING (auth_role() = 'admin')
  WITH CHECK (auth_role() = 'admin');

DROP TRIGGER IF EXISTS trg_log20_posicao_ambev_updated_at ON log20_posicao_ambev;
CREATE TRIGGER trg_log20_posicao_ambev_updated_at
  BEFORE UPDATE ON log20_posicao_ambev FOR EACH ROW EXECUTE FUNCTION update_updated_at();

NOTIFY pgrst, 'reload schema';
