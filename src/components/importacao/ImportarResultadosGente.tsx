import { useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { parseMetasGenteFile, type ParsedMetaGenteRow } from '@/lib/metas-gente-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { FileDropzone } from '@/components/importacao/FileDropzone'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { ResultadoGente, Unidade } from '@/types'

const BATCH_SIZE = 500

const ANOS_IMPORT = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

/**
 * Importa os resultados mensais (realizado) dos indicadores de gente — mesmo
 * formato do arquivo de metas (INDICADOR | OPERAÇÃO | JAN..DEZ). Usado todo
 * mês pelo corporativo de Gente; upsert por indicador+operação+ano+mês, então
 * só os meses com valor no arquivo são gravados/atualizados.
 */
export function ImportarResultadosGente() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [file, setFile] = useState<File | null>(null)
  const [anoImport, setAnoImport] = useState(String(new Date().getFullYear()))
  const [linhas, setLinhas] = useState<ParsedMetaGenteRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseMetasGenteFile(f)
      setLinhas(resultado.linhas)
      setErrosParse(resultado.erros)
    } catch (err) {
      setLinhas([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  const resolucao = useMemo(() => {
    const resolvidas: { linha: ParsedMetaGenteRow; unidade: Unidade }[] = []
    const naoReconhecidas = new Set<string>()
    for (const linha of linhas) {
      const unidade = resolverUnidade(linha.operacao, unidades)
      if (unidade) resolvidas.push({ linha, unidade })
      else naoReconhecidas.add(linha.operacao)
    }
    return { resolvidas, naoReconhecidas: Array.from(naoReconhecidas).sort() }
  }, [linhas, unidades])

  const totalValores = useMemo(
    () => resolucao.resolvidas.reduce((acc, r) => acc + r.linha.valores.filter(v => v !== null).length, 0),
    [resolucao],
  )

  async function handleImportar() {
    const ano = Number(anoImport)
    const porChave = new Map<string, Omit<ResultadoGente, 'id'>>()
    for (const { linha, unidade } of resolucao.resolvidas) {
      linha.valores.forEach((valor, i) => {
        if (valor !== null) {
          const registro = {
            indicador: linha.indicador,
            unidade: unidade.codigo,
            operacao_bi: linha.operacao,
            ano,
            mes: i + 1,
            valor,
          }
          porChave.set(`${registro.indicador}|${registro.operacao_bi}|${registro.mes}`, registro)
        }
      })
    }
    const registros = Array.from(porChave.values())
    if (registros.length === 0) return

    setImportando(true)
    try {
      for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('resultados_gente')
          .upsert(batch, { onConflict: 'indicador,operacao_bi,ano,mes' })
        if (error) throw new Error(error.message)
      }
      toast({ title: `${registros.length} resultado(s) importado(s) pra ${ano}` })
      setFile(null)
      setLinhas([])
      setErrosParse([])
    } catch (err) {
      toast({ title: 'Erro ao importar resultados', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="max-w-xl space-y-3">
      <h2 className="text-base font-semibold">Resultados dos indicadores (mês a mês)</h2>
      <p className="text-sm text-muted-foreground">
        Realizado mensal dos indicadores de gente, no mesmo formato do arquivo de metas{' '}
        (<span className="font-mono text-xs">INDICADOR · OPERAÇÃO · JAN … DEZ</span>).
        Só os meses com valor são gravados — dá pra subir o arquivo atualizado todo mês sem afetar os anteriores.
      </p>

      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label>Ano dos resultados</Label>
          <Select value={anoImport} onValueChange={setAnoImport}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS_IMPORT.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <FileDropzone label="Arquivo de resultados (.xlsx ou .csv)" accept=".xlsx,.xls,.csv,.txt" file={file} onFile={handleFile} />

      {errosParse.length > 0 && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <p className="mb-1 font-semibold">{errosParse.length} problema(s) no arquivo:</p>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto">
            {errosParse.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {resolucao.naoReconhecidas.length > 0 && (
        <div className="rounded-lg border border-red-300/50 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <p className="mb-1 font-semibold">
            {resolucao.naoReconhecidas.length} operação(ões) não reconhecida(s) — cadastre como apelido na Administração e suba de novo:
          </p>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono">
            {resolucao.naoReconhecidas.map(o => <li key={o}>{o}</li>)}
          </ul>
        </div>
      )}

      {file && (
        <div className="flex items-center gap-3">
          <Button onClick={handleImportar} disabled={totalValores === 0 || importando} className="gap-2">
            {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar {totalValores} resultado(s) pra {anoImport}
          </Button>
          <Button variant="outline" onClick={() => { setFile(null); setLinhas([]); setErrosParse([]) }} disabled={importando}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}
