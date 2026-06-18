"""Script ad-hoc (nao faz parte do app) para gerar o INSERT INTO contas
a partir do arquivo-modelo de DRE baixado do GInfo. Rodar uma unica vez,
colar o resultado (sql/seed_contas.sql) no SQL Editor do Supabase.

Uso: python scripts/gerar_seed_contas.py "C:\\caminho\\para\\DRE.xlsx"
"""
import openpyxl
import re
import sys

ARQUIVO = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\LOG20\Downloads\DRE23_12_2025_06_56_4.xlsx"
SAIDA = "sql/seed_contas.sql"

wb = openpyxl.load_workbook(ARQUIVO, data_only=True)
ws = wb["DRE"]

linhas = []
ordem = 0
for r in range(9, ws.max_row + 1):
    valor = ws.cell(row=r, column=1).value
    if not valor:
        continue
    m = re.match(r"^(\d{3}) \|( *)(.*)", str(valor))
    if not m:
        continue
    codigo, espacos, desc_raw = m.group(1), m.group(2), m.group(3)
    desc = desc_raw.strip()
    if not desc:
        continue
    ordem += 1
    nivel = max(0, (len(espacos) - 1) // 3)
    linhas.append((codigo, desc, ordem, nivel))

print(f"{len(linhas)} contas extraidas.")

with open(SAIDA, "w", encoding="utf-8") as f:
    f.write("-- Seed do plano de contas, gerado a partir de "
             f"{ARQUIVO.split(chr(92))[-1]}\n")
    f.write("INSERT INTO contas (codigo, descricao, ordem, nivel) VALUES\n")
    valores = []
    for codigo, desc, ordem, nivel in linhas:
        desc_sql = desc.replace("'", "''")
        valores.append(f"  ('{codigo}', '{desc_sql}', {ordem}, {nivel})")
    f.write(",\n".join(valores))
    f.write("\nON CONFLICT (codigo) DO NOTHING;\n")

print(f"Gravado em {SAIDA}")
