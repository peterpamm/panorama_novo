import { useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { parseFrotaResultadoFile, type ParsedFrotaResultadoRow } from '@/lib/frota-resultado-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type {
  ResultadoAdChecklistFrota, ResultadoAdMilimetragemFrota, ResultadoDescontoCivf, ResultadoDescontoStressTest,
  ResultadoDispEmpilhadeiraFrota, ResultadoIndispManutencaoFrota, Unidade,
} from '@/types'

const BATCH_SIZE = 500
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const ANOS_IMPORT = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

interface Acumulado {
  civf: number; temCivf: boolean
  stressTest: number; temStressTest: boolean
  dispEmpilhadeira: number; temDispEmpilhadeira: boolean
  adMilimetragem: number; temAdMilimetragem: boolean
  indispManutencao: number; temIndispManutencao: boolean
  adChecklist: number; temAdChecklist: boolean
}

/**
 * Importa o resultado mensal da Frota — planilha com aba "Resultado", unidade
 * pela coluna CDD GINFO: Desconto CIVF / Desconto Stress Test (R$) e
 * Disponibilidade Empilhadeira / Aderência ao Checklist / Aderência à
 * Milimetragem / Indisponibilidade Manutenção (%, só Estância/Ponta Grossa/
 * CDR Bahia têm valor — ver `OPERACOES_FROTA_T1`, rv-frota-t1.ts; Custos Gerais não entra
 * aqui, vem direto do DRE). Cada arquivo é o resultado de um único mês/ano
 * pra todas as unidades. Se a mesma unidade aparecer em mais de uma linha
 * (ex: duas operações da mesma CDD), os valores são somados em vez de uma
 * linha sobrescrever a outra.
 */
