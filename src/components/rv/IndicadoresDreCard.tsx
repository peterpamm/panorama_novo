import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useOrcamentoTodasUnidades } from '@/hooks/useOrcamentoTodasUnidades'
import type { RvIndicadorDre } from '@/lib/constants'
import { avrPorPrefixo, normalizarParaCalculo } from '@/lib/farol-calculations'
import { buscarMetaOrcamento } from '@/lib/orcamento-farol'
import { unidadeSplitNegocio } from '@/lib/rv-gente'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtInt(v: number): string {
  return Math.round(v).toLocaleString('pt-BR')
}

/** Célula da matriz DRE: AVR×meta ou dispersão em R$. */
type CelulaDre =
  | { tipo: 'avr'; avr: number; meta: number | null }
  | { tipo: 'disp'; valor: number }
  | null

interface IndicadoresDreCardProps {
  /** Indicadores de RV do setor (RV_GENTE_DRE, RV_FINANCEIRO_DRE...). */
  indicadores: RvIndicadorDre[]
}

/**
 * Matriz de acompanhamento dos indicadores de RV com origem no DRE, por
 * unidade×mês: 'avr' compara o AVR mensal com a meta do Orçamento (custo —
 * quanto menor melhor); 'dispersao' soma a coluna DIFERENÇA do DRE nas contas
 * (verde quando ≥ 0, sem estouro). Ponta Grossa e Camaçari abrem por negócio
 * (ROTA/ARM), demais unidades usam CONS.
 */
export function IndicadoresDreCard({ indicadores }: IndicadoresDreCardProps) {
  const { rows: rowsDre, loading: loadingDre } = useDreLongoTodasUnidades()
  const { orcamentos, loading: loadingOrcamento } = useOrcamentoTodasUnidades()
  const { unidades } = useUnidades()

  const [indId, setIndId] = useState(indicadores[0].id)
  const ind = indicadores.find(i => i.id === indId) ?? indicadores[0]

  const anosDre = useMemo(
    () => Array.from(new Set(rowsDre.filter(r => r.negocio === 'CONS').map(r => r.ano))).sort((a, b) => b - a),
    [rowsDre],
  )
  const [anoDre, setAnoDre] = useState('')
  useEffect(() => {
    if (anosDre.length > 0 && !anosDre.includes(Number(anoDre))) setAnoDre(String(anosDre[0]))
  }, [anosDre, anoDre])

  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  const matriz = useMemo(() => {
    const ano = Number(anoDre)
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
  }, [rowsDre, orcamentos, anoDre, ind, nomesUnidades])

  const carregando = loadingDre || loadingOrcamento

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Indicador (DRE)</Label>
          <Select value={indId} onValueChange={setIndId}>
            <SelectTrigger className={cn('w-64', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {indicadores.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={anoDre} onValueChange={setAnoDre}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDre.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TableCard
        titulo={`Indicadores do DRE — ${ind.nome}`}
        subtitulo={carregando
          ? 'Carregando...'
          : ind.tipo === 'avr'
            ? `${anoDre} · AVR do mês vs meta do Orçamento · quanto menor melhor · verde = meta batida, vermelho = meta perdida`
            : `${anoDre} · dispersão do mês (coluna diferença do DRE, contas ${ind.prefixos.join(' + ')}) · verde = sem estouro (≥ 0)`}
      >
        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando DRE...
          </div>
        ) : matriz.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Sem dados do DRE pra esse ano.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Negócio</TableHead>
                {MESES_ABREV.map(m => (
                  <TableHead key={m} className="text-center">{m}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matriz.map(l => (
                <TableRow
                  key={`${l.unidade}|${l.negocio}`}
                  className={cn(
                    'border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30',
                    l.unidade === 'AMBEV' && 'bg-muted/40 font-semibold',
                  )}
                >
                  <TableCell className="text-sm font-medium">{l.nome}</TableCell>
                  <TableCell className={cn(
                    'text-sm',
                    l.negocio === 'CONS' ? 'text-muted-foreground' : 'font-semibold text-blue-600 dark:text-blue-400',
                  )}>
                    {l.negocio}
                  </TableCell>
                  {l.meses.map((c, i) => {
                    if (c === null) {
                      return <TableCell key={i} className="text-center text-xs text-muted-foreground">—</TableCell>
                    }
                    const bateu = c.tipo === 'avr'
                      ? (c.meta !== null ? c.avr <= c.meta : null)
                      : c.valor >= 0
                    const texto = c.tipo === 'avr' ? fmtPct(c.avr) : fmtInt(c.valor)
                    const tooltip = c.tipo === 'avr'
                      ? (c.meta !== null ? `Meta: ${fmtPct(c.meta)}` : 'Sem meta cadastrada')
                      : 'Meta: dispersão ≥ 0 (sem estouro)'
                    return (
                      <TableCell
                        key={i}
                        title={tooltip}
                        className={cn(
                          'text-center text-xs font-medium tabular-nums',
                          bateu === null
                            ? 'text-foreground'
                            : bateu
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                        )}
                      >
                        {texto}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </div>
  )
}
