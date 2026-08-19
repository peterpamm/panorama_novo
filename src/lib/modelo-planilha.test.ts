import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { montarWorkbookModelo } from './modelo-planilha'
import { MODELO_METAS_ARMAZEM, MODELO_META_PRESENTEISMO_DU, MODELO_RESULTADOS_ARMAZEM } from './modelos-importacao'
import { parseArmazemT1MetaXlsx } from './armazem-t1-meta-parser'
import { parseArmazemResultadosXlsx } from './armazem-resultado-parser'
import { parsePresenteismoDuMetaXlsx } from './presenteismo-du-meta-parser'

function comoArquivo(wb: XLSX.WorkBook, nome = 'modelo.xlsx'): File {
  return new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer], nome)
}

describe('montarWorkbookModelo', () => {
  it('cria uma aba por modelo, na ordem, com o cabeçalho na primeira linha', () => {
    const wb = montarWorkbookModelo(MODELO_METAS_ARMAZEM)
    expect(wb.SheetNames).toEqual(['RV ARM _T1', 'RV ARM _T2'])
    const primeira = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['RV ARM _T1'], { header: 1 })
    expect(primeira[0]).toEqual(['INDICADOR', 'UNIDADE', 'JUL', 'AGO'])
  })

  it('corta nome de aba inválido pro Excel (caracteres proibidos e 31 chars)', () => {
    const wb = montarWorkbookModelo([{ nome: 'Aba/com:caracteres[proibidos] e um nome bem longo', linhas: [['A']] }])
    expect(wb.SheetNames[0]).toBe('Abacomcaracteresproibidos e um '.slice(0, 31))
    expect(wb.SheetNames[0].length).toBeLessThanOrEqual(31)
  })
})

// O ponto do modelo é ser aceito pelo próprio parser da tela — se algum dia o
// cabeçalho esperado mudar sem o modelo acompanhar, estes testes quebram.
describe('modelos são lidos pelos parsers das telas', () => {
  it('metas do Armazém: aba T1 traz Estância/CDR Bahia com os 3 indicadores', async () => {
    const { linhas, erros } = await parseArmazemT1MetaXlsx(comoArquivo(montarWorkbookModelo(MODELO_METAS_ARMAZEM)), 'RV ARM _T1')
    expect(erros).toEqual([])
    expect(new Set(linhas.map(l => l.indicador))).toEqual(new Set(['tma', 'disponibilidade_gente', 'presenteismo_al']))
    expect(new Set(linhas.map(l => l.unidade))).toEqual(new Set(['ESTÂNCIA', 'CDR BAHIA']))
    // Formato histórico: cada coluna de mês vira um registro no seu mês.
    expect(new Set(linhas.map(l => l.mes))).toEqual(new Set([7, 8]))
  })

  it('metas do Armazém: aba T2 traz só as unidades do T2, em Presenteísmo AL', async () => {
    const { linhas, erros } = await parseArmazemT1MetaXlsx(comoArquivo(montarWorkbookModelo(MODELO_METAS_ARMAZEM)), 'RV ARM _T2')
    expect(erros).toEqual([])
    expect(linhas.every(l => l.indicador === 'presenteismo_al')).toBe(true)
    expect(new Set(linhas.map(l => l.unidade))).toEqual(new Set(['CD CASCAVEL', 'CD FOZ DO IGUAÇU', 'CD LONDRINA']))
  })

  it('resultados do Armazém: as duas abas entram, cada indicador no tier certo e nada ignorado', async () => {
    const { linhas, erros, ignorados } = await parseArmazemResultadosXlsx(comoArquivo(montarWorkbookModelo(MODELO_RESULTADOS_ARMAZEM)))
    expect(erros).toEqual([])
    expect(ignorados).toEqual([])
    const doTier = (tier: 'T1' | 'T2') => new Set(linhas.filter(l => l.tier === tier).map(l => l.indicador))
    expect(doTier('T1')).toEqual(new Set(['tma', 'disponibilidade_gente', 'presenteismo_al']))
    expect(doTier('T2')).toEqual(new Set(['presenteismo_al', 'efc', 'tma', 'refugo']))
  })

  it('meta do Presenteísmo DU: aba simples (mês da tela) e aba histórica (colunas de mês)', async () => {
    const arquivo = comoArquivo(montarWorkbookModelo(MODELO_META_PRESENTEISMO_DU))
    const simples = await parsePresenteismoDuMetaXlsx(arquivo, 'Meta do mês')
    expect(simples.erros).toEqual([])
    expect(simples.linhas.every(l => l.mes === undefined)).toBe(true)
    expect(simples.linhas[0]).toEqual({ unidade: 'CD CASCAVEL', valor: 2.5 })

    const historico = await parsePresenteismoDuMetaXlsx(arquivo, 'Histórico (vários meses)')
    expect(historico.erros).toEqual([])
    expect(new Set(historico.linhas.map(l => l.mes))).toEqual(new Set([1, 2, 3]))
  })
})
