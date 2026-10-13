import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useOrcamentoTodasUnidades } from '@/hooks/useOrcamentoTodasUnidades'
import { FilterLabel } from '@/components/farol/FarolFilters'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { PacoteDeFrotaDetalhado } from '@/pages/analise-detalhada/PacoteDeFrotaDetalhado'

const ANO_ATUAL = new Date().getFullYear()
const ANOS_OPCOES = [ANO_ATUAL + 1, ANO_ATUAL, ANO_ATUAL - 1]
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MES_ATUAL = new Date().getMonth() + 1
const MES_INICIAL = MES_ATUAL === 1 ? 12 : MES_ATUAL - 1
const ANO_MES_INICIAL = MES_ATUAL === 1 ? ANO_ATUAL - 1 : ANO_ATUAL

/**
 * "Pacote de Frota" dentro de Análise Detalhada — mesmo padrão de busca que
 * `AnaliseDetalhadaPacoteDeGentePage.tsx` usa pra aba Unidade: DRE (todos os
 * anos — a abertura precisa do ano anterior pro comparativo) e Orçamento do
 * ano selecionado, vindos do cache global (`useDreLongoTodasUnidades`/
 * `useOrcamentoTodasUnidades`, sem fetch próprio) e filtrados pela unidade
 * selecionada em memória. Sem aba Corporativo por ora (não pedida ainda) —
 * só o filtro de Unidade/Negócio/Ano/Mês de sempre, admin escolhe a
 * unidade, usuário de unidade fica travado na própria. Renderiza
 * `PacoteDeFrotaDetalhado` (cópia independente do slide "Pacote de Frota"
 * do SDG Gerentes).
 */
export function AnaliseDetalhadaPacoteDeFrotaPage() {
  const { role, unidade: minhaUnidade } = useAuth()
  const { unidades: todasUnidades, loading: loadingUnidades } = useUnidades()

  const unidadesDisponiveis = useMemo(() => {
    const base = todasUnidades.filter(u => u.codigo !== 'AMBEV')
    return role === 'admin' ? base : base.filter(u => u.codigo === minhaUnidade)
  }, [role, minhaUnidade, todasUnidades])

  const [selUnidade, setSelUnidade] = useState('')
  useEffect(() => {
    if (!selUnidade && unidadesDisponiveis.length > 0) setSelUnidade(unidadesDisponiveis[0].codigo)
  }, [unidadesDisponiveis, selUnidade])

  const [selNegocio, setSelNegocio] = useState<'CONS' | 'ROTA' | 'ARM'>('CONS')
  const [selAno, setSelAno] = useState(ANO_MES_INICIAL)
  const [selMes, setSelMes] = useState(MES_INICIAL)

  const { rows: rowsTodasUnidades, loading: loadingDre } = useDreLongoTodasUnidades()
  const { orcamentos: orcamentosTodasUnidades } = useOrcamentoTodasUnidades()

  const rowsDre = useMemo(() => rowsTodasUnidades.filter(r => r.unidade === selUnidade), [rowsTodasUnidades, selUnidade])
  const rowsUnidadeCons = useMemo(() => rowsDre.filter(r => r.negocio === selNegocio), [rowsDre, selNegocio])
  const orcamentoRows = useMemo(
    () => orcamentosTodasUnidades.filter(o => o.unidade === selUnidade && o.negocio === selNegocio && o.ano === selAno),
    [orcamentosTodasUnidades, selUnidade, selNegocio, selAno],
  )

  const carregando = loadingUnidades || loadingDre

  if (carregando && !selUnidade) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (unidadesDisponiveis.length === 0) {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-gray-200/30 bg-white/60 p-8 text-center shadow-xl dark:border-gray-700/30 dark:bg-gray-800/60">
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma unidade disponível para o seu usuário.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="mb-6 rounded-2xl border border-white/10 bg-gradient-to-r from-[hsl(222,45%,20%)] to-[hsl(222,35%,30%)] shadow-xl shadow-blue-900/20 dark:from-[hsl(224,28%,14%)] dark:to-[hsl(224,22%,20%)]">
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-4 md:p-6">
          <div className="space-y-1.5">
            <FilterLabel>Unidade</FilterLabel>
            <Select value={selUnidade} onValueChange={setSelUnidade}>
              <SelectTrigger className="border-white/20 bg-white/10 text-white hover:bg-white/20 focus:ring-white/30">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="border border-gray-200/30 bg-white/90 backdrop-blur-xl dark:border-gray-700/30 dark:bg-gray-800/90">
                {unidadesDisponiveis.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FilterLabel>Negócio</FilterLabel>
            <Select value={selNegocio} onValueChange={v => setSelNegocio(v as typeof selNegocio)}>
              <SelectTrigger className="border-white/20 bg-white/10 text-white hover:bg-white/20 focus:ring-white/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border border-gray-200/30 bg-white/90 backdrop-blur-xl dark:border-gray-700/30 dark:bg-gray-800/90">
                <SelectItem value="CONS">Consolidado</SelectItem>
                <SelectItem value="ROTA">Rota</SelectItem>
                <SelectItem value="ARM">Armazém</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FilterLabel>Mês</FilterLabel>
            <Select value={String(selMes)} onValueChange={v => setSelMes(Number(v))}>
              <SelectTrigger className="border-white/20 bg-white/10 text-white hover:bg-white/20 focus:ring-white/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border border-gray-200/30 bg-white/90 backdrop-blur-xl dark:border-gray-700/30 dark:bg-gray-800/90">
                {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <FilterLabel>Ano</FilterLabel>
            <Select value={String(selAno)} onValueChange={v => setSelAno(Number(v))}>
              <SelectTrigger className="border-white/20 bg-white/10 text-white hover:bg-white/20 focus:ring-white/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border border-gray-200/30 bg-white/90 backdrop-blur-xl dark:border-gray-700/30 dark:bg-gray-800/90">
                {ANOS_OPCOES.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <PacoteDeFrotaDetalhado
        rowsUnidadeCons={rowsUnidadeCons}
        orcamentoAno={orcamentoRows}
        unidade={selUnidade}
        negocio={selNegocio}
        ano={selAno}
        mes={selMes}
      />
    </div>
  )
}
