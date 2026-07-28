import { useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { parseDtoT1File, type DtoT1UnidadeAgregado } from '@/lib/dto-t1-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { ResultadoDtoT1, Unidade } from '@/types'

const BATCH_SIZE = 500
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const ANOS_IMPORT = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Importa o resultado mensal do indicador DTO T1 — planilha de inspeções por
 * colaborador (Matrícula, Colaborador, Operação, Dias Para Realizar Inspeção
 * etc). Só ESTÂNCIA e CDR BAHIA se enquadram; o parser já ignora qualquer
 * outra unidade que apareça no relatório. O % é calculado aqui (não vem
 * pronto da planilha): (total de colaboradores − colaboradores com prazo
 * negativo) / total.
 */
export function ImportarResultadosDtoT1() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [file, setFile] = useState<File | null>(null)
  const [anoImport, setAnoImport] = useState(String(new Date().getFullYear()))
  const [mesImport, setMesImport] = useState(String(new Date().getMonth() + 1))
  const [agregados, setAgregados] = useState<DtoT1UnidadeAgregado[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseDtoT1File(f)
      setAgregados(resultado.agregados)
      setErrosParse(resultado.erros)
    } catch (err) {
      setAgregados([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  const resolucao = useMemo(() => {
    const resolvidos: { agregado: DtoT1UnidadeAgregado; unidade: Unidade }[] = []
    const naoReconhecidas = new Set<string>()
    for (const agregado of agregados) {
      const unidade = resolverUnidade(agregado.operacao, unidades)
      if (unidade) resolvidos.push({ agregado, unidade })
      else naoReconhecidas.add(agregado.operacao)
    }
    return { resolvidos, naoReconhecidas: Array.from(naoReconhecidas).sort() }
  }, [agregados, unidades])

  async function handleImportar() {
    const ano = Number(anoImport)
    const mes = Number(mesImport)
    const registros: Omit<ResultadoDtoT1, 'id'>[] = resolucao.resolvidos.map(({ agregado, unidade }) => ({
      unidade: unidade.codigo, ano, mes, valor: agregado.pctDentroPrazo,
    }))
    if (registros.length === 0) return

    setImportando(true)
    try {
      for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('resultados_dto_t1')
          .upsert(batch, { onConflict: 'unidade,ano,mes' })
        if (error) throw new Error(error.message)
      }
      toast({ title: `${registros.length} resultado(s) de DTO T1 importado(s) pra ${MESES_NOMES[mes - 1]}/${ano}` })
      setFile(null)
      setAgregados([])
      setErrosParse([])
    } catch (err) {
      toast({ title: 'Erro ao importar resultados de DTO T1', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="max-w-xl space-y-3">
      <h2 className="text-base font-semibold">DTO T1 — resultado mensal</h2>
      <p className="text-sm text-muted-foreground">
        Suba a planilha de inspeções por colaborador (Excel ou CSV), com as colunas{' '}
        <span className="font-mono text-xs">Operação</span> e{' '}
        <span className="font-mono text-xs">Dias Para Realizar Inspeção</span>. Só ESTÂNCIA e CDR BAHIA se enquadram —
        qualquer outra unidade no relatório é ignorada. O % é calculado aqui: colaboradores dentro do prazo / total.
      </p>

      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Select value={anoImport} onValueChange={setAnoImport}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS_IMPORT.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mês</Label>
          <Select value={mesImport} onValueChange={setMesImport}>
            <SelectTrigger className={cn('w-40', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <FilePickerButton label="Planilha do DTO T1 (.xlsx ou .csv)" accept=".xlsx,.xls,.csv,.txt" file={file} onFile={handleFile} />
      </div>

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

      {resolucao.resolvidos.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-center">Colaboradores</TableHead>
              <TableHead className="text-center">Atrasados</TableHead>
              <TableHead className="text-center">% Dentro do Prazo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resolucao.resolvidos.map(({ agregado, unidade }) => (
              <TableRow key={unidade.codigo} className="border-gray-200/30 dark:border-gray-700/30">
                <TableCell className="text-sm font-medium">{unidade.nome}</TableCell>
                <TableCell className="text-center text-sm tabular-nums">{agregado.totalColaboradores}</TableCell>
                <TableCell className="text-center text-sm tabular-nums text-red-600 dark:text-red-400">{agregado.atrasados}</TableCell>
                <TableCell className="text-center text-sm font-semibold tabular-nums">{fmtPct(agregado.pctDentroPrazo)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {file && (
        <div className="flex items-center gap-3">
          <Button onClick={handleImportar} disabled={resolucao.resolvidos.length === 0 || importando} className="gap-2">
            {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar {resolucao.resolvidos.length} resultado(s)
          </Button>
          <Button variant="outline" onClick={() => { setFile(null); setAgregados([]); setErrosParse([]) }} disabled={importando}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}
