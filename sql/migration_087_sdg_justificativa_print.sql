-- Migration 087: print anexado na Justificativa do SDG — a unidade pode
-- anexar um print (jpeg/png, recomprimido pro cliente antes do upload) por
-- indicador × mês, que aparece no modo apresentação em cima dos cards de
-- Justificativa/Ações. Sem anexo = não mostra nada.
--
-- Rodar no SQL Editor do Supabase.

ALTER TABLE sdg_justificativas ADD COLUMN IF NOT EXISTS print_path text;

-- Bucket privado (não público) — leitura/escrita seguem a mesma regra de
-- unidade das outras tabelas do SDG: admin vê/edita tudo, unidade só a
-- própria pasta (primeiro segmento do caminho = código da unidade, ex:
-- "CASCAVEL/2026-8-ebitda.jpg").
INSERT INTO storage.buckets (id, name, public)
VALUES ('sdg-prints', 'sdg-prints', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "leitura_sdg_prints" ON storage.objects;
CREATE POLICY "leitura_sdg_prints" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sdg-prints' AND (auth_role() = 'admin' OR (storage.foldername(name))[1] = auth_unidade()));

DROP POLICY IF EXISTS "insere_sdg_prints" ON storage.objects;
CREATE POLICY "insere_sdg_prints" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sdg-prints' AND (auth_role() = 'admin' OR (storage.foldername(name))[1] = auth_unidade()));

DROP POLICY IF EXISTS "atualiza_sdg_prints" ON storage.objects;
CREATE POLICY "atualiza_sdg_prints" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'sdg-prints' AND (auth_role() = 'admin' OR (storage.foldername(name))[1] = auth_unidade()))
  WITH CHECK (bucket_id = 'sdg-prints' AND (auth_role() = 'admin' OR (storage.foldername(name))[1] = auth_unidade()));

DROP POLICY IF EXISTS "exclui_sdg_prints" ON storage.objects;
CREATE POLICY "exclui_sdg_prints" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'sdg-prints' AND (auth_role() = 'admin' OR (storage.foldername(name))[1] = auth_unidade()));

NOTIFY pgrst, 'reload schema';
