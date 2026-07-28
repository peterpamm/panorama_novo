import { useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { parseGsdFile, type GsdUnidadeAgregado } from '@/lib/gsd-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { ResultadoGsd, Unidade } from '@/types'

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
 * Importa o resultado mensal do indicador GSD — planilha por colaborador
 * (Filial, Colaborador, Função, Admissão, Data Último, Data Limite, Status,
 * Dias Falta). O % é calculado aqui (não vem pronto da planilha): (total de
 * colaboradores − colaboradores com Status "FORA DO PRAZO") / total. Ao
 * contrário do DTO T1, todas as unidades da planilha entram.
 */
export function ImportarResultadosGsd() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [file, setFile] = useState<File | null>(null)
  const [anoImport, setAnoImport] = useState(String(new Date().getFullYear()))
  const [mesImport, setMesImport] = useState(String(new Date().getMonth() + 1))
  const [agregados, setAgregados] = useState<GsdUnidadeAgregado[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseGsdFile(f)
      setAgregados(resultado.agregados)
      setErrosParse(resultado.erros)
    } catch (err) {
      setAgregados([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  const resolucao = useMemo(() => {
    const resolvidos: { agregado: GsdUnidadeAgregado; unidade: Unidade }[] = []
    const naoReconhecidas = new Set<string>()
    for (const agregado of agregados) {
      const unidade = resolverUnidade(agregado.filial, unidades)
      if (unidade) resolvidos.push({ agregado, unidade })
      else naoReconhecidas.add(agregado.filial)
    }
    return { resolvidos, naoReconhecidas: Array.from(naoReconhecidas).sort() }
  }, [agregados, unidades])

  async function handleImportar() {
    const ano = Number(anoImport)
    const mes = Number(mesImport)
    const porUnidadeNegocio = new Map<string, Omit<ResultadoGsd, 'id'>>()
    for (const { agregado, unidade } of resolucao.resolvidos) {
      porUnidadeNegocio.set(`${unidade.codigo}|${agregado.negocio}`, { unidade: unidade.codigo, negocio: agregado.negocio, ano, mes, valor: agregado.pctDentroPrazo })
    }
    const registros = Array.from(porUnidadeNegocio.values())
    if (registros.length === 0) return

    setImportando(true)
    try {
      for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('resultados_gsd')
          .upsert(batch, { onConflict: 'unidade,negocio,ano,mes' })
        if (error) throw new Error(error.message)
      }
      toast({ title: `${registros.length} resultado(s) de GSD importado(s) pra ${MESES_NOMES[mes - 1]}/${ano}` })
      setFile(null)
      setAgregados([])
      setErrosParse([])
    } catch (err) {
      toast({ title: 'Erro ao importar resultados de GSD', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="max-w-xl space-y-3">
      <h2 className="text-base font-semibold">GSD — resultado mensal</h2>
      <p className="text-sm text-muted-foreground">
        Suba a planilha por colaborador (Excel ou CSV), com as colunas{' '}
        <span className="font-mono text-xs">Filial</span> e{' '}
        <span className="font-mono text-xs">Status</span>. O % é calculado aqui: colaboradores com status diferente de
        "FORA DO PRAZO" / total.
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
        <FilePickerButton label="Planilha do GSD (.xlsx ou .csv)" accept=".xlsx,.xls,.csv,.txt" file={file} onFile={handleFile} />
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
            {resolucao.naoReconhecidas.length} filial(is) não reconhecida(s) — cadastre como apelido na Administração e suba de novo:
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
              <TableHead>Negócio</TableHead>
              <TableHead className="text-center">Colaboradores</TableHead>
              <TableHead className="text-center">Fora do Prazo</TableHead>
              <TableHead className="text-center">% Dentro do Prazo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resolucao.resolvidos.map(({ agregado, unidade }) => (
              <TableRow key={`${unidade.codigo}|${agregado.negocio}`} className="border-gray-200/30 dark:border-gray-700/30">
                <TableCell className="text-sm font-medium">{unidade.nome}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{agregado.negocio}</TableCell>
                <TableCell className="text-center text-sm tabular-nums">{agregado.totalColaboradores}</TableCell>
                <TableCell className="text-center text-sm tabular-nums text-red-600 dark:text-red-400">{agregado.foraDoPrazo}</TableCell>
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
