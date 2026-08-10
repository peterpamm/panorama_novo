import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'
import { CONTAS_ORCAMENTO_USADAS } from '@/lib/constants'
import { fetchOrcamentoPaginado } from '@/lib/orcamento-fetch'
import type { DreLongoRow, MetaPerdas, OrcamentoLinha, PainelPerdasAux, Unidade } from '@/types'

interface DataContextValue {
  rowsDreTodas: DreLongoRow[]
  rowsAux: PainelPerdasAux[]
  metasPerdas: MetaPerdas[]
  orcamentos: OrcamentoLinha[]
  unidades: Unidade[]
  loading: boolean
  error: string | null
  /** Recarrega os datasets sem refresh da view materializada (ex: navegação pós-erro). */
  revalidar: () => Promise<void>
  /** Atualiza a view materializada no Supabase e depois recarrega os datasets. Chame após importação de DRE. */
  revalidarAposImport: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

/**
 * Busca uma tabela/view unidade por unidade, em vez de paginar por
 * OFFSET/LIMIT numérico crescente. OFFSET fica mais caro a cada página numa
 * tabela que só cresce (o Postgres precisa pular cada vez mais linha antes
 * de responder) — isso já estava estourando o statement_timeout do projeto,
 * e aumentar o timeout (`ALTER ROLE ... SET statement_timeout`) não
 * resolveu, então o teto de verdade está em outra camada (provavelmente o
 * pooler de conexões do Supabase), fora do nosso controle. Filtrar por
 * `unidade = código` é um lookup indexado direto (mesmo índice que já
 * existe, ex: idx_mv_dre_longo_unidade) — não importa quão grande a tabela
 * fique, cada busca individual continua rápida. Pra conta de unidade, a
 * maioria dessas buscas volta vazia na hora (RLS já filtra fora das outras
 * unidades) — só a própria + AMBEV (se aplicável) trazem dado de verdade.
 */
/**
 * `colunasOrdem` é obrigatório porque `.range()` sem `.order()` não tem
 * ordem garantida entre duas chamadas separadas — o Postgres pode devolver
 * as linhas em ordens diferentes a cada execução (replanejamento, atividade
 * concorrente etc.), então a página 1 pode pular ou repetir linhas que
 * "deveriam" ter vindo na página 0. Numa tabela pequena isso nunca aparece
 * (uma unidade nunca passa de PAGE linhas, então só existe uma página) — mas
 * o `mv_dre_longo` de uma unidade grande passa fácil de 10k linhas (contas ×
 * meses × tipo_período × anos × negócios), então a paginação de verdade entra
 * em ação, e sem ordem determinística uma unidade específica pode perder
 * linhas de forma imprevisível a cada carregamento (foi exatamente esse o bug
 * relatado: resultado de EBITDA zerado só numa unidade, mudando de unidade a
 * cada F5). As colunas passadas não precisam ser uma chave única sozinhas —
 * só precisam, juntas, dar uma ordem estável e repetível pra paginação.
 */
async function fetchPorUnidade<T>(tabela: string, codigosUnidades: string[], colunasOrdem: string[]): Promise<T[]> {
  const PAGE = 10000   // por unidade — não deveria nunca disparar na prática, é só precaução
  const CONCURRENT = 5

  async function buscarUnidade(codigo: string): Promise<T[]> {
    const linhasUnidade: T[] = []
    let pagina = 0
    let acabou = false
    while (!acabou) {
      let query = supabase.from(tabela).select('*').eq('unidade', codigo)
      for (const coluna of colunasOrdem) query = query.order(coluna, { ascending: true })
      const { data, error } = await query.range(pagina * PAGE, (pagina + 1) * PAGE - 1)
      if (error) throw error
      const dados = data as T[]
      linhasUnidade.push(...dados)
      if (dados.length < PAGE) acabou = true
      pagina++
    }
    return linhasUnidade
  }

  const linhas: T[] = []
  for (let i = 0; i < codigosUnidades.length; i += CONCURRENT) {
    const resultados = await Promise.all(codigosUnidades.slice(i, i + CONCURRENT).map(buscarUnidade))
    for (const r of resultados) linhas.push(...r)
  }
  return linhas
}

/**
 * Provider que busca os três datasets pesados uma única vez por sessão e os
 * compartilha com todas as páginas. Navegar entre Farol → Ranking → Painel de
 * Perdas não refaz nenhum fetch — os dados já estão em memória.
 *
 * Após uma importação de DRE, chame `revalidarAposImport()` para atualizar
 * a view materializada no Supabase e recarregar o cache.
 */
export function DataProvider({ children }: { children: React.ReactNode }) {
  const [rowsDreTodas, setRowsDreTodas] = useState<DreLongoRow[]>([])
  const [rowsAux, setRowsAux] = useState<PainelPerdasAux[]>([])
  const [metasPerdas, setMetasPerdas] = useState<MetaPerdas[]>([])
  const [orcamentos, setOrcamentos] = useState<OrcamentoLinha[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const ultimaBuscaRef = useRef(0)

  const carregar = useCallback(async (opts?: { silencioso?: boolean }) => {
    ultimaBuscaRef.current = Date.now()
    // Sessão recém-trocada (ex: logout/login na mesma aba, ou o mount inicial
    // logo após o login) — o token pode não estar 100% pronto ainda nesse
    // instante. getSession() garante (renovando se preciso) que a busca sai
    // com um token válido — senão RLS (que exige `authenticated`) filtra
    // tudo pra vazio sem erro nenhum, e a tela mostra "sem unidade"/"sem
    // dado" mesmo com a conta certa, até uma busca seguinte por acaso sair
    // certa (mesmo bug que já corrigimos na revalidação por foco — aqui é a
    // mesma causa, só que no carregamento inicial).
    await supabase.auth.getSession()
    if (!opts?.silencioso) setLoading(true)
    setError(null)

    // Unidades primeiro — pequena e rápida (nunca pagina, nunca teve
    // problema de timeout), e as buscas pesadas abaixo precisam da lista de
    // códigos pra paginar por unidade em vez de por OFFSET numérico.
    const unidadesResult = await supabase.from('unidades').select('*').order('nome')
    if (unidadesResult.error) {
      setError(`Unidades: ${unidadesResult.error.message}`)
      if (!opts?.silencioso) setLoading(false)
      return
    }
    const unidadesRows = unidadesResult.data as Unidade[]
    setUnidades(unidadesRows)
    const codigosUnidades = unidadesRows.map(u => u.codigo)

    // Promise.allSettled, não Promise.all: uma busca falhar (estourar
    // timeout etc) não pode derrubar as outras junto.
    const [dreR, auxR, metasR, orcamentoR] = await Promise.allSettled([
      fetchPorUnidade<DreLongoRow>('mv_dre_longo', codigosUnidades, ['negocio', 'ano', 'mes', 'tipo_periodo', 'conta_codigo']),
      fetchPorUnidade<PainelPerdasAux>('painel_perdas_aux', codigosUnidades, ['id']),
      fetchPorUnidade<MetaPerdas>('metas_perdas', codigosUnidades, ['id']),
      // Sem filtro de ano, essa busca (a única no cache global sem escopo por
      // ano) puxa TODO o histórico de orçamento já importado — cresce a cada
      // ano e, com paginação por OFFSET, cada página fica mais lenta que a
      // anterior; nenhuma tela do app olha além de "ano atual - 2" (ver ANOS
      // no Farol/RV/Ranking/Reunião), então limita a isso.
      fetchOrcamentoPaginado((from, to) =>
        supabase.from('orcamentos').select('*')
          .in('conta_codigo', CONTAS_ORCAMENTO_USADAS)
          .gte('ano', new Date().getFullYear() - 2)
          .range(from, to),
      ),
    ])

    const erros: string[] = []
    if (dreR.status === 'fulfilled') setRowsDreTodas(dreR.value)
    else erros.push(`DRE: ${(dreR.reason as Error)?.message ?? dreR.reason}`)

    if (auxR.status === 'fulfilled') setRowsAux(auxR.value)
    else erros.push(`Painel de Perdas: ${(auxR.reason as Error)?.message ?? auxR.reason}`)

    if (metasR.status === 'fulfilled') setMetasPerdas(metasR.value)
    else erros.push(`Metas de Perdas: ${(metasR.reason as Error)?.message ?? metasR.reason}`)

    if (orcamentoR.status === 'fulfilled') setOrcamentos(orcamentoR.value)
    else erros.push(`Orçamento: ${(orcamentoR.reason as Error)?.message ?? orcamentoR.reason}`)

    if (erros.length > 0) setError(erros.join(' · '))
    if (!opts?.silencioso) setLoading(false)
  }, [])

  const revalidarAposImport = useCallback(async () => {
    await supabase.rpc('refresh_mv_dre_longo')
    await carregar()
  }, [carregar])

  useEffect(() => {
    carregar()
  }, [carregar])

  // A busca acima só acontece 1x por sessão (de propósito, pra não repetir
  // uma busca pesada a cada navegação) — mas isso significa que, se alguém
  // importa/corrige DRE ou Orçamento enquanto essa aba já estava aberta em
  // outra tela, ela nunca fica sabendo, e mostra número desatualizado sem
  // nenhum aviso até um F5 forçado. Refaz a busca sozinho (em silêncio, sem
  // piscar loading) sempre que a aba volta a ficar visível/em foco, contanto
  // que a última busca não tenha sido muito recente — evita repetir a busca
  // toda vez que alguém só troca de aba rapidinho.
  useEffect(() => {
    const INTERVALO_MINIMO_MS = 10 * 60 * 1000

    function talvezRevalidar() {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - ultimaBuscaRef.current < INTERVALO_MINIMO_MS) return
      carregar({ silencioso: true })
    }

    window.addEventListener('focus', talvezRevalidar)
    document.addEventListener('visibilitychange', talvezRevalidar)
    return () => {
      window.removeEventListener('focus', talvezRevalidar)
      document.removeEventListener('visibilitychange', talvezRevalidar)
    }
  }, [carregar])

  // Sem isso, uma falha na busca inicial (rede/timeout) deixa os dados
  // vazios pro resto da sessão e cada tela mostra "sem dados"/"sem meta
  // cadastrada" — parecendo um problema de dados quando na verdade é a
  // busca que falhou.
  useEffect(() => {
    if (error) {
      toast({
        title: 'Erro ao carregar dados do DRE/Orçamento',
        description: `${error} — recarregue a página pra tentar de novo.`,
        variant: 'destructive',
      })
    }
  }, [error, toast])

  return (
    <DataContext.Provider
      value={{ rowsDreTodas, rowsAux, metasPerdas, orcamentos, unidades, loading, error, revalidar: carregar, revalidarAposImport }}
    >
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData precisa estar dentro de DataProvider')
  return ctx
}
