import { useState } from 'react'
import { Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { parsePainelPerdasAuxCsv, type ParsedPainelPerdasAuxRow } from '@/lib/painel-perdas-aux-csv-parser'
import { FileDropzone } from '@/components/importacao/FileDropzone'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import type { Unidade } from '@/types'

const BATCH_SIZE = 500

interface ImportarPainelPerdasAuxDialogProps {
  unidades: Unidade[]
  onImportado: () => void
}

/** Importa Indisponibilidade e Devolução do painel_de_perdas.csv (formato: INDICADOR;NEGOCIO;ANO;MES;UNIDADE;VALOR). */
export function ImportarPainelPerdasAuxDialog({ unidades, onImportado }: ImportarPainelPerdasAuxDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [linhas, setLinhas] = useState<ParsedPainelPerdasAuxRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  function codigoConhecido(cod: string): string | undefined {
    return unidades.find(u => u.codigo === cod || u.nome_ginfo === cod)?.codigo
  }

  const validas = linhas
    .map(l => ({ ...l, unidade: codigoConhecido(l.unidade) }))
    .filter((l): l is ParsedPainelPerdasAuxRow => l.unidade !== undefined)

  const desconhecidas = Array.from(new Set(
    linhas.filter(l => !codigoConhecido(l.unidade)).map(l => l.unidade)
  ))

  async function handleFile(f: File) {
    setFile(f)
    const texto = await f.text()
    const resultado = parsePainelPerdasAuxCsv(texto)
    setLinhas(resultado.linhas)
    setErrosParse(resultado.erros)
  }

  async function handleImportar() {
    setImportando(true)
    try {
      for (let i = 0; i < validas.length; i += BATCH_SIZE) {
        const batch = validas.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('painel_perdas_aux')
          .upsert(batch, { onConflict: 'unidade,ano,mes,indicador' })
        if (error) throw new Error(error.message)
      }
      toast({ title: `${validas.length} registro(s) importado(s) com sucesso` })
      onImportado()
      handleClose()
    } catch (err) {
      toast({ title: 'Erro ao importar dados AUX', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setFile(null)
    setLinhas([])
    setErrosParse([])
  }

  return (
    <Dialog open={open} onOpenChange={v => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />Importar Indisponib./Devolução
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar dados AUX (Indisponibilidade / Devolução)</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Formato: <span className="font-mono">INDICADOR;NEGOCIO;ANO;MES;UNIDADE;VALOR</span> (decimal com vírgula).
          Indicadores: <span className="font-mono">Indisponibilidade</span> ou <span className="font-mono">Devolução</span>.
          Registros já existentes pro mesmo período são sobrescritos.
        </p>

        <FileDropzone label="Selecione o arquivo .csv" accept=".csv" file={file} onFile={handleFile} />

        {file && (
          <div className="space-y-1.5 text-sm">
            <p>
              {validas.length} registro(s) pronto(s) pra importar
              {linhas.length !== validas.length ? ` (${linhas.length - validas.length} ignorado(s))` : ''}.
            </p>
            {desconhecidas.length > 0 && (
              <p className="text-amber-600">Unidade(s) não cadastrada(s), linhas ignoradas: {desconhecidas.join(', ')}</p>
            )}
            {errosParse.length > 0 && (
              <p className="text-red-600">{errosParse.length} linha(s) com erro de leitura.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={handleImportar} disabled={!file || validas.length === 0 || importando}>
            {importando ? 'Importando...' : `Importar ${validas.length} registro(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
