import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'
import type { MetaPerdaIndicador } from '@/types'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const PREFIXOS_VALES = ['051', '052']

interface ValesMeta {
  peso: number
  pct_meta: number
}

interface LinhaVales {
  unidade: string
  nome: string
  meses: ({ resultado: number; meta: number | null } | null)[]
}

function fmtValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface ValesPerdasCardProps {
  /** Tabela de peso + % da Meta de Perdas de Vales do setor (rv_vales_distribuicao_meta / rv_vales_financeiro_meta). */
  tabelaMeta: 'rv_vales_distribuicao_meta' | 'rv_vales_financeiro_meta'
}

/**
 * Acompanhamento do indicador Vales — dispersão do DRE consolidado (contas
 * 051/052, mesma conta do indicador Vales do Painel de Perdas) vs % da Meta
 * de Perdas de Vales (metas_perdas_indicadores, anual/12) — mesma regra e
 * mesmos números usados na apuração da RV (RvApuracao, prop
 * valesPerdasTabela). Reaproveitado pela RV de Distribuição e do Financeiro,
 * cada uma com sua própria tabela de peso/%.
 */
export function ValesPerdasCard({ tabelaMeta }: ValesPerdasCardProps) {
  const { unidades } = useUnidades()
  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])
  const { rows: rowsDre, loading: loadingDre } = useDreLongoTodasUnidades()

  const [metasPerdasVales, setMetasPerdasVales] = useState<MetaPerdaIndicador[]>([])
  const [valesMeta, setValesMeta] = useState<ValesMeta | null>(null)
  const [carregandoMeta, setCarregandoMeta] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregandoMeta(true)
      const [mp, vm] = await Promise.all([
        supabase.from('metas_perdas_indicadores').select('*').eq('indicador', 'vales'),
        supabase.from(tabelaMeta).select('*').maybeSingle(),
      ])
      setMetasPerdasVales((mp.data as MetaPerdaIndicador[]) ?? [])
      setValesMeta(vm.data as ValesMeta | null)
      setCarregandoMeta(false)
    }
    carregar()
  }, [tabelaMeta])

  const anosDisponiveis = useMemo(
    () => Array.from(new Set(rowsDre.filter(r => r.tipo_periodo === 'MENSAL').map(r => r.ano))).sort((a, b) => b - a),
    [rowsDre],
  )
  const [ano, setAno] = useState('')
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(ano))) setAno(String(anosDisponiveis[0]))
  }, [anosDisponiveis, ano])

  const linhas = useMemo<LinhaVales[]>(() => {
    const anoNum = Number(ano)
    // Consolidado (CONS) — igual ao indicador Vales do Painel de Perdas, vale pra todas as lideranças.
    const mensal = rowsDre.filter(r => r.tipo_periodo === 'MENSAL' && r.ano === anoNum && r.negocio === 'CONS')
    if (!anoNum || mensal.length === 0) return []

    const codigosUnidades = Array.from(new Set(mensal.map(r => r.unidade)))
      .sort((a, b) => {
        if (a === 'AMBEV') return 1
        if (b === 'AMBEV') return -1
        return (nomesUnidades.get(a) ?? a).localeCompare(nomesUnidades.get(b) ?? b)
      })

    return codigosUnidades.map(unidade => {
      const rowsUnidade = mensal.filter(r => r.unidade === unidade)
      const metaPerdas = metasPerdasVales.find(m => m.unidade === unidade && m.ano === anoNum)
      const meses = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1
        const rowsMes = rowsUnidade.filter(r => r.mes === mes)
        if (rowsMes.length === 0) return null
        const resultado = rowsMes
          .filter(r => PREFIXOS_VALES.some(p => r.conta_codigo.startsWith(p)))
          .reduce((acc, r) => acc + (r.diferenca ?? 0), 0)
        const meta = metaPerdas && valesMeta ? (metaPerdas.meta_anual / 12) * (valesMeta.pct_meta / 100) : null
        return { resultado, meta }
      })
      return { unidade, nome: nomesUnidades.get(unidade) ?? unidade, meses }
    })
  }, [rowsDre, metasPerdasVales, valesMeta, ano, nomesUnidades])

  const carregando = loadingDre || carregandoMeta

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TableCard
        titulo="Vales"
        subtitulo={carregando
          ? 'Carregando...'
          : `${ano} · dispersão do mês (contas 051/052, DRE consolidado) vs % da Meta de Perdas de Vales`}
      >
        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : linhas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Sem dados do DRE pra esse ano.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                {MESES_ABREV.map(m => (
                  <TableHead key={m} className="text-center">{m}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(l => (
                <TableRow
                  key={l.unidade}
                  className={cn(
                    'border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30',
                    l.unidade === 'AMBEV' && 'bg-muted/40 font-semibold',
                  )}
                >
                  <TableCell className="py-1.5 text-sm font-medium">
                    {l.nome}
                    {valesMeta === null && <span className="ml-1 text-[10px] text-muted-foreground">(sem meta)</span>}
                  </TableCell>
                  {l.meses.map((c, i) => {
                    if (c === null) {
                      return <TableCell key={i} className="py-1.5 text-center text-xs text-muted-foreground">—</TableCell>
                    }
                    const bateu = c.meta !== null ? c.resultado >= c.meta : null
                    return (
                      <TableCell
                        key={i}
                        title={c.meta !== null ? `Meta: R$ ${fmtValor(c.meta)}` : 'Sem Meta de Perdas de Vales cadastrada'}
                        className={cn(
                          'py-1.5 text-center text-xs font-medium tabular-nums',
                          bateu === null
                            ? 'text-foreground'
                            : bateu
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                        )}
                      >
                        {fmtValor(c.resultado)}
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
