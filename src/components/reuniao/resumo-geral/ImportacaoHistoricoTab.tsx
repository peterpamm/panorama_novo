import { useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { parseHistoricoFile, type ParsedHistoricoRow } from '@/lib/resumo-geral-historico-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { MESES_NOMES, ANOS_RESUMO_GERAL } from '@/pages/reuniao/ReuniaoResumoGeralPage'
import type { Unidade } from '@/types'

const BATCH_SIZE = 500

interface LinhaResolvida {
  linha: ParsedHistoricoRow
  unidade: Unidade
}

/**
 * Importação de Histórico (Etapa 7): acumulado de pontos de cada unidade EM
 * CADA SETOR até um mês de corte (Ano + "Acumulado até" escolhidos aqui,
 * únicos pro arquivo inteiro) — a planilha tem Unidade/Filial + uma coluna
 * por setor (ver `resumo-geral-historico-parser.ts`; a coluna Total, se
 * existir, é só informativa). Upsert em `resumo_geral_historico`, que vira
 * a base do Ranking Anual e do "YTD" do Ranking por Setor: os meses ao vivo
 * depois do corte somam em cima, sem recontar os meses já cobertos.
 */
export function ImportacaoHistoricoTab() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const [mesFinal, setMesFinal] = useState('6')
  const [file, setFile] = useState<File | null>(null)
  const [linhas, setLinhas] = useState<ParsedHistoricoRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseHistoricoFile(f)
      setLinhas(resultado.linhas)
      setErrosParse(resultado.erros)
    } catch (err) {
      setLinhas([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  const resolucao = useMemo(() => {
    const resolvidas: LinhaResolvida[] = []
    const unidadesNaoReconhecidas = new Set<string>()
    for (const linha of linhas) {
      const unidade = resolverUnidade(linha.unidade, unidades)
      if (!unidade) { unidadesNaoReconhecidas.add(linha.unidade); continue }
      resolvidas.push({ linha, unidade })
    }
    return { resolvidas, unidadesNaoReconhecidas: Array.from(unidadesNaoReconhecidas).sort() }
  }, [linhas, unidades])

  async function handleImportar() {
    const registros = resolucao.resolvidas.map(({ linha, unidade }) => ({
      unidade: unidade.codigo, ano: Number(ano), mes_final: Number(mesFinal),
      financeiro: linha.porSetor.financeiro, gente: linha.porSetor.gente, frota: linha.porSetor.frota,
      seguranca: linha.porSetor.seguranca, distribuicao: linha.porSetor.distribuicao, armazem: linha.porSetor.armazem,
    }))
    if (registros.length === 0) return

    setImportando(true)
    try {
      for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from('resumo_geral_historico').upsert(batch, { onConflict: 'unidade,ano' })
        if (error) throw new Error(error.message)
      }
      toast({
        title: `${registros.length} linha(s) importada(s)`,
        description: `Acumulado até ${MESES_NOMES[Number(mesFinal) - 1]}/${ano} — os meses seguintes somam ao vivo no Ranking Anual.`,
      })
      setFile(null)
      setLinhas([])
      setErrosParse([])
    } catch (err) {
      toast({ title: 'Erro ao importar histórico', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-3">
      <h2 className="text-base font-semibold">Importação de Histórico</h2>
      <p className="text-sm text-muted-foreground">
        Acumulado de pontos de cada unidade em cada setor até um mês de corte — planilha com Filial/Unidade e uma
        coluna por setor (Gente, Frota, Segurança, Financeiro, Distribuição, Armazém — a coluna Total, se existir, é
        só informativa). A partir do mês seguinte ao escolhido abaixo, o Ranking Anual e o "YTD" do Ranking por Setor
        passam a somar o cálculo ao vivo em cima desse acumulado, sem recontar os meses já cobertos.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS_RESUMO_GERAL.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Acumulado até</Label>
          <Select value={mesFinal} onValueChange={setMesFinal}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <FilePickerButton label="Planilha (.xlsx/.csv)" accept=".xlsx,.xls,.csv" file={file} onFile={handleFile} />
      </div>

      {errosParse.length > 0 && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <p className="mb-1 font-semibold">{errosParse.length} problema(s) no arquivo:</p>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto">
            {errosParse.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {resolucao.unidadesNaoReconhecidas.length > 0 && (
        <div className="rounded-lg border border-red-300/50 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
          <p className="mb-1 font-semibold">
            {resolucao.unidadesNaoReconhecidas.length} unidade(s) não reconhecida(s) — cadastre como apelido na Administração e suba de novo:
          </p>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono">
            {resolucao.unidadesNaoReconhecidas.map(o => <li key={o}>{o}</li>)}
          </ul>
        </div>
      )}

      {file && (
        <div className="flex items-center gap-3">
          <Button onClick={handleImportar} disabled={resolucao.resolvidas.length === 0 || importando} className="gap-2">
            {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar {resolucao.resolvidas.length} linha(s)
          </Button>
          <Button variant="outline" onClick={() => { setFile(null); setLinhas([]); setErrosParse([]) }} disabled={importando}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}
