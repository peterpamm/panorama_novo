-- Migration 083: aumenta o statement_timeout do papel `authenticated` —
-- não é mudança de schema, é config do banco. O erro "canceling statement
-- due to statement timeout" no Painel de Perdas/Farol de Metas acontece
-- porque a busca de mv_dre_longo sem filtro de unidade (admin/AMBEV) faz
-- OFFSET/LIMIT numa tabela que já passou de 176 mil linhas e só cresce — o
-- timeout padrão do projeto é curto demais pras páginas mais fundas dessa
-- paginação. Isso é um alívio imediato enquanto a paginação em si não muda
-- pra um esquema que não fique mais lento a cada página (cursor/keyset em
-- vez de OFFSET) — não resolve a causa, só dá mais fôlego.
-- Rodar no SQL Editor do Supabase.

ALTER ROLE authenticated SET statement_timeout = '60s';