export function ImportarResultadosFrota() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [file, setFile] = useState<File | null>(null)
  const [anoImport, setAnoImport] = useState(String(new Date().getFullYear()))
  const [mesImport, setMesImport] = useState(String(new Date().getMonth() + 1))
  const [linhas, setLinhas] = useState<ParsedFrotaResultadoRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseFrotaResultadoFile(f)
      setLinhas(resultado.linhas)
      setErrosParse(resultado.erros)
    } catch (err) {
      setLinhas([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  const resolucao = useMemo(() => {
    const resolvidas: { linha: ParsedFrotaResultadoRow; unidade: Unidade }[] = []
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
    const porUnidade = new Map<string, Acumulado>()
    for (const { linha, unidade } of resolucao.resolvidas) {
      const atual = porUnidade.get(unidade.codigo) ?? {
        civf: 0, temCivf: false, stressTest: 0, temStressTest: false,
        dispEmpilhadeira: 0, temDispEmpilhadeira: false, adMilimetragem: 0, temAdMilimetragem: false,
        indispManutencao: 0, temIndispManutencao: false, adChecklist: 0, temAdChecklist: false,
      }
      if (linha.civf !== null) { atual.civf += linha.civf; atual.temCivf = true }
      if (linha.stressTest !== null) { atual.stressTest += linha.stressTest; atual.temStressTest = true }
      if (linha.dispEmpilhadeira !== null) { atual.dispEmpilhadeira += linha.dispEmpilhadeira; atual.temDispEmpilhadeira = true }
      if (linha.adMilimetragem !== null) { atual.adMilimetragem += linha.adMilimetragem; atual.temAdMilimetragem = true }
      if (linha.indispManutencao !== null) { atual.indispManutencao += linha.indispManutencao; atual.temIndispManutencao = true }
      if (linha.adChecklist !== null) { atual.adChecklist += linha.adChecklist; atual.temAdChecklist = true }
      porUnidade.set(unidade.codigo, atual)
    }
    return porUnidade
  }, [resolucao])

  async function handleImportar() {
    const ano = Number(anoImport)
    const mes = Number(mesImport)
    const registrosCivf: Omit<ResultadoDescontoCivf, 'id'>[] = []
    const registrosStressTest: Omit<ResultadoDescontoStressTest, 'id'>[] = []
    const registrosDispEmpilhadeira: Omit<ResultadoDispEmpilhadeiraFrota, 'id'>[] = []
    const registrosAdMilimetragem: Omit<ResultadoAdMilimetragemFrota, 'id'>[] = []
    const registrosIndispManutencao: Omit<ResultadoIndispManutencaoFrota, 'id'>[] = []
    const registrosAdChecklist: Omit<ResultadoAdChecklistFrota, 'id'>[] = []
    for (const [codigo, acc] of agregados) {
      if (acc.temCivf) registrosCivf.push({ unidade: codigo, ano, mes, valor: acc.civf })
      if (acc.temStressTest) registrosStressTest.push({ unidade: codigo, ano, mes, valor: acc.stressTest })
      if (acc.temDispEmpilhadeira) registrosDispEmpilhadeira.push({ unidade: codigo, ano, mes, valor: acc.dispEmpilhadeira })
      if (acc.temAdMilimetragem) registrosAdMilimetragem.push({ unidade: codigo, ano, mes, valor: acc.adMilimetragem })
      if (acc.temIndispManutencao) registrosIndispManutencao.push({ unidade: codigo, ano, mes, valor: acc.indispManutencao })
      if (acc.temAdChecklist) registrosAdChecklist.push({ unidade: codigo, ano, mes, valor: acc.adChecklist })
    }
    const grupos = [
      { tabela: 'resultados_desconto_civf', registros: registrosCivf, label: 'Desconto CIVF' },
      { tabela: 'resultados_desconto_stress_test', registros: registrosStressTest, label: 'Desconto Stress Test' },
      { tabela: 'resultados_disp_empilhadeira_frota', registros: registrosDispEmpilhadeira, label: 'Disponibilidade Empilhadeira' },
      { tabela: 'resultados_ad_milimetragem_frota', registros: registrosAdMilimetragem, label: 'Ad. Milimetragem' },
      { tabela: 'resultados_indisp_manutencao_frota', registros: registrosIndispManutencao, label: 'Indisponibilidade Manutenção' },
      { tabela: 'resultados_ad_checklist_frota', registros: registrosAdChecklist, label: 'Ad. Checklist' },
    ] as const

    if (grupos.every(g => g.registros.length === 0)) return

    setImportando(true)
    try {
      for (const grupo of grupos) {
        for (let i = 0; i < grupo.registros.length; i += BATCH_SIZE) {
          const batch = grupo.registros.slice(i, i + BATCH_SIZE)
          const { error } = await supabase.from(grupo.tabela).upsert(batch, { onConflict: 'unidade,ano,mes' })
          if (error) throw new Error(error.message)
        }
      }
      toast({
        title: `Resultados importados pra ${MESES_NOMES[mes - 1]}/${ano}`,
        description: grupos.filter(g => g.registros.length > 0).map(g => `${g.registros.length} de ${g.label}`).join(', '),
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

  const totalRegistros = Array.from(agregados.values()).reduce((acc, a) =>
    acc + [a.temCivf, a.temStressTest, a.temDispEmpilhadeira, a.temAdMilimetragem, a.temIndispManutencao, a.temAdChecklist].filter(Boolean).length, 0)

  return (
    <div className="max-w-xl space-y-3">
      <h2 className="text-base font-semibold">Frota — resultado mensal</h2>
      <p className="text-sm text-muted-foreground">
        Suba a planilha (Excel) com a aba <span className="font-mono text-xs">Resultado</span> e as colunas{' '}
        <span className="font-mono text-xs">CDD GINFO · CIVF · TT STRESS TEST · DISP. EMPILHADEIRA · ADERENCIA MM · INDSP MANUT · ADERENCIA CHECKLIST</span>{' '}
        (as 4 últimas só têm valor pra Estância/Ponta Grossa/CDR Bahia). Cada arquivo é o resultado de um único mês/ano pra todas as unidades.
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
