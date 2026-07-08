import { useEffect, useMemo, useState } from 'react'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useMetasTodasUnidades } from '@/hooks/useMetasTodasUnidades'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RankingTabelaIndicador, RankingTabelaReceita } from '@/components/ranking/RankingTabelas'
import { UnidadesMultiSelect } from '@/components/ranking/UnidadesMultiSelect'
import { PACOTES, RANKING_CUSTOS, RANKING_PERFORMANCE } from '@/lib/constants'
import { calcularRankingIndicador, calcularRankingReceita } from '@/lib/ranking-calculations'
import { MES_ABREV } from '@/components/farol/chart-shared'

function unicos<T>(valores: T[]): T[] {
  return Array.from(new Set(valores))
}

export function RankingPage() {
  const { unidades, loading: loadingUnidades } = useUnidades()
  const { rows, loading: loadingDre } = useDreLongoTodasUnidades()
  const { metas, loading: loadingMetas } = useMetasTodasUnidades()

  const nomesUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  // Filtro de unidades (checkbox) — começa com todas marcadas (mesmo comportamento de
  // antes); só passa a restringir quando o usuário desmarcar alguma.
  const [selUnidades, setSelUnidades] = useState<Set<string>>(new Set())
  const [unidadesInicializadas, setUnidadesInicializadas] = useState(false)
  useEffect(() => {
    if (!unidadesInicializadas && unidades.length > 0) {
      setSelUnidades(new Set(unidades.map(u => u.codigo)))
      setUnidadesInicializadas(true)
    }
  }, [unidades, unidadesInicializadas])

  function toggleUnidade(codigo: string) {
    setSelUnidades(prev => {
      const novo = new Set(prev)
      if (novo.has(codigo)) novo.delete(codigo)
      else novo.add(codigo)
      return novo
    })
  }

  const rowsFiltradas = useMemo(
    () => (unidadesInicializadas ? rows.filter(r => selUnidades.has(r.unidade)) : rows),
    [rows, selUnidades, unidadesInicializadas],
  )

  const negociosDisponiveis = useMemo(() => unicos(rowsFiltradas.map(r => r.negocio)).sort(), [rowsFiltradas])
  const [selNegocio, setSelNegocio] = useState('')
  useEffect(() => {
    if (negociosDisponiveis.length === 0) return
    if (selNegocio && negociosDisponiveis.includes(selNegocio)) return
    setSelNegocio(negociosDisponiveis.includes('CONS') ? 'CONS' : negociosDisponiveis[0])
  }, [negociosDisponiveis, selNegocio])

  const rowsNegocio = useMemo(() => rowsFiltradas.filter(r => r.negocio === selNegocio), [rowsFiltradas, selNegocio])

  const anosDisponiveis = useMemo(() => unicos(rowsNegocio.map(r => r.ano)).sort((a, b) => a - b), [rowsNegocio])
  const [selAno, setSelAno] = useState<number | null>(null)
  useEffect(() => {
    if (anosDisponiveis.length === 0) return
    if (selAno && anosDisponiveis.includes(selAno)) return
    setSelAno(anosDisponiveis[anosDisponiveis.length - 1])
  }, [anosDisponiveis, selAno])

  const rowsNegocioAno = useMemo(() => rowsNegocio.filter(r => r.ano === selAno), [rowsNegocio, selAno])

  const mesesDisponiveis = useMemo(
    () => unicos(rowsNegocioAno.filter(r => r.tipo_periodo === 'MENSAL').map(r => r.mes)).sort((a, b) => a - b),
    [rowsNegocioAno],
  )
  const [selMes, setSelMes] = useState<number | null>(null)
  useEffect(() => {
    if (mesesDisponiveis.length === 0) return
    if (selMes && mesesDisponiveis.includes(selMes)) return
    setSelMes(mesesDisponiveis[mesesDisponiveis.length - 1])
  }, [mesesDisponiveis, selMes])

  const [isYtd, setIsYtd] = useState(false)

  const metasNegocioAno = useMemo(() => metas.filter(m => m.negocio === selNegocio && m.ano === selAno), [metas, selNegocio, selAno])

  const rankingReceita = useMemo(
    () => calcularRankingReceita(rowsNegocioAno, metasNegocioAno, { negocio: selNegocio, ano: selAno ?? 0 }),
    [rowsNegocioAno, metasNegocioAno, selNegocio, selAno],
  )

  const rankingPerformance = useMemo(
    () => RANKING_PERFORMANCE.map(codigo => ({
      codigo,
      info: PACOTES[codigo],
      linhas: calcularRankingIndicador(rowsNegocioAno, metasNegocioAno, PACOTES[codigo], codigo, {
        negocio: selNegocio, ano: selAno ?? 0, isYtd, mes: selMes ?? 0,
      }),
    })),
    [rowsNegocioAno, metasNegocioAno, selNegocio, selAno, isYtd, selMes],
  )

  const rankingCustos = useMemo(
    () => RANKING_CUSTOS.map(codigo => ({
      codigo,
      info: PACOTES[codigo],
      linhas: calcularRankingIndicador(rowsNegocioAno, metasNegocioAno, PACOTES[codigo], codigo, {
        negocio: selNegocio, ano: selAno ?? 0, isYtd, mes: selMes ?? 0,
      }),
    })),
    [rowsNegocioAno, metasNegocioAno, selNegocio, selAno, isYtd, selMes],
  )

  const carregando = loadingUnidades || loadingDre || loadingMetas

  if (carregando && rows.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum dado disponível para o seu usuário.</p>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Unidades</Label>
          <UnidadesMultiSelect
            opcoes={unidades.map(u => ({ codigo: u.codigo, nome: u.nome }))}
            selecionadas={selUnidades}
            onToggle={toggleUnidade}
            onSelecionarTodas={() => setSelUnidades(new Set(unidades.map(u => u.codigo)))}
            onLimpar={() => setSelUnidades(new Set())}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Negócio</Label>
          <Select value={selNegocio} onValueChange={v => { setSelNegocio(v); setSelAno(null); setSelMes(null) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {negociosDisponiveis.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Select value={String(selAno ?? '')} onValueChange={v => setSelAno(Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mês</Label>
          <Select value={String(selMes ?? '')} onValueChange={v => setSelMes(Number(v))} disabled={isYtd}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {mesesDisponiveis.map(m => <SelectItem key={m} value={String(m)}>{MES_ABREV[m] ?? m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {negociosDisponiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma unidade selecionada, ou sem dados pra essa seleção.</p>
      ) : (
        <>
          <RadioGroup className="flex gap-6" value={isYtd ? 'Anual' : 'Mensal'} onValueChange={v => setIsYtd(v === 'Anual')}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="Mensal" id="ranking-mensal" />
              <Label htmlFor="ranking-mensal">Mensal</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="Anual" id="ranking-anual" />
              <Label htmlFor="ranking-anual">Anual (YTD)</Label>
            </div>
          </RadioGroup>

          <Tabs defaultValue="receita">
            <TabsList>
              <TabsTrigger value="receita">Receita</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="custos">Custos</TabsTrigger>
            </TabsList>

            <TabsContent value="receita" className="space-y-2 pt-4">
              <p className="text-xs text-muted-foreground">Ranqueado por % de atingimento da meta anual de receita (sempre acumulado do ano, independente do modo Mensal/Anual escolhido).</p>
              <RankingTabelaReceita linhas={rankingReceita} nomesUnidade={nomesUnidade} />
            </TabsContent>

            <TabsContent value="performance" className="space-y-6 pt-4">
              {rankingPerformance.map(({ codigo, info, linhas }) => (
                <div key={codigo} className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">{info.nome}</h3>
                  <RankingTabelaIndicador linhas={linhas} nomesUnidade={nomesUnidade} />
                </div>
              ))}
            </TabsContent>

            <TabsContent value="custos" className="space-y-6 pt-4">
              {rankingCustos.map(({ codigo, info, linhas }) => (
                <div key={codigo} className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">{info.nome}</h3>
                  <RankingTabelaIndicador linhas={linhas} nomesUnidade={nomesUnidade} />
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
