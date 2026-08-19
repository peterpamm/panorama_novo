import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { identificarIndicadorDoTier, parseArmazemResultadosCsv, parseArmazemResultadosXlsx } from './armazem-resultado-parser'

const HEADER = 'INDICADOR;UNIDADE;RESULTADO'

describe('identificarIndicadorDoTier', () => {
  it('cada tier reconhece só os seus indicadores', () => {
    expect(identificarIndicadorDoTier('REFUGO', 'T2')).toBe('refugo')
    expect(identificarIndicadorDoTier('REFUGO', 'T1')).toBeNull()
    expect(identificarIndicadorDoTier('DISPONIBILIDADE DE GENTE', 'T1')).toBe('disponibilidade_gente')
    expect(identificarIndicadorDoTier('DISPONIBILIDADE DE GENTE', 'T2')).toBeNull()
  })

  it('TMA e Presenteísmo AL valem nos dois tiers', () => {
    for (const tier of ['T1', 'T2'] as const) {
      expect(identificarIndicadorDoTier('TMA', tier)).toBe('tma')
      expect(identificarIndicadorDoTier('PRESENTEÍSMO AL', tier)).toBe('presenteismo_al')
    }
  })
})

describe('parseArmazemResultadosCsv', () => {
  it('converte TMA de HH:MM pra minutos e os demais em percentual', () => {
    const texto = [HEADER, 'TMA;CD CASCAVEL;03:15', 'EFC;CD CASCAVEL;98,5%'].join('\n')
    const { linhas, erros } = parseArmazemResultadosCsv(texto)
    expect(erros).toEqual([])
    expect(linhas.map(l => [l.indicador, l.valor])).toEqual([['tma', 195], ['efc', 98.5]])
  })

  it('sem aba, o tier vem da unidade', () => {
    const texto = [HEADER, 'TMA;ESTÂNCIA;01:40', 'TMA;CD CASCAVEL;03:15'].join('\n')
    const { linhas } = parseArmazemResultadosCsv(texto)
    expect(linhas.map(l => l.tier)).toEqual(['T1', 'T2'])
  })

  it('tira o código numérico do BI do nome da unidade', () => {
    const { linhas } = parseArmazemResultadosCsv([HEADER, 'EFC;143 - CDD Beltrao;97%'].join('\n'))
    expect(linhas[0].unidade).toBe('CDD BELTRAO')
  })
})

describe('parseArmazemResultadosXlsx — T1 e T2 numa planilha só', () => {
  function arquivo(abas: Record<string, (string | number)[][]>): File {
    const wb = XLSX.utils.book_new()
    for (const [nome, linhas] of Object.entries(abas)) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), nome)
    }
    return new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer], 'RV ARM.xlsx')
  }

  const PLANILHA = {
    'RV ARM _T1': [
      ['INDICADOR', 'UNIDADE', 'RESULTADO'],
      ['TMA', 'ESTÂNCIA', '01:38'],
      ['DISPONIBILIDADE DE GENTE', 'CDR BAHIA', 0.94],
    ],
    'RV ARM _T2': [
      ['INDICADOR', 'UNIDADE', 'RESULTADO'],
      ['EFC', 'CD CASCAVEL', 0.985],
      ['REFUGO', 'CD LONDRINA', 0.0042],
    ],
  }

  it('lê as duas abas de uma vez, cada linha com seu tier', async () => {
    const { linhas, erros, ignorados } = await parseArmazemResultadosXlsx(arquivo(PLANILHA))
    expect(erros).toEqual([])
    expect(ignorados).toEqual([])
    expect(linhas.map(l => [l.tier, l.indicador, l.unidade])).toEqual([
      ['T1', 'tma', 'ESTÂNCIA'],
      ['T1', 'disponibilidade_gente', 'CDR BAHIA'],
      ['T2', 'efc', 'CD CASCAVEL'],
      ['T2', 'refugo', 'CD LONDRINA'],
    ])
  })

  it('indicador que não existe no tier daquela aba é reportado, não importado', async () => {
    const { linhas, ignorados } = await parseArmazemResultadosXlsx(arquivo({
      'RV ARM _T1': [
        ['INDICADOR', 'UNIDADE', 'RESULTADO'],
        ['REFUGO', 'ESTÂNCIA', 0.004],
        ['TMA', 'ESTÂNCIA', '01:38'],
      ],
    }))
    expect(linhas.map(l => l.indicador)).toEqual(['tma'])
    expect(ignorados).toEqual(['REFUGO (T1)'])
  })

  it('formato histórico: uma linha por mês preenchido', async () => {
    const { linhas } = await parseArmazemResultadosXlsx(arquivo({
      'RV ARM _T2': [
        ['INDICADOR', 'UNIDADE', 'JAN', 'FEV', 'MAR'],
        ['EFC', 'CD CASCAVEL', 0.98, 0.99, ''],
      ],
    }))
    expect(linhas.map(l => [l.mes, l.valor])).toEqual([[1, 98], [2, 99]])
  })

  it('aba sem o cabeçalho esperado é ignorada sem erro', async () => {
    const { linhas, erros } = await parseArmazemResultadosXlsx(arquivo({
      Notas: [['observações da planilha'], ['bla']],
      'RV ARM _T2': [['INDICADOR', 'UNIDADE', 'RESULTADO'], ['EFC', 'CD CASCAVEL', 0.98]],
    }))
    expect(erros).toEqual([])
    expect(linhas.map(l => l.unidade)).toEqual(['CD CASCAVEL'])
  })
})

