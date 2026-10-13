-- Migration 125: Limpa Pauta — guarda o Id do Freightech (coluna "Id" da
-- exportação completa) pra deduplicar na importação: reimportar a mesma
-- planilha não duplica mais as linhas (ver `ignoreDuplicates` no upsert de
-- `ImportacaoLimpaPautaTab.tsx`). Fica UNIQUE mas sem NOT NULL — exportações
-- antigas (sem a coluna Id) continuam entrando sem id, sem dedup nesse caso
-- (não tem como deduplicar sem uma chave), e NULL nunca colide com NULL em
-- UNIQUE do Postgres, então isso não trava a importação dessas planilhas.

ALTER TABLE limpa_pauta
  ADD COLUMN IF NOT EXISTS id_freightech text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_limpa_pauta_id_freightech ON limpa_pauta(id_freightech);

NOTIFY pgrst, 'reload schema';
