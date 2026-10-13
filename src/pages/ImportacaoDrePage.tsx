import { useEffect, useMemo, useState } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useData } from '@/context/DataContext'
import { useUnidades } from '@/hooks/useUnidades'
import { useContas } from '@/hooks/useContas'
import { parseDreXlsx, type ParseDreResult } from '@/lib/dre-xlsx-parser'
import { parseDreFilename, type DreFilenameInfo } from '@/lib/dre-filename-parser'
import { detectarAlteracoes, mesesParaComparar } from '@/lib/dre-diff-detector'
import { PastaDropzone } from '@/components/importacao/PastaDropzone'
import { ResolverUnidadesPanel } from '@/components/importacao/ResolverUnidadesPanel'
import { RelatorioAlteracoes } from '@/components/importacao/RelatorioAlteracoes'
import { ImportarPainelPerdasAuxDialog } from '@/components/importacao/ImportarPainelPerdasAuxDialog'
import { ImportarDisponibilidadeRotaDialog } from '@/components/importacao/ImportarDisponibilidadeRotaDialog'
import { ImportarDisponibilidadeArmazemDialog } from '@/components/importacao/ImportarDisponibilidadeArmazemDialog'
import { ImportarDisponibilidadeEmpurradaDialog } from '@/components/importacao/ImportarDisponibilidadeEmpurradaDialog'
import { PosicaoLog20Dialog } from '@/components/importacao/PosicaoLog20Dialog'
import { ImportacaoGentePanel } from '@/components/importacao/ImportacaoGentePanel'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'
import type { AlteracaoRetroativa, Unidade } from '@/types'

type Stage = 'idle' | 'resolvendo' | 'analisando' | 'preview' | 'importando' | 'done'

const BATCH_SIZE = 200

interface ArquivoProcessado {
  file: File
  unidadeCodigo: string
  negocio: string
  ano: number
  parsed: ParseDreResult
  alteracoes: Omit<AlteracaoRetroativa, 'id' | 'importacao_id'>[]
}

function unicos<T>(valores: T[]): T[] {
  return Array.from(new Set(valores))
}

