import { useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { parseExcessoVelocidadeFile, type ExcessoVelocidadeUnidadeAgregado } from '@/lib/excesso-velocidade-parser'
import { negocioPorPrefixo, resolverUnidade } from '@/lib/unidade-resolver'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { ResultadoExcessoVelocidade, Unidade } from '@/types'

const BATCH_SIZE = 500
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const ANOS_IMPORT = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

/**
 * Importa o resultado mensal do indicador Excesso de Velocidade — planilha
 * de eventos (Placa, UO, Tipo etc). O parser já conta quantos eventos têm
 * TIPO contendo "EXCESSO_VELOCIDADE" por UO; aqui resolvemos a UO pra
 * unidade e aplicamos a exclusão: não vale pra ESTÂNCIA nem pra Camaçari ARM
 * (empurrada) — só a ROTA de Camaçari conta.
 */
export function ImportarResultadosExcessoVelocidade() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [file, setFile] = useState<File | null>(null)
  const [anoImport, setAnoImport] = useState(String(new Date().getFullYear()))
  const [mesImport, setMesImport] = useState(String(new Date().getMonth() + 1))
  const [agregados, setAgregados] = useState<ExcessoVelocidadeUnidadeAgregado[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseExcessoVelocidadeFile(f)
      setAgregados(resultado.agregados)
      setErrosParse(resultado.erros)
    } catch (err) {
      setAgregados([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  const camacariCodigo = useMemo(() => resolverUnidade('CDR BAHIA', unidades)?.codigo, [unidades])

  const resolucao = useMemo(() => {
    const resolvidos: { agregado: ExcessoVelocidadeUnidadeAgregado; unidade: Unidade }[] = []
    const excluidos: { agregado: ExcessoVelocidadeUnidadeAgregado; unidade: Unidade; motivo: string }[] = []
    const naoReconhecidas = new Set<string>()
    for (const agregado of agregados) {
      const unidade = resolverUnidade(agregado.uo, unidades)
      if (!unidade) {
        naoReconhecidas.add(agregado.uo)
        continue
      }
      const negocio = negocioPorPrefixo(agregado.uo)
      const ehEstancia = resolverUnidade('ESTÂNCIA', unidades)?.codigo === unidade.codigo
      const ehCamacariArm = camacariCodigo !== undefined && unidade.codigo === camacariCodigo && negocio === 'ARM'
      if (ehEstancia) excluidos.push({ agregado, unidade, motivo: 'ESTÂNCIA não entra nesse indicador' })
      else if (ehCamacariArm) excluidos.push({ agregado, unidade, motivo: 'Camaçari ARM (empurrada) não entra nesse indicador' })
      else resolvidos.push({ agregado, unidade })
    }
    return { resolvidos, excluidos, naoReconhecidas: Array.from(naoReconhecidas).sort() }
  }, [agregados, unidades, camacariCodigo])

  async function handleImportar() {
    const ano = Number(anoImport)
    const mes = Number(mesImport)
    const porUnidade = new Map<string, Omit<ResultadoExcessoVelocidade, 'id'>>()
    for (const { agregado, unidade } of resolucao.resolvidos) {
      const atual = porUnidade.get(unidade.codigo)
      porUnidade.set(unidade.codigo, { unidade: unidade.codigo, ano, mes, valor: (atual?.valor ?? 0) + agregado.totalExcessos })
    }
    const registros = Array.from(porUnidade.values())
    if (registros.length === 0) return

    setImportando(true)
    try {
      for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('resultados_excesso_velocidade')
          .upsert(batch, { onConflict: 'unidade,ano,mes' })
        if (error) throw new Error(error.message)
      }
      toast({ title: `${registros.length} resultado(s) de Excesso de Velocidade importado(s) pra ${MESES_NOMES[mes - 1]}/${ano}` })
      setFile(null)
      setAgregados([])
      setErrosParse([])
    } catch (err) {
      toast({ title: 'Erro ao importar resultados de Excesso de Velocidade', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="max-w-xl space-y-3">
      <h2 className="text-base font-semibold">Excesso de Velocidade — resultado mensal</h2>
      <p className="text-sm text-muted-foreground">
        Suba a planilha de eventos (Excel ou CSV), com as colunas{' '}
        <span className="font-mono text-xs">UO · TIPO</span>. Conta quantas linhas têm TIPO contendo
        "EXCESSO_VELOCIDADE" — soma por unidade. Não vale pra ESTÂNCIA nem pra Camaçari ARM.
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
        <FilePickerButton label="Planilha de Excessos (.xlsx ou .csv)" accept=".xlsx,.xls,.csv,.txt" file={file} onFile={handleFile} />
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
            {resolucao.naoReconhecidas.length} UO(s) não reconhecida(s) — cadastre como apelido na Administração e suba de novo:
          </p>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono">
            {resolucao.naoReconhecidas.map(o => <li key={o}>{o}</li>)}
          </ul>
        </div>
      )}

      {resolucao.excluidos.length > 0 && (
        <div className="rounded-lg border border-gray-300/50 bg-gray-50 p-3 text-xs text-muted-foreground dark:border-gray-600/30 dark:bg-gray-800/30">
          <p className="mb-1 font-semibold">{resolucao.excluidos.length} linha(s) ignorada(s) (fora do indicador):</p>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto">
            {resolucao.excluidos.map(({ agregado, motivo }, i) => <li key={i}>{agregado.uo} — {motivo}</li>)}
          </ul>
        </div>
      )}

      {resolucao.resolvidos.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-center">Excessos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resolucao.resolvidos.map(({ agregado, unidade }) => (
              <TableRow key={unidade.codigo} className="border-gray-200/30 dark:border-gray-700/30">
                <TableCell className="text-sm font-medium">{unidade.nome}</TableCell>
                <TableCell className="text-center text-sm font-semibold tabular-nums">{agregado.totalExcessos}</TableCell>
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
