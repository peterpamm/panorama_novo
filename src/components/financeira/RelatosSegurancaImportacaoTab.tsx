import { useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { parseRelatosSegurancaXlsx, type ParsedRelatoSeguranca } from '@/lib/relatos-seguranca-parser'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

const BATCH_SIZE = 500

/**
 * Importação de Relatos de Segurança (RELATOS/GSDPQ) — base da Pirâmide de
 * Segurança do SDG Gerentes (`SlidePiramideSeguranca.tsx`). Arquivo é um
 * export direto do sistema de relatos (aba "RELATOS"), não uma planilha
 * preenchida à mão — por isso sem "modelo de planilha" aqui, diferente das
 * outras telas de importação. Upsert por `relato_id` (o ID da linha na
 * planilha de origem): reimportar o mesmo arquivo, ou um mais novo que
 * inclui linhas já importadas antes, atualiza em vez de duplicar.
 */
export function RelatosSegurancaImportacaoTab() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [file, setFile] = useState<File | null>(null)
  const [linhas, setLinhas] = useState<ParsedRelatoSeguranca[]>([])
  const [erros, setErros] = useState<string[]>([])
  const [unidadesNaoReconhecidas, setUnidadesNaoReconhecidas] = useState<string[]>([])
  const [processando, setProcessando] = useState(false)
  const [importando, setImportando] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    setProcessando(true)
    try {
      const resultado = await parseRelatosSegurancaXlsx(f, unidades)
      setLinhas(resultado.linhas)
      setErros(resultado.erros)
      setUnidadesNaoReconhecidas(resultado.unidadesNaoReconhecidas)
    } catch (err) {
      setLinhas([])
      setErros([`Erro ao ler o arquivo: ${String(err)}`])
      setUnidadesNaoReconhecidas([])
    } finally {
      setProcessando(false)
    }
  }

  async function handleImportar() {
    if (linhas.length === 0) return
    setImportando(true)
    try {
      for (let i = 0; i < linhas.length; i += BATCH_SIZE) {
        const batch = linhas.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from('relatos_seguranca').upsert(batch, { onConflict: 'relato_id' })
        if (error) throw new Error(error.message)
      }
      toast({ title: `${linhas.length} relato(s) importado(s)` })
      setFile(null)
      setLinhas([])
      setErros([])
      setUnidadesNaoReconhecidas([])
    } catch (err) {
      toast({ title: 'Erro ao importar relatos', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-3">
      <h2 className="text-base font-semibold">Importação — Relatos de Segurança</h2>
      <p className="text-sm text-muted-foreground">
        Suba o export do sistema de relatos (aba "RELATOS") — cada linha vira um relato, usado na Pirâmide de
        Segurança do SDG Gerentes. A unidade, data e classificação de cada relato já vêm prontas do arquivo.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <FilePickerButton label="Planilha (.xlsx)" accept=".xlsx,.xls" file={file} onFile={handleFile} />
      </div>

      {processando ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Lendo arquivo...
        </div>
      ) : file && (
        <>
          {erros.length > 0 && (
            <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
              <p className="mb-1 font-semibold">{erros.length} problema(s) no arquivo:</p>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto">
                {erros.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {unidadesNaoReconhecidas.length > 0 && (
            <div className="rounded-lg border border-red-300/50 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              <p className="mb-1 font-semibold">
                {unidadesNaoReconhecidas.length} unidade(s) não reconhecida(s) — cadastre como apelido na Administração e suba de novo:
              </p>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono">
                {unidadesNaoReconhecidas.map(o => <li key={o}>{o}</li>)}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={handleImportar} disabled={linhas.length === 0 || importando} className="gap-2">
              {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar {linhas.length} relato(s)
            </Button>
            <Button variant="outline" onClick={() => { setFile(null); setLinhas([]); setErros([]); setUnidadesNaoReconhecidas([]) }} disabled={importando}>
              Cancelar
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
