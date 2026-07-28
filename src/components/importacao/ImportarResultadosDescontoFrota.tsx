import { useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { parseDescontoFrotaFile, type ParsedDescontoFrotaRow } from '@/lib/desconto-frota-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { ResultadoDescontoCivf, ResultadoDescontoStressTest, Unidade } from '@/types'

const BATCH_SIZE = 500
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const ANOS_IMPORT = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

/**
 * Importa o resultado mensal (R$) do Desconto CIVF e do Desconto Stress Test
 * — planilha com aba "Resultado", unidade pela coluna CDD GINFO, CIVF pela
 * coluna CIVF e Stress Test pela coluna TT STRESS TEST. Cada arquivo é o
 * resultado de um único mês/ano pra todas as unidades. Se a mesma unidade
 * aparecer em mais de uma linha (ex: duas operações da mesma CDD), os
 * valores são somados em vez de uma linha sobrescrever a outra.
 */
export function ImportarResultadosDescontoFrota() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [file, setFile] = useState<File | null>(null)
  const [anoImport, setAnoImport] = useState(String(new Date().getFullYear()))
  const [mesImport, setMesImport] = useState(String(new Date().getMonth() + 1))
  const [linhas, setLinhas] = useState<ParsedDescontoFrotaRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseDescontoFrotaFile(f)
      setLinhas(resultado.linhas)
      setErrosParse(resultado.erros)
    } catch (err) {
      setLinhas([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  const resolucao = useMemo(() => {
    const resolvidas: { linha: ParsedDescontoFrotaRow; unidade: Unidade }[] = []
    const naoReconhecidas = new Set<string>()
    for (const linha of linhas) {
      const unidade = resolverUnidade(linha.unidade, unidades)
      if (unidade) resolvidas.push({ linha, unidade })
      else naoReconhecidas.add(linha.unidade)
    }
    return { resolvidas, naoReconhecidas: Array.from(naoReconhecidas).sort() }
  }, [linhas, unidades])

  // Unidade repetida na planilha (ex: duas linhas de Camaçari) soma os valores em vez de uma sobrescrever a outra.
  const agregados = useMemo(() => {
    interface Acumulado { civf: number; temCivf: boolean; stressTest: number; temStressTest: boolean }
    const porUnidade = new Map<string, Acumulado>()
    for (const { linha, unidade } of resolucao.resolvidas) {
      const atual = porUnidade.get(unidade.codigo) ?? { civf: 0, temCivf: false, stressTest: 0, temStressTest: false }
      if (linha.civf !== null) { atual.civf += linha.civf; atual.temCivf = true }
      if (linha.stressTest !== null) { atual.stressTest += linha.stressTest; atual.temStressTest = true }
      porUnidade.set(unidade.codigo, atual)
    }
    return porUnidade
  }, [resolucao])

  async function handleImportar() {
    const ano = Number(anoImport)
    const mes = Number(mesImport)
    const registrosCivf: Omit<ResultadoDescontoCivf, 'id'>[] = []
    const registrosStressTest: Omit<ResultadoDescontoStressTest, 'id'>[] = []
    for (const [codigo, acc] of agregados) {
      if (acc.temCivf) registrosCivf.push({ unidade: codigo, ano, mes, valor: acc.civf })
      if (acc.temStressTest) registrosStressTest.push({ unidade: codigo, ano, mes, valor: acc.stressTest })
    }
    if (registrosCivf.length === 0 && registrosStressTest.length === 0) return

    setImportando(true)
    try {
      for (let i = 0; i < registrosCivf.length; i += BATCH_SIZE) {
        const batch = registrosCivf.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from('resultados_desconto_civf').upsert(batch, { onConflict: 'unidade,ano,mes' })
        if (error) throw new Error(error.message)
      }
      for (let i = 0; i < registrosStressTest.length; i += BATCH_SIZE) {
        const batch = registrosStressTest.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from('resultados_desconto_stress_test').upsert(batch, { onConflict: 'unidade,ano,mes' })
        if (error) throw new Error(error.message)
      }
      toast({
        title: `Resultados importados pra ${MESES_NOMES[mes - 1]}/${ano}`,
        description: `${registrosCivf.length} de Desconto CIVF, ${registrosStressTest.length} de Desconto Stress Test.`,
      })
      setFile(null)
      setLinhas([])
      setErrosParse([])
    } catch (err) {
      toast({ title: 'Erro ao importar resultados da Frota', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  const totalRegistros = Array.from(agregados.values()).filter(a => a.temCivf).length
    + Array.from(agregados.values()).filter(a => a.temStressTest).length

  return (
    <div className="max-w-xl space-y-3">
      <h2 className="text-base font-semibold">Desconto CIVF / Desconto Stress Test — resultado mensal</h2>
      <p className="text-sm text-muted-foreground">
        Suba a planilha (Excel) com a aba <span className="font-mono text-xs">Resultado</span> e as colunas{' '}
        <span className="font-mono text-xs">CDD GINFO · CIVF · TT STRESS TEST</span>. Cada arquivo é o resultado de
        um único mês/ano pra todas as unidades.
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
        <FilePickerButton label="Planilha (.xlsx ou .csv)" accept=".xlsx,.xls,.csv,.txt" file={file} onFile={handleFile} />
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
            {resolucao.naoReconhecidas.length} unidade(s) não reconhecida(s) — cadastre como apelido na Administração e suba de novo:
          </p>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono">
            {resolucao.naoReconhecidas.map(o => <li key={o}>{o}</li>)}
          </ul>
        </div>
      )}

      {file && (
        <div className="flex items-center gap-3">
          <Button onClick={handleImportar} disabled={totalRegistros === 0 || importando} className="gap-2">
            {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar {totalRegistros} resultado(s)
          </Button>
          <Button variant="outline" onClick={() => { setFile(null); setLinhas([]); setErrosParse([]) }} disabled={importando}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}
