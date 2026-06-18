import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongo } from '@/hooks/useDreLongo'
import { useMetas } from '@/hooks/useMetas'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { MetaCard } from '@/components/farol/MetaCard'
import { EstouroZeroCard } from '@/components/farol/EstouroZeroCard'
import { ReducaoCard } from '@/components/farol/ReducaoCard'
import { FarolFilters } from '@/components/farol/FarolFilters'
import {
  PACOTES, PACOTES_RESUMO, PACOTES_GENTE, PACOTES_FROTA, PACOTES_SEGURANCA, PACOTES_ADM,
  ESTOURO_ZERO_CARDS, REDUCAO_CUSTOS_CARDS,
} from '@/lib/constants'
import {
  avrPorPrefixo, buscarMetaComFallback, calcularEstouroZero, calcularImpactoFinanceiro,
  calcularReceita, calcularReducaoCustos, calcularSemaforo, normalizarParaCalculo,
} from '@/lib/farol-calculations'
import type { DreLongoRow } from '@/types'

function unicos<T>(valores: T[]): T[] {
  return Array.from(new Set(valores))
}

export function FarolDeMetasPage() {
  const { role, unidade: minhaUnidade } = useAuth()
  const { unidades: todasUnidades, loading: loadingUnidades } = useUnidades()

  const unidadesDisponiveis = useMemo(() => {
    if (role === 'admin') return todasUnidades
    return todasUnidades.filter(u => u.codigo === minhaUnidade || u.codigo === 'AMBEV')
  }, [role, minhaUnidade, todasUnidades])

  const [selUnidade, setSelUnidade] = useState('')
  useEffect(() => {
    if (!selUnidade && unidadesDisponiveis.length > 0) setSelUnidade(unidadesDisponiveis[0].codigo)
  }, [unidadesDisponiveis, selUnidade])

  const { rows: rowsUnidade, loading: loadingDre } = useDreLongo(selUnidade || null)
  const { metas } = useMetas(selUnidade || null)

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

  const rowsAno = useMemo(() => rowsNegocio.filter(r => r.ano === selAno), [rowsNegocio, selAno])

  const mesesDisponiveis = useMemo(
    () => unicos(rowsAno.filter(r => r.tipo_periodo === 'MENSAL').map(r => r.mes)).sort((a, b) => a - b),
    [rowsAno],
  )
  const [selMes, setSelMes] = useState<number | null>(null)
  useEffect(() => {
    if (mesesDisponiveis.length === 0) return
    if (selMes && mesesDisponiveis.includes(selMes)) return
    setSelMes(mesesDisponiveis[mesesDisponiveis.length - 1])
  }, [mesesDisponiveis, selMes])

  const [isYtd, setIsYtd] = useState(false)
  const [selectedPacotes, setSelectedPacotes] = useState<Set<string>>(new Set(Object.keys(PACOTES)))
  function togglePacote(codigo: string) {
    setSelectedPacotes(prev => {
      const next = new Set(prev)
      next.has(codigo) ? next.delete(codigo) : next.add(codigo)
      return next
    })
  }

  const mesAcumMax = useMemo(() => {
    const acumRows = rowsAno.filter(r => r.tipo_periodo === 'ACUMULADO_ANO')
    return acumRows.length > 0 ? Math.max(...acumRows.map(r => r.mes)) : null
  }, [rowsAno])

  const dfBaseMensal = useMemo(
    () => rowsAno.filter(r => r.tipo_periodo === 'MENSAL' && r.mes === selMes),
    [rowsAno, selMes],
  )
  const dfBaseYtd = useMemo(
    () => (mesAcumMax === null ? [] : rowsAno.filter(r => r.tipo_periodo === 'ACUMULADO_ANO' && r.mes === mesAcumMax)),
    [rowsAno, mesAcumMax],
  )

  const dfBase = isYtd ? dfBaseYtd : dfBaseMensal
  const periodoTexto = isYtd ? `YTD (M${mesAcumMax ?? '-'})` : `Mensal (M${selMes ?? '-'})`

  const calcBase = useMemo(() => normalizarParaCalculo(dfBase), [dfBase])
  const receita = useMemo(() => calcularReceita(calcBase), [calcBase])

  function calcularIndicador(codigo: string) {
    const info = PACOTES[codigo]
    const avr = avrPorPrefixo(calcBase, info.prefixos)
    const meta = selAno === null || selMes === null
      ? null
      : buscarMetaComFallback(calcBase, metas, { unidade: selUnidade, negocio: selNegocio, ano: selAno, codigo, isYtd, mes: selMes, prefixos: info.prefixos })
    const semaforo = calcularSemaforo(avr, meta, info.natureza)
    const impacto = calcularImpactoFinanceiro(avr, meta, receita, info.natureza)
    return { info, avr, meta, semaforo, impacto }
  }

  function renderCards(codigos: string[], mostrarTodos = false) {
    const lista = mostrarTodos ? codigos : codigos.filter(c => selectedPacotes.has(c))
    if (lista.length === 0) {
      return <p className="text-sm text-muted-foreground">Nenhum indicador selecionado para esta categoria.</p>
    }
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {lista.map(codigo => {
          const { info, avr, meta, semaforo, impacto } = calcularIndicador(codigo)
          return (
            <MetaCard
              key={codigo}
              nome={info.nome}
              periodoTexto={periodoTexto}
              avr={avr}
              meta={meta}
              impacto={impacto}
              semaforo={semaforo}
            />
          )
        })}
      </div>
    )
  }

  function rowsParaReducao(ano: number, contas: string[], mesLimite: number): DreLongoRow[] {
    return rowsNegocio.filter(r =>
      r.tipo_periodo === 'MENSAL' && r.ano === ano && (isYtd ? r.mes <= mesLimite : r.mes === mesLimite)
      && contas.some(c => r.conta_codigo.startsWith(c)),
    )
  }

  const carregando = loadingUnidades || loadingDre

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
      <FarolFilters
        unidades={unidadesDisponiveis.map(u => ({ value: u.codigo, label: u.nome }))}
        negocios={negociosDisponiveis.map(n => ({ value: n, label: n }))}
        anos={anosDisponiveis}
        meses={mesesDisponiveis}
        selUnidade={selUnidade}
        selNegocio={selNegocio}
        selAno={selAno ?? 0}
        selMes={selMes ?? 0}
        isYtd={isYtd}
        selectedPacotes={selectedPacotes}
        onUnidadeChange={v => { setSelUnidade(v); setSelNegocio(''); setSelAno(null); setSelMes(null) }}
        onNegocioChange={v => { setSelNegocio(v); setSelAno(null); setSelMes(null) }}
        onAnoChange={setSelAno}
        onMesChange={setSelMes}
        onModoChange={setIsYtd}
        onTogglePacote={togglePacote}
      />

      {dfBase.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum DRE importado para esse período ainda.</p>
      ) : (
        <Tabs defaultValue="resumo">
          <TabsList>
            <TabsTrigger value="resumo">Resumo Geral</TabsTrigger>
            <TabsTrigger value="gente">Pacote de Gente</TabsTrigger>
            <TabsTrigger value="frota">Pacote de Frota</TabsTrigger>
            <TabsTrigger value="seguranca">Pacote de Segurança</TabsTrigger>
            <TabsTrigger value="adm">Pacote ADM</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="pt-4">
            {renderCards(PACOTES_RESUMO)}
          </TabsContent>

          <TabsContent value="gente" className="space-y-6 pt-4">
            {renderCards(PACOTES_GENTE, true)}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {ESTOURO_ZERO_CARDS.map(card => (
                <EstouroZeroCard
                  key={card.nome}
                  nome={card.nome}
                  periodoTexto={periodoTexto}
                  resultado={calcularEstouroZero(calcBase, card.prefixos)}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="frota" className="pt-4">
            {renderCards(PACOTES_FROTA, true)}
          </TabsContent>

          <TabsContent value="seguranca" className="pt-4">
            {renderCards(PACOTES_SEGURANCA, true)}
          </TabsContent>

          <TabsContent value="adm" className="space-y-6 pt-4">
            {renderCards(PACOTES_ADM, true)}
            {selAno !== null && (mesAcumMax !== null || selMes !== null) && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {REDUCAO_CUSTOS_CARDS.map(card => {
                  const mesLimite = isYtd ? (mesAcumMax ?? 0) : (selMes ?? 0)
                  const calcAtual = normalizarParaCalculo(rowsParaReducao(selAno, card.contas, mesLimite))
                  const calcAnterior = normalizarParaCalculo(rowsParaReducao(selAno - 1, card.contas, mesLimite))
                  return (
                    <ReducaoCard
                      key={card.nome}
                      nome={card.nome}
                      periodoTexto={periodoTexto}
                      resultado={calcularReducaoCustos(calcAtual, calcAnterior, card.contas)}
                    />
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