describe('parseArmazemResultadosXlsx — TMA com formato de célula "00:00" (bug real do RV ARM)', () => {
  /**
   * Replica exatamente o Import_RV_ARM.xlsx: colunas de mês mais antigas
   * (JAN-MAI) trazem TMA como fração do dia de verdade (0,0625 = "1:30"),
   * mas os meses mais recentes (JUN, JUL) vêm com o mesmo indicador num
   * formato de célula customizado "00\:00" — um inteiro tipo HHMM (131 →
   * "01:31") que NADA tem a ver com fração de dia. Ler o valor bruto sem
   * saber disso multiplica 131 por 1440 e "explode" pra 3144:00.
   */
  function arquivoComFormatoMisto(): File {
    const ws = XLSX.utils.aoa_to_sheet([
      ['INDICADOR', 'UNIDADE', 'MAI', 'JUN', 'JUL'],
      ['TMA', 'CDD Diadema', 0, 0, 0], // valores substituídos abaixo célula a célula
    ])
    ws['C2'] = { t: 'n', v: 0.0625, z: 'h:mm' } // MAI: fração real do dia = 1h30
    ws['D2'] = { t: 'n', v: 202, z: '00\\:00' } // JUN: HHMM customizado = "02:02"
    ws['E2'] = { t: 'n', v: 131, z: '00\\:00' } // JUL: HHMM customizado = "01:31" — o caso relatado
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'RV ARM _T2')
    return new File([XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer], 'Import_RV_ARM.xlsx')
  }

  it('lê "01:31" (formato HHMM customizado) como 91 minutos, não como 188640', async () => {
    const { linhas, erros } = await parseArmazemResultadosXlsx(arquivoComFormatoMisto())
    expect(erros).toEqual([])
    const jul = linhas.find(l => l.mes === 7)
    expect(jul?.valor).toBe(91) // 1h31 = 91 min — NÃO 131 * 1440 = 188640
  })

  it('mês com fração real do dia e mês com formato customizado convivem na mesma linha, cada um lido certo', async () => {
    const { linhas } = await parseArmazemResultadosXlsx(arquivoComFormatoMisto())
    const porMes = new Map(linhas.map(l => [l.mes, l.valor]))
    expect(porMes.get(5)).toBe(90)  // MAI: fração 0,0625 = 1h30 = 90 min
    expect(porMes.get(6)).toBe(122) // JUN: "02:02" = 122 min
    expect(porMes.get(7)).toBe(91)  // JUL: "01:31" = 91 min
  })
})
