import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { montarWorkbookModelo } from './modelo-planilha'
import { MODELO_ENCONTRO_CONTAS, MODELO_INDICADORES_ARMAZEM, MODELO_INDICADORES_DU, MODELO_METAS_ARMAZEM, MODELO_META_PRESENTEISMO_DU, MODELO_RESULTADOS_ARMAZEM, MODELO_TERMOMETRO } from './modelos-importacao'
import { parseArmazemT1MetaXlsx } from './armazem-t1-meta-parser'
import { parseArmazemResultadosXlsx } from './armazem-resultado-parser'
import { parsePresenteismoDuMetaXlsx } from './presenteismo-du-meta-parser'
import { parseEncontroContasFile } from './encontro-contas-parser'
import { parseTermometroFile } from './reuniao-termometro-parser'
import { parsePlanilhaReuniaoXlsx } from './reuniao-planilha-parser'

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

  it('Encontro de Contas: descrição no padrão "EC - <chamado> - <nome>" já sai pronta pro parser', async () => {
    const arquivo = comoArquivo(montarWorkbookModelo(MODELO_ENCONTRO_CONTAS))
    const { linhas, erros } = await parseEncontroContasFile(arquivo)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { data: '2026-01-15', descricaoOriginal: 'EC - R14602322 - Vinicius Etges Silveira', numeroChamado: 'R14602322', solicitante: 'Vinicius Etges Silveira', valor: 1234.56 },
      { data: '2026-01-22', descricaoOriginal: 'EC - R14611087 - Ana Paula Ferreira', numeroChamado: 'R14611087', solicitante: 'Ana Paula Ferreira', valor: 850 },
    ])
  })

  it('Termômetro: pontuação de todas as unidades + Posição nas que já têm colocação lançada', async () => {
    const arquivo = comoArquivo(montarWorkbookModelo(MODELO_TERMOMETRO))
    const { linhas, erros } = await parseTermometroFile(arquivo)
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'ESTÂNCIA', valor: 92.5, posicao: 1 },
      { unidade: 'CDR BAHIA', valor: 88, posicao: 2 },
      { unidade: 'CD CASCAVEL', valor: 81.3, posicao: 3 },
      { unidade: 'CD FOZ DO IGUAÇU', valor: 75 },
    ])
  })

  it('Importação Reunião Resultados — Armazém: acha a linha de título acima do cabeçalho e lê as 3 linhas de exemplo', async () => {
    const arquivo = comoArquivo(montarWorkbookModelo(MODELO_INDICADORES_ARMAZEM))
    const { linhas, erros } = await parsePlanilhaReuniaoXlsx(arquivo, 'Import RR_ARM')
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'ESTÂNCIA', indicador: 'TMA', meta: '01:40', resultado: '01:38', pontos: 20 },
      { unidade: 'ESTÂNCIA', indicador: 'DISPONIBILIDADE DE GENTE', meta: '95,9%', resultado: '96,4%', pontos: 20 },
      { unidade: 'CD CASCAVEL', indicador: 'PRESENTEISMO AL', meta: '1,14%', resultado: '1,20%', pontos: 0 },
    ])
  })

  it('Importação Reunião Resultados — Distribuição: mesma estrutura, aba e indicadores do setor DU', async () => {
    const arquivo = comoArquivo(montarWorkbookModelo(MODELO_INDICADORES_DU))
    const { linhas, erros } = await parsePlanilhaReuniaoXlsx(arquivo, 'Import RR_DU')
    expect(erros).toEqual([])
    expect(linhas).toEqual([
      { unidade: 'CD CASCAVEL', indicador: 'GTY', meta: '95%', resultado: '96,2%', pontos: 20 },
      { unidade: 'CD CASCAVEL', indicador: 'TMV', meta: '00:45', resultado: '00:42', pontos: 20 },
      { unidade: 'CD FOZ DO IGUAÇU', indicador: 'TEMPO DE RENDIÇÃO', meta: '00:15', resultado: '00:18', pontos: 0 },
    ])
  })
})
