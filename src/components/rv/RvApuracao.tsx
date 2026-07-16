import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useMetasTodasUnidades } from '@/hooks/useMetasTodasUnidades'
import type { RvIndicadorDre } from '@/lib/constants'
import type { TabelaPesosDre } from '@/components/metas/PesosDreCard'
import { avrPorPrefixo, buscarMetaComFallback, normalizarParaCalculo } from '@/lib/farol-calculations'
import { menorMelhor, negocioCompativel, negocioDreDaPessoa } from '@/lib/rv-gente'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { MetaGente, ResultadoGente, RvLideranca } from '@/types'

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPeso(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

function fmtValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type StatusItem = 'bateu' | 'perdeu' | 'pendente'

interface ItemApuracao {
  chave: string
  rotulo: string
  peso: number
  status: StatusItem
  detalhe: string
}

interface LinhaApuracao {
  pessoa: RvLideranca
  unidadeOk: boolean
  itens: ItemApuracao[]
  pctPossivel: number
  pctConquistado: number
  aReceber: number
}

interface RvApuracaoProps {
  /** Nome do setor exibido no card (ex: "RH", "FINANCEIRO"). */
  setorLabel: string
  /** Filtro de setor sobre o cadastro de lideranças (ex: ehSetorRh). */
  ehDoSetor: (setor: string) => boolean
  /** Indicadores com origem no DRE do setor (RV_GENTE_DRE, RV_FINANCEIRO_DRE...). */
  indicadoresDre: RvIndicadorDre[]
  /** Tabela dos pesos dos indicadores do DRE. */
  tabelaPesos: TabelaPesosDre
  /** Inclui os indicadores do BI (metas_gente × resultados_gente) — só a RV de Gente usa. */
  incluirIndicadoresBi?: boolean
}

/**
 * Apuração da RV de um setor: pra cada liderança do setor, cruza os
 * indicadores do mês — os do BI (metas_gente × resultados_gente da sua
 * operação/negócio, quando o setor usa) e os do DRE (indicadoresDre × pesos
 * de tabelaPesos) — soma os pesos dos indicadores batidos e aplica sobre o
 * valor de RV da pessoa. Indicador sem resultado/meta fica pendente e não soma.
 */
export function RvApuracao({ setorLabel, ehDoSetor, indicadoresDre, tabelaPesos, incluirIndicadoresBi = false }: RvApuracaoProps) {
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const { rows: rowsDre, loading: loadingDre } = useDreLongoTodasUnidades()
  const { metas: metasFarol, loading: loadingMetasFarol } = useMetasTodasUnidades()

  const [liderancas, setLiderancas] = useState<RvLideranca[]>([])
  const [metas, setMetas] = useState<MetaGente[]>([])
  const [resultados, setResultados] = useState<ResultadoGente[]>([])
  const [pesosDre, setPesosDre] = useState<Map<string, number>>(new Map())
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const [l, p, m, r] = await Promise.all([
        supabase.from('rv_liderancas').select('*'),
        supabase.from(tabelaPesos).select('*'),
        incluirIndicadoresBi ? supabase.from('metas_gente').select('*') : Promise.resolve({ data: [], error: null }),
        incluirIndicadoresBi ? supabase.from('resultados_gente').select('*') : Promise.resolve({ data: [], error: null }),
      ])
      const erro = l.error ?? p.error ?? m.error ?? r.error
      if (erro) toast({ title: 'Erro ao carregar dados da apuração', description: erro.message, variant: 'destructive' })
      setLiderancas((l.data as RvLideranca[]) ?? [])
      setMetas((m.data as MetaGente[]) ?? [])
      setResultados((r.data as ResultadoGente[]) ?? [])
      setPesosDre(new Map(((p.data as { codigo: string; peso: number }[]) ?? []).map(x => [x.codigo, Number(x.peso)])))
      setCarregando(false)
    }
    carregar()
  }, [tabelaPesos, incluirIndicadoresBi]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtros ─────────────────────────────────────────────────────────────────
  const anosDisponiveis = useMemo(
    () => Array.from(new Set([
      ...metas.map(m => m.ano),
      ...resultados.map(r => r.ano),
      ...rowsDre.filter(r => r.tipo_periodo === 'MENSAL').map(r => r.ano),
    ])).sort((a, b) => b - a),
    [metas, resultados, rowsDre],
  )
  const [verAno, setVerAno] = useState('')
  const [verMes, setVerMes] = useState('')
  const [filtroOperacao, setFiltroOperacao] = useState('todos')

  const liderancasSetor = useMemo(() => liderancas.filter(l => ehDoSetor(l.setor)), [liderancas, ehDoSetor])

  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(verAno))) {
      setVerAno(String(anosDisponiveis[0]))
    }
  }, [anosDisponiveis, verAno])

  // Mês padrão: o último com resultado do BI importado no ano (setores sem BI usam o último mês do DRE).
  useEffect(() => {
    if (verMes !== '' || verAno === '') return
    const ano = Number(verAno)
    const mesesComDado = incluirIndicadoresBi
      ? resultados.filter(r => r.ano === ano).map(r => r.mes)
      : rowsDre.filter(r => r.tipo_periodo === 'MENSAL' && r.ano === ano).map(r => r.mes)
    setVerMes(String(mesesComDado.length > 0 ? Math.max(...mesesComDado) : new Date().getMonth() + 1))
  }, [verAno, verMes, resultados, rowsDre, incluirIndicadoresBi])

  const operacoesDisponiveis = useMemo(
    () => Array.from(new Set(liderancasSetor.map(l => l.operacao))).sort(),
    [liderancasSetor],
  )

  // ── Apuração por pessoa ─────────────────────────────────────────────────────
  const linhas = useMemo<LinhaApuracao[]>(() => {
    const ano = Number(verAno)
    const mes = Number(verMes)
    if (!ano || !mes) return []

    const pessoas = liderancasSetor.filter(p => filtroOperacao === 'todos' || p.operacao === filtroOperacao)

    const resultadosIdx = new Map(
      resultados.filter(r => r.ano === ano && r.mes === mes).map(r => [`${r.indicador}|${r.operacao_bi}`, r.valor]),
    )

    // Metas do BI agrupadas por indicador×operação (peso/negócio valem pro ano; valor é o do mês).
    interface MetaOp { indicador: string; operacao_bi: string; unidade: string; negocio: string; peso: number; valorMes: number | null }
    const metasOps = new Map<string, MetaOp>()
    for (const m of metas.filter(m => m.ano === ano)) {
      const chave = `${m.indicador}|${m.operacao_bi}`
      const atual = metasOps.get(chave)
        ?? { indicador: m.indicador, operacao_bi: m.operacao_bi, unidade: m.unidade, negocio: '', peso: 0, valorMes: null }
      if (m.negocio) atual.negocio = m.negocio
      if (m.peso) atual.peso = Number(m.peso)
      if (m.mes === mes) atual.valorMes = m.valor
      metasOps.set(chave, atual)
    }

    const dreMensal = rowsDre.filter(r => r.tipo_periodo === 'MENSAL' && r.ano === ano)

    return pessoas.map(pessoa => {
      const unidade = resolverUnidade(pessoa.operacao, unidades)
      const itens: ItemApuracao[] = []

      if (unidade) {
        // Indicadores do BI da operação/negócio da pessoa
        for (const mo of metasOps.values()) {
          if (mo.unidade !== unidade.codigo || mo.peso <= 0) continue
          if (!negocioCompativel(mo.negocio, pessoa.negocio)) continue

          const resultado = resultadosIdx.get(`${mo.indicador}|${mo.operacao_bi}`)
          let status: StatusItem
          let detalhe: string
          if (mo.valorMes === null) {
            status = 'pendente'
            detalhe = 'Sem meta importada pro mês'
          } else if (resultado === undefined) {
            status = 'pendente'
            detalhe = `Meta ${fmtPct(mo.valorMes)} · sem resultado importado`
          } else {
            const bateu = menorMelhor(mo.indicador) ? resultado <= mo.valorMes : resultado >= mo.valorMes
            status = bateu ? 'bateu' : 'perdeu'
            detalhe = `Resultado ${fmtPct(resultado)} · Meta ${fmtPct(mo.valorMes)}`
          }
          itens.push({
            chave: `bi|${mo.indicador}|${mo.operacao_bi}`,
            rotulo: mo.indicador,
            peso: mo.peso,
            status,
            detalhe: `${mo.operacao_bi} · Peso ${fmtPeso(mo.peso)}% · ${detalhe}`,
          })
        }

        // Indicadores do DRE do setor
        const rowsUnidade = dreMensal.filter(r => r.unidade === unidade.codigo)
        const negociosDre = Array.from(new Set(rowsUnidade.map(r => r.negocio)))
        const negocioDre = negocioDreDaPessoa(unidade.codigo, unidade.nome, pessoa.negocio, negociosDre)
        const rowsMes = rowsUnidade.filter(r => r.negocio === negocioDre && r.mes === mes)

        for (const ind of indicadoresDre) {
          const peso = pesosDre.get(ind.id) ?? 0
          if (peso <= 0) continue

          let status: StatusItem
          let detalhe: string
          if (rowsMes.length === 0) {
            status = 'pendente'
            detalhe = 'Sem DRE importado pro mês'
          } else if (ind.tipo === 'avr') {
            const calc = normalizarParaCalculo(rowsMes)
            const avr = avrPorPrefixo(calc, ind.prefixos)
            const meta = buscarMetaComFallback(calc, metasFarol, {
              unidade: unidade.codigo, negocio: negocioDre, ano, codigo: ind.id, isYtd: false, mes, prefixos: ind.prefixos,
            })
            if (meta === null) {
              status = 'pendente'
              detalhe = `AVR ${fmtPct(avr)} · sem meta cadastrada`
            } else {
              status = avr <= meta ? 'bateu' : 'perdeu'
              detalhe = `AVR ${fmtPct(avr)} · Meta ${fmtPct(meta)}`
            }
          } else {
            const valor = rowsMes
              .filter(r => ind.prefixos.some(p => r.conta_codigo.startsWith(p)))
              .reduce((acc, r) => acc + (r.diferenca ?? 0), 0)
            status = valor >= 0 ? 'bateu' : 'perdeu'
            detalhe = `Dispersão ${Math.round(valor).toLocaleString('pt-BR')} · meta ≥ 0 (sem estouro)`
          }
          itens.push({
            chave: `dre|${ind.id}`,
            rotulo: ind.nome,
            peso,
            status,
            detalhe: `${negocioDre} · Peso ${fmtPeso(peso)}% · ${detalhe}`,
          })
        }
      }

      const pctPossivel = itens.reduce((acc, i) => acc + i.peso, 0)
      const pctConquistado = itens.filter(i => i.status === 'bateu').reduce((acc, i) => acc + i.peso, 0)
      return {
        pessoa,
        unidadeOk: unidade !== undefined,
        itens,
        pctPossivel,
        pctConquistado,
        aReceber: pessoa.valor * pctConquistado / 100,
      }
    }).sort((a, b) =>
      a.pessoa.operacao.localeCompare(b.pessoa.operacao) || a.pessoa.nome.localeCompare(b.pessoa.nome),
    )
  }, [liderancasSetor, metas, resultados, pesosDre, rowsDre, metasFarol, unidades, verAno, verMes, filtroOperacao, indicadoresDre])

  const totalBase = linhas.reduce((acc, l) => acc + l.pessoa.valor, 0)
  const totalReceber = linhas.reduce((acc, l) => acc + l.aReceber, 0)

  const carregandoTudo = carregando || loadingDre || loadingMetasFarol

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={verAno} onValueChange={setVerAno}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={verMes} onValueChange={setVerMes}>
            <SelectTrigger className={cn('w-40', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Operação</Label>
          <Select value={filtroOperacao} onValueChange={setFiltroOperacao}>
            <SelectTrigger className={cn('w-52', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {operacoesDisponiveis.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TableCard
        titulo={`Apuração da RV — ${MESES_NOMES[Number(verMes) - 1] ?? ''} ${verAno}`}
        subtitulo={carregandoTudo
          ? 'Carregando...'
          : `Setor ${setorLabel} · ${linhas.length} liderança(s) · % conquistado = soma dos pesos dos indicadores batidos · pendente não soma`}
      >
        {carregandoTudo ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando apuração...
          </div>
        ) : linhas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {liderancas.length === 0
              ? 'Nenhuma liderança cadastrada — importe a RV das lideranças na página Importação, aba Gente.'
              : `Nenhuma liderança do setor ${setorLabel} no cadastro — confira a coluna SETOR da planilha de RV.`}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Negócio</TableHead>
                <TableHead>Indicadores do mês</TableHead>
                <TableHead className="text-center">% RV</TableHead>
                <TableHead className="text-right">RV (R$)</TableHead>
                <TableHead className="text-right">A receber (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map(l => (
                <TableRow
                  key={l.pessoa.id ?? l.pessoa.nome}
                  className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30"
                >
                  <TableCell className="text-sm font-medium">{l.pessoa.nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.pessoa.funcao || '—'}</TableCell>
                  <TableCell className="text-sm">{l.pessoa.operacao}</TableCell>
                  <TableCell className={cn(
                    'text-sm',
                    !l.pessoa.negocio || l.pessoa.negocio === 'CONS'
                      ? 'text-muted-foreground'
                      : 'font-semibold text-blue-600 dark:text-blue-400',
                  )}>
                    {l.pessoa.negocio || '—'}
                  </TableCell>
                  <TableCell>
                    {!l.unidadeOk ? (
                      <span
                        title="Nenhuma unidade cadastrada casa com essa operação — confira o nome/apelidos na Administração"
                        className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        operação não reconhecida
                      </span>
                    ) : l.itens.length === 0 ? (
                      <span className="text-xs text-muted-foreground">sem indicadores com peso</span>
                    ) : (
                      <div className="flex max-w-xl flex-wrap gap-1">
                        {l.itens.map(item => (
                          <span
                            key={item.chave}
                            title={item.detalhe}
                            className={cn(
                              'cursor-default rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                              item.status === 'bateu' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
                              item.status === 'perdeu' && 'bg-red-500/15 text-red-700 dark:text-red-400',
                              item.status === 'pendente' && 'bg-muted text-muted-foreground',
                            )}
                          >
                            {item.rotulo} · {fmtPeso(item.peso)}%
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell
                    title={l.pctPossivel > 0 ? `de ${fmtPeso(l.pctPossivel)}% possível no mês` : undefined}
                    className={cn(
                      'text-center text-sm font-semibold tabular-nums',
                      l.pctConquistado > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                    )}
                  >
                    {fmtPeso(l.pctConquistado)}%
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {fmtValor(l.pessoa.valor)}
                  </TableCell>
                  <TableCell className={cn(
                    'text-right text-sm font-semibold tabular-nums',
                    l.aReceber > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                  )}>
                    {fmtValor(l.aReceber)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-gray-200/30 dark:border-gray-700/30 bg-muted/40 font-semibold hover:bg-muted/40">
                <TableCell colSpan={6} className="text-sm">Total</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{fmtValor(totalBase)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums text-emerald-600 dark:text-emerald-400">
                  {fmtValor(totalReceber)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </TableCard>
    </div>
  )
}