export function ImportacaoDrePage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { revalidarAposImport } = useData()
  const { unidades, loading: loadingUnidades } = useUnidades()
  const { contas, loading: loadingContas } = useContas()
  const nomesContas = useMemo(() => new Map(contas.map(c => [c.codigo, c.descricao])), [contas])

  const [stage, setStage] = useState<Stage>('idle')
  const [unidadesState, setUnidadesState] = useState<Unidade[]>([])
  const [arquivos, setArquivos] = useState<File[]>([])
  const [arquivosIgnorados, setArquivosIgnorados] = useState<string[]>([])
  const [arquivosProcessados, setArquivosProcessados] = useState<ArquivoProcessado[]>([])
  const [progresso, setProgresso] = useState(0)
  const [progressoLabel, setProgressoLabel] = useState('')
  const [resumo, setResumo] = useState<{ arquivos: number; contas: number; alteracoes: number } | null>(null)

  useEffect(() => { setUnidadesState(unidades) }, [unidades])

  const reconhecidos = useMemo(
    () => arquivos
      .map(file => ({ file, info: parseDreFilename(file.name) }))
      .filter((r): r is { file: File; info: DreFilenameInfo } => r.info !== null),
    [arquivos],
  )

  function unidadeParaSlug(slug: string): Unidade | undefined {
    return unidadesState.find(u => u.codigo === slug || u.nome_ginfo === slug)
  }

  const slugsNaoMapeados = useMemo(
    () => unicos(reconhecidos.map(r => r.info.unidadeSlug)).filter(slug => !unidadeParaSlug(slug)),
    [reconhecidos, unidadesState],
  )

  function handleArquivos(files: File[]) {
    setArquivos(files)
    const reconhecidosAgora = files
      .map(f => ({ file: f, info: parseDreFilename(f.name) }))
      .filter((r): r is { file: File; info: DreFilenameInfo } => r.info !== null)
    setArquivosIgnorados(files.filter(f => !reconhecidosAgora.some(r => r.file === f)).map(f => f.name))

    if (reconhecidosAgora.length === 0) {
      toast({ title: 'Nenhum arquivo reconhecido', description: 'Os nomes precisam seguir o padrão DRE_<UNIDADE>_<TIPO>_MM_YYYY.xlsx.', variant: 'destructive' })
      return
    }
    setStage('resolvendo')
  }

  function handleUnidadeResolvida(unidade: Unidade, codigoAntigo?: string) {
    setUnidadesState(prev => {
      const semAntiga = codigoAntigo ? prev.filter(u => u.codigo !== codigoAntigo) : prev
      const semNova = semAntiga.filter(u => u.codigo !== unidade.codigo)
      return [...semNova, unidade]
    })
  }

  useEffect(() => {
    if (stage === 'resolvendo' && slugsNaoMapeados.length === 0 && reconhecidos.length > 0) {
      handleAnalisar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, slugsNaoMapeados.length])

  async function handleAnalisar() {
    setStage('analisando')
    setProgresso(0)

    const comUnidade = reconhecidos
      .map(r => ({ ...r, unidade: unidadeParaSlug(r.info.unidadeSlug) }))
      .filter((r): r is typeof r & { unidade: Unidade } => r.unidade !== undefined)
      .sort((a, b) => a.info.ano - b.info.ano || a.info.mes - b.info.mes)

    const combos = unicos(comUnidade.map(r => `${r.unidade.codigo}|${r.info.negocio}|${r.info.ano}`))
    const estadoPorCombo = new Map<string, Map<string, Record<string, number>>>()

    await Promise.all(combos.map(async chave => {
      const [unidadeCodigo, negocio, anoStr] = chave.split('|')
      const { data } = await supabase
        .from('dre_lancamentos')
        .select('*')
        .eq('unidade', unidadeCodigo)
        .eq('negocio', negocio)
        .eq('ano', Number(anoStr))
      const mapa = new Map<string, Record<string, number>>()
      for (const row of data ?? []) mapa.set((row as { conta_codigo: string }).conta_codigo, row as Record<string, number>)
      estadoPorCombo.set(chave, mapa)
    }))

    const processados: ArquivoProcessado[] = []
    for (let i = 0; i < comUnidade.length; i++) {
      const { file, info, unidade } = comUnidade[i]
      setProgressoLabel(`Analisando arquivo ${i + 1} de ${comUnidade.length}...`)
      try {
        const parsed = await parseDreXlsx(file)
        const chave = `${unidade.codigo}|${info.negocio}|${info.ano}`
        const mapaAtual = estadoPorCombo.get(chave)!

        const alteracoesArquivo = detectarAlteracoes(parsed.linhas, mapaAtual, mesesParaComparar(parsed.blocosDetectados))
          .map(a => ({
            unidade: unidade.codigo, negocio: info.negocio, ano: info.ano,
            conta_codigo: a.conta_codigo, campo: a.campo, valor_antigo: a.valorAntigo, valor_novo: a.valorNovo,
          }))

        for (const linha of parsed.linhas) {
          const atual = mapaAtual.get(linha.conta_codigo) ?? {}
          mapaAtual.set(linha.conta_codigo, { ...atual, ...linha.campos })
        }

        processados.push({ file, unidadeCodigo: unidade.codigo, negocio: info.negocio, ano: info.ano, parsed, alteracoes: alteracoesArquivo })
      } catch (err) {
        toast({ title: `Erro ao ler ${file.name}`, description: String(err), variant: 'destructive' })
      }
      setProgresso(Math.round(((i + 1) / comUnidade.length) * 100))
    }

    setArquivosProcessados(processados)
    setStage('preview')
  }

  async function handleImportar() {
    if (!user) return
    setStage('importando')
    setProgresso(0)

    let totalContas = 0
    let totalAlteracoes = 0

    try {
      for (let i = 0; i < arquivosProcessados.length; i++) {
        const ap = arquivosProcessados[i]
        setProgressoLabel(`Importando ${ap.file.name} (${i + 1} de ${arquivosProcessados.length})...`)

        const { data: imp, error: impErr } = await supabase
          .from('importacoes')
          .insert({
            usuario_id: user.id,
            arquivo_nome: ap.file.name,
            unidade: ap.unidadeCodigo,
            negocio: ap.negocio,
            ano: ap.ano,
            total_linhas: ap.parsed.linhas.length,
            meses_no_arquivo: ap.parsed.blocosDetectados.filter(b => b !== 'total').length,
          })
          .select('id')
          .single()
        if (impErr) throw new Error(impErr.message)

        const linhas = ap.parsed.linhas.map(l => ({
          unidade: ap.unidadeCodigo,
          negocio: ap.negocio,
          ano: ap.ano,
          conta_codigo: l.conta_codigo,
          ...l.campos,
          importacao_id: imp.id,
        }))

        for (let b = 0; b < linhas.length; b += BATCH_SIZE) {
          const batch = linhas.slice(b, b + BATCH_SIZE)
          const { error } = await supabase.from('dre_lancamentos').upsert(batch, { onConflict: 'unidade,negocio,ano,conta_codigo' })
          // `.details` carrega a informação útil de verdade num erro de FK
          // (ex: "Key (conta_codigo)=(283) is not present in table
          // \"contas\"." — conta nova no arquivo, ainda não cadastrada) —
          // `.message` sozinho só diz qual constraint quebrou, sem dizer qual
          // valor causou.
          if (error) throw new Error(error.details ? `${error.message} — ${error.details}` : error.message)
        }

        if (ap.alteracoes.length > 0) {
          const { error } = await supabase
            .from('importacoes_alteracoes')
            .insert(ap.alteracoes.map(a => ({ ...a, importacao_id: imp.id })))
          if (error) throw new Error(error.message)
        }

        totalContas += linhas.length
        totalAlteracoes += ap.alteracoes.length
        setProgresso(Math.round(((i + 1) / arquivosProcessados.length) * 100))
      }

      // Atualiza a view materializada no Supabase e recarrega o cache local
      setProgressoLabel('Atualizando cache dos dados...')
      await revalidarAposImport()

      setResumo({ arquivos: arquivosProcessados.length, contas: totalContas, alteracoes: totalAlteracoes })
      setStage('done')
    } catch (err) {
      toast({ title: 'Erro na importação', description: String(err), variant: 'destructive' })
      setStage('preview')
    }
  }

  function handleReset() {
    setStage('idle')
    setArquivos([])
    setArquivosIgnorados([])
    setArquivosProcessados([])
    setResumo(null)
    setProgresso(0)
  }

  const todasAlteracoes = useMemo(() => arquivosProcessados.flatMap(a => a.alteracoes), [arquivosProcessados])
  const totalContasPreview = useMemo(() => arquivosProcessados.reduce((acc, a) => acc + a.parsed.linhas.length, 0), [arquivosProcessados])
  const unidadesEnvolvidas = useMemo(() => unicos(arquivosProcessados.map(a => a.unidadeCodigo)), [arquivosProcessados])

  // Conta nova no arquivo (código que ainda não existe em `contas`) — sem
  // isso, o "insert or update... violates foreign key constraint" que o
  // Postgres devolve não diz QUAL código é (o detalhe com o valor só aparece
  // se o role tiver SELECT na tabela referenciada — não é o caso aqui), então
  // detectamos aqui antes de tentar importar, com a descrição que veio no
  // próprio Excel pra já saber o nome certo pra cadastrar.
  const contasNovas = useMemo(() => {
    if (loadingContas) return []
    const codigosConhecidos = new Set(contas.map(c => c.codigo))
    const vistos = new Map<string, string>()
    for (const ap of arquivosProcessados) {
      for (const linha of ap.parsed.linhas) {
        if (!codigosConhecidos.has(linha.conta_codigo)) vistos.set(linha.conta_codigo, linha.descricao)
      }
    }
    return Array.from(vistos.entries())
      .map(([codigo, descricao]) => ({ codigo, descricao }))
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
  }, [arquivosProcessados, contas, loadingContas])

  if (stage === 'done' && resumo) {
    return (
      <div className="max-w-md space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <CardTitle>Importação concluída</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-green-50 p-3">
                <div className="text-2xl font-bold text-green-700">{resumo.arquivos}</div>
                <div className="text-xs text-green-600">arquivos</div>
              </div>
              <div className="rounded-lg bg-green-50 p-3">
                <div className="text-2xl font-bold text-green-700">{resumo.contas}</div>
                <div className="text-xs text-green-600">contas</div>
              </div>
              <div className="rounded-lg bg-amber-50 p-3">
                <div className="text-2xl font-bold text-amber-700">{resumo.alteracoes}</div>
                <div className="text-xs text-amber-600">alterações retroativas</div>
              </div>
            </div>
            <Button onClick={handleReset} variant="outline" className="w-full">Nova importação</Button>
          </CardContent>
        </Card>
        <Toaster />
      </div>
    )
  }

  if (stage === 'importando' || stage === 'analisando') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{progressoLabel} {progresso}%</p>
        <div className="w-64 rounded-full bg-muted h-2">
          <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
        </div>
        <Toaster />
      </div>
    )
  }

  if (stage === 'preview') {
    return (
      <div className="max-w-3xl space-y-4">
        <Card>
          <CardContent className="grid grid-cols-3 gap-4 pt-6 text-center">
            <div>
              <div className="text-2xl font-bold">{arquivosProcessados.length}</div>
              <div className="text-sm text-muted-foreground">arquivos analisados</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{unidadesEnvolvidas.length}</div>
              <div className="text-sm text-muted-foreground">unidades</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{totalContasPreview}</div>
              <div className="text-sm text-muted-foreground">linhas de conta</div>
            </div>
          </CardContent>
        </Card>

        {contasNovas.length > 0 && (
          <Card className="border-l-4 border-l-destructive">
            <CardContent className="space-y-2 p-4">
              <p className="text-sm font-semibold text-destructive">
                {contasNovas.length} conta{contasNovas.length === 1 ? '' : 's'} nova{contasNovas.length === 1 ? '' : 's'} no arquivo — a importação vai falhar até cadastrar {contasNovas.length === 1 ? 'ela' : 'elas'}
              </p>
              <p className="text-xs text-muted-foreground">
                {contasNovas.length === 1 ? 'Este código' : 'Estes códigos'} ainda não existe{contasNovas.length === 1 ? '' : 'm'} na tabela <code className="rounded bg-black/10 px-1 py-0.5 dark:bg-white/10">contas</code> — cadastre com o código e a descrição abaixo (já vieram do próprio Excel) e reabra o arquivo.
              </p>
              <ul className="text-xs">
                {contasNovas.map(c => (
                  <li key={c.codigo}>
                    <span className="font-mono text-muted-foreground">{c.codigo}</span> — {c.descricao}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <RelatorioAlteracoes alteracoes={todasAlteracoes} nomesContas={nomesContas} />

        {arquivosIgnorados.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-foreground">{arquivosIgnorados.length} arquivo(s) ignorado(s) (nome fora do padrão)</p>
              <ul className="mt-1 text-xs text-muted-foreground">
                {arquivosIgnorados.map(nome => <li key={nome}>{nome}</li>)}
              </ul>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button onClick={handleImportar} disabled={arquivosProcessados.length === 0 || contasNovas.length > 0}>Confirmar importação</Button>
          <Button variant="outline" onClick={handleReset}>Cancelar</Button>
        </div>
        <Toaster />
      </div>
    )
  }

  if (stage === 'resolvendo' && slugsNaoMapeados.length > 0) {
    return (
      <div className="max-w-3xl space-y-4">
        <ResolverUnidadesPanel slugs={slugsNaoMapeados} unidades={unidadesState} onResolvido={handleUnidadeResolvida} />
        <Toaster />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="financeiro">
        <TabsList className="bg-gray-200/70 dark:bg-gray-700/70 p-1 rounded-xl inline-flex w-full md:w-auto">
          <TabsTrigger
            value="financeiro"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-200 flex-1 md:flex-none"
          >
            Financeiro
          </TabsTrigger>
          <TabsTrigger
            value="gente"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-200 flex-1 md:flex-none"
          >
            Cadastro de Lideranças
          </TabsTrigger>
        </TabsList>

        {/* ── Financeiro: DRE + dados auxiliares ── */}
        <TabsContent value="financeiro" className="pt-6">
          <div className="max-w-xl space-y-8">
            <div className="space-y-4">
              <h2 className="text-base font-semibold">DRE</h2>
              <p className="text-sm text-muted-foreground">
                Selecione a pasta com os relatórios DRE baixados do GInfo (ex: <span className="font-mono">DRE_novo</span>). Unidade, negócio, mês e ano são lidos direto do nome de cada arquivo.
              </p>
              <PastaDropzone arquivos={arquivos} onArquivos={handleArquivos} />
              {!loadingUnidades && unidadesState.length === 0 && (
                <p className="text-xs text-amber-600">Nenhuma unidade cadastrada ainda — a primeira importação vai pedir pra cadastrar cada uma.</p>
              )}
            </div>

            <div className="space-y-3 border-t pt-6">
              <h2 className="text-base font-semibold">Dados auxiliares</h2>
              <p className="text-sm text-muted-foreground">Importações independentes do DRE.</p>
              <div className="flex flex-wrap gap-3">
                <ImportarPainelPerdasAuxDialog unidades={unidadesState} onImportado={() => {}} />
                <ImportarDisponibilidadeRotaDialog unidades={unidadesState} onImportado={() => {}} />
                <ImportarDisponibilidadeArmazemDialog unidades={unidadesState} onImportado={() => {}} />
                <ImportarDisponibilidadeEmpurradaDialog unidades={unidadesState} onImportado={() => {}} />
                <PosicaoLog20Dialog />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Cadastro de Lideranças: RV das lideranças (resultados mensais dos indicadores de gente saíram daqui, ver RV de Gente > Importação) ── */}
        <TabsContent value="gente" className="pt-6">
          <ImportacaoGentePanel />
        </TabsContent>

        {/* Segurança, Distribuição, Frota e Armazém saíram daqui — cada uma
            agora tem sua própria aba "Importação" dentro da subpágina de
            Remuneração Variável do setor (RvSegurancaPage/RvDistribuicaoPage/
            RvFrotaPage/RvArmazemPage). */}
      </Tabs>

      <Toaster />
    </div>
  )
}
