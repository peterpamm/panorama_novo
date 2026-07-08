import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongo } from '@/hooks/useDreLongo'
import { useContas } from '@/hooks/useContas'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContaCombobox } from '@/components/analise-conta/ContaCombobox'
import { ResumoCards } from '@/components/analise-conta/ResumoCards'
import { EvolucaoChart } from '@/components/analise-conta/EvolucaoChart'
import { DetalhesTable } from '@/components/analise-conta/DetalhesTable'
import { AberturaContas } from '@/components/analise-conta/AberturaContas'
import { AnoVsAnoPanel } from '@/components/analise-conta/AnoVsAnoPanel'
import { CONTA_RECEITA } from '@/lib/constants'
import { normalizarParaCalculo } from '@/lib/farol-calculations'
import { calcularResumoConta, calcularSerieMensalConta } from '@/lib/analise-conta-calculations'

function unicos<T>(valores: T[]): T[] {
  return Array.from(new Set(valores))
}

export function AnalisePorContaPage() {
  const { role, unidade: minhaUnidade } = useAuth()
  const { unidades: todasUnidades, loading: loadingUnidades } = useUnidades()
  const { contas, loading: loadingContas } = useContas()

  const unidadesDisponiveis = useMemo(() => {
    if (role === 'admin') return todasUnidades
    return todasUnidades.filter(u => u.codigo === minhaUnidade || u.codigo === 'AMBEV')
  }, [role, minhaUnidade, todasUnidades])

  const [selUnidade, setSelUnidade] = useState('')
  useEffect(() => {
    if (!selUnidade && unidadesDisponiveis.length > 0) setSelUnidade(unidadesDisponiveis[0].codigo)
  }, [unidadesDisponiveis, selUnidade])

  const { rows: rowsUnidade, loading: loadingDre } = useDreLongo(selUnidade || null)

  const negociosDisponiveis = useMemo(() => unicos(rowsUnidade.map(r => r.negocio)).sort(), [rowsUnidade])
  const [selNegocio, setSelNegocio] = useState('')
  useEffect(() => {
    if (negociosDisponiveis.length === 0) return
    if (selNegocio && negociosDisponiveis.includes(selNegocio)) return
    setSelNegocio(negociosDisponiveis.includes('CONS') ? 'CONS' : negociosDisponiveis[0])
  }, [negociosDisponiveis, selNegocio])

  const rowsNegocio = useMemo(() => rowsUnidade.filter(r => r.negocio === selNegocio), [rowsUnidade, selNegocio])

  const anosDisponiveis = useMemo(() => unicos(rowsNegocio.map(r => r.ano)).sort((a, b) => a - b), [rowsNegocio])
  const [selAno, setSelAno] = useState<number | null>(null)
  useEffect(() => {
    if (anosDisponiveis.length === 0) return
    if (selAno && anosDisponiveis.includes(selAno)) return
    setSelAno(anosDisponiveis[anosDisponiveis.length - 1])
  }, [anosDisponiveis, selAno])

  const rowsNegocioAno = useMemo(() => rowsNegocio.filter(r => r.ano === selAno), [rowsNegocio, selAno])
  const nomesPorCodigo = useMemo(() => new Map(contas.map(c => [c.codigo, c.descricao])), [contas])

  const [selConta, setSelConta] = useState(CONTA_RECEITA)
  const [selContaAnoVsAno, setSelContaAnoVsAno] = useState(CONTA_RECEITA)

  const rowsContaAtual = useMemo(
    () => rowsNegocio.filter(r => r.ano === selAno && r.conta_codigo === selConta && r.tipo_periodo === 'MENSAL'),
    [rowsNegocio, selAno, selConta],
  )
  const rowsContaAnterior = useMemo(
    () => rowsNegocio.filter(r => r.ano === (selAno ?? 0) - 1 && r.conta_codigo === selConta && r.tipo_periodo === 'MENSAL'),
    [rowsNegocio, selAno, selConta],
  )
  const rowsContaTodosAnos = useMemo(
    () => rowsNegocio.filter(r => r.conta_codigo === selContaAnoVsAno && r.tipo_periodo === 'MENSAL'),
    [rowsNegocio, selContaAnoVsAno],
  )

  const calcAtual = useMemo(() => normalizarParaCalculo(rowsContaAtual), [rowsContaAtual])
  const calcAnterior = useMemo(() => normalizarParaCalculo(rowsContaAnterior), [rowsContaAnterior])
  const resumo = useMemo(() => calcularResumoConta(calcAtual, calcAnterior), [calcAtual, calcAnterior])
  const serieMensal = useMemo(() => calcularSerieMensalConta(rowsContaAtual), [rowsContaAtual])

  const nomeConta = contas.find(c => c.codigo === selConta)?.descricao ?? selConta
  const nomeContaAnoVsAno = contas.find(c => c.codigo === selContaAnoVsAno)?.descricao ?? selContaAnoVsAno

  const carregando = loadingUnidades || loadingDre || loadingContas

  if (carregando && !selUnidade) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (unidadesDisponiveis.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma unidade disponível para o seu usuário.</p>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Unidade</Label>
          <Select value={selUnidade} onValueChange={v => { setSelUnidade(v); setSelNegocio(''); setSelAno(null) }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {unidadesDisponiveis.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Negócio</Label>
          <Select value={selNegocio} onValueChange={v => { setSelNegocio(v); setSelAno(null) }}>
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
      </div>

      <Tabs defaultValue="conta">
        <TabsList>
          <TabsTrigger value="conta">Visão da conta</TabsTrigger>
          <TabsTrigger value="anovsano">Ano vs Ano</TabsTrigger>
          <TabsTrigger value="abertura">Abertura de Contas</TabsTrigger>
        </TabsList>

        <TabsContent value="conta" className="space-y-6 pt-4">
          <div className="max-w-md space-y-1.5">
            <Label>Conta</Label>
            <ContaCombobox contas={contas} value={selConta} onChange={setSelConta} />
          </div>

          {rowsContaAtual.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dado importado para essa conta neste período.</p>
          ) : (
            <>
              <ResumoCards resumo={resumo} />
              <EvolucaoChart serie={serieMensal} />
              <DetalhesTable serie={serieMensal} nomeConta={nomeConta} ano={selAno ?? 0} />
            </>
          )}
        </TabsContent>

        <TabsContent value="anovsano" className="space-y-6 pt-4">
          <div className="max-w-md space-y-1.5">
            <Label>Conta</Label>
            <ContaCombobox contas={contas} value={selContaAnoVsAno} onChange={setSelContaAnoVsAno} />
          </div>
          <AnoVsAnoPanel rowsContaTodosAnos={rowsContaTodosAnos} nomeConta={nomeContaAnoVsAno} />
        </TabsContent>

        <TabsContent value="abertura" className="pt-4">
          <AberturaContas rowsNegocioAno={rowsNegocioAno} nomesPorCodigo={nomesPorCodigo} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
