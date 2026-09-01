import { useMemo } from 'react'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useOrcamentoTodasUnidades } from '@/hooks/useOrcamentoTodasUnidades'
import type { RvIndicadorDre } from '@/lib/constants'
import { avrPorPrefixo, normalizarParaCalculo } from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { unidadeSplitNegocio } from '@/lib/rv-gente'
import type { CelulaIndicador, LinhaIndicador } from '@/components/rv/TabelaIndicadorGenerica'

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtInt(v: number): string {
  return Math.round(v).toLocaleString('pt-BR')
}

/** Célula da matriz DRE: AVR×meta ou dispersão em R$. */
export type CelulaDre =
  | { tipo: 'avr'; avr: number; meta: number | null }
  | { tipo: 'disp'; valor: number }
  | null

export interface LinhaMatrizDre {
  unidade: string
  negocio: string
  nome: string
  meses: CelulaDre[]
}

/**
 * Matriz de acompanhamento de 1 indicador de RV com origem no DRE, por
 * unidade×negócio×mês — 'avr' compara o AVR mensal com a meta do Orçamento
 * (custo, quanto menor melhor); 'dispersao' soma a coluna DIFERENÇA do DRE nas
 * contas do indicador. Ponta Grossa e Camaçari abrem por negócio (ROTA/ARM),
 * demais unidades usam CONS.
 *
 * Lógica compartilhada entre `IndicadoresDreCard` (card próprio, com seletor
 * de indicador/ano dele) e o seletor único de RV de Gente (`RvGenteTab`), que
 * combina indicadores importados e do DRE num seletor só — `ano` fica de fora
 * do hook porque cada consumidor decide sozinho como escolher o ano.
 */
export function useIndicadorDreMatriz(indicadores: RvIndicadorDre[], indId: string, ano: number | null) {
  const { rows: rowsDre, loading: loadingDre } = useDreLongoTodasUnidades()
  const { orcamentos, loading: loadingOrcamento } = useOrcamentoTodasUnidades()
  const { unidades } = useUnidades()

  const ind = indicadores.find(i => i.id === indId) ?? indicadores[0]

  const anosDisponiveis = useMemo(
    () => Array.from(new Set(rowsDre.filter(r => r.negocio === 'CONS').map(r => r.ano))).sort((a, b) => b - a),
    [rowsDre],
  )

  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  const matriz = useMemo<LinhaMatrizDre[]>(() => {
    if (ano === null) return []
    const mensal = rowsDre.filter(r => r.tipo_periodo === 'MENSAL' && r.ano === ano)
    if (mensal.length === 0) return []

    const codigosUnidades = Array.from(new Set(mensal.map(r => r.unidade)))
      .sort((a, b) => {
        if (a === 'AMBEV') return 1
        if (b === 'AMBEV') return -1
        return (nomesUnidades.get(a) ?? a).localeCompare(nomesUnidades.get(b) ?? b)
      })

    // Uma linha por unidade×negócio: PG/Camaçari abrem nos negócios não-CONS; demais só CONS.
    const linhas: { unidade: string; negocio: string }[] = []
    for (const unidade of codigosUnidades) {
      const nome = nomesUnidades.get(unidade) ?? unidade
      if (unidadeSplitNegocio(unidade, nome)) {
        const negocios = Array.from(new Set(
          mensal.filter(r => r.unidade === unidade && r.negocio !== 'CONS').map(r => r.negocio),
        )).sort()
        if (negocios.length > 0) {
          negocios.forEach(negocio => linhas.push({ unidade, negocio }))
          continue
        }
        // Sem DRE separado por negócio importado — cai pro CONS pra não sumir da tabela.
      }
      linhas.push({ unidade, negocio: 'CONS' })
    }

    return linhas.map(({ unidade, negocio }) => {
      const rowsLinha = mensal.filter(r => r.unidade === unidade && r.negocio === negocio)
      const meses: CelulaDre[] = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1
        const rowsMes = rowsLinha.filter(r => r.mes === mes)
        if (rowsMes.length === 0) return null

        if (ind.tipo === 'avr') {
          const calc = normalizarParaCalculo(rowsMes)
          const avr = avrPorPrefixo(calc, ind.prefixos)
          const meta = buscarMetaOrcamento(orcamentos, { unidade, negocio, ano, codigo: ind.id, mes })
          return { tipo: 'avr', avr, meta }
        }

        // Dispersão: soma da coluna DIFERENÇA (REAL−REMUN) nas contas do indicador.
        const valor = rowsMes
          .filter(r => ind.prefixos.some(p => r.conta_codigo.startsWith(p)))
          .reduce((acc, r) => acc + (r.diferenca ?? 0), 0)
        return { tipo: 'disp', valor }
      })
      return { unidade, negocio, nome: nomesUnidades.get(unidade) ?? unidade, meses }
    })
  }, [rowsDre, orcamentos, ano, ind, nomesUnidades])

  const carregando = loadingDre || loadingOrcamento

  return { matriz, carregando, anosDisponiveis, ind }
}

/** Converte a matriz crua (avr/dispersão + meta) pro formato genérico de célula já pronto pra `TabelaIndicadorGenerica` — mesma formatação usada por todo indicador de RV com origem no DRE. */
export function linhasDreParaIndicador(matriz: LinhaMatrizDre[]): LinhaIndicador[] {
  return matriz.map(l => ({
    key: `${l.unidade}|${l.negocio}`,
    nome: l.nome,
    negocio: l.negocio,
    destaque: l.unidade === 'AMBEV',
    meses: l.meses.map((c): CelulaIndicador | null => {
      if (c === null) return null
      if (c.tipo === 'avr') {
        return {
          texto: fmtPct(c.avr),
          tooltip: c.meta !== null ? `Meta: ${fmtPct(c.meta)}` : 'Sem meta cadastrada',
          bateu: c.meta !== null ? c.avr <= c.meta : null,
        }
      }
      return {
        texto: fmtInt(c.valor),
        tooltip: 'Meta: dispersão ≥ 0 (sem estouro)',
        bateu: c.valor >= 0,
      }
    }),
  }))
}
