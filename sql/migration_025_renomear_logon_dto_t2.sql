-- Migration 025: renomeia as tabelas do indicador que hoje se chama "logon"
-- pra "dto_t2" — o nome "LogOn" vai ficar livre pra um indicador diferente,
-- de planilha própria; o que já existe (colunas OPERAÇÃO / % REALIZADO_) é
-- na verdade do DTO T2. Preserva dados, políticas e trigger — só renomeia.
--
-- Só faz sentido se você já rodou as migrations 019/020 ANTES do ajuste (ou
-- seja, se as tabelas antigas resultados_logon/rv_logon_meta existirem de
-- verdade). Se você ainda não tinha rodado 019/020, não rode esta — as
-- migrations 019 e 020 já foram atualizadas pra criar direto com os nomes
-- novos (resultados_dto_t2 / rv_dto_t2_meta), então é só rodar elas.
-- Esta migration é segura de rodar de qualquer forma: se as tabelas antigas
-- não existirem, ela não faz nada (só avisa via NOTICE).
-- Rodar no SQL Editor do Supabase.

DO $$
BEGIN
  IF to_regclass('public.resultados_logon') IS NOT NULL THEN
    ALTER TABLE resultados_logon RENAME TO resultados_dto_t2;
    ALTER INDEX IF EXISTS idx_resultados_logon_lookup RENAME TO idx_resultados_dto_t2_lookup;
    ALTER POLICY "admin_resultados_logon"   ON resultados_dto_t2 RENAME TO "admin_resultados_dto_t2";
    ALTER POLICY "unidade_resultados_logon" ON resultados_dto_t2 RENAME TO "unidade_resultados_dto_t2";
    ALTER TRIGGER resultados_logon_updated_at ON resultados_dto_t2 RENAME TO resultados_dto_t2_updated_at;
  ELSE
    RAISE NOTICE 'Tabela resultados_logon não existe — nada pra renomear (rode a migration_019, ela já cria com o nome novo).';
  END IF;

  IF to_regclass('public.rv_logon_meta') IS NOT NULL THEN
    ALTER TABLE rv_logon_meta RENAME TO rv_dto_t2_meta;
    ALTER POLICY "admin_rv_logon_meta"   ON rv_dto_t2_meta RENAME TO "admin_rv_dto_t2_meta";
    ALTER POLICY "leitura_rv_logon_meta" ON rv_dto_t2_meta RENAME TO "leitura_rv_dto_t2_meta";
    ALTER TRIGGER rv_logon_meta_updated_at ON rv_dto_t2_meta RENAME TO rv_dto_t2_meta_updated_at;
  ELSE
    RAISE NOTICE 'Tabela rv_logon_meta não existe — nada pra renomear (rode a migration_020, ela já cria com o nome novo).';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
