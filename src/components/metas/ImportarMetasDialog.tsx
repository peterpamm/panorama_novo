import { useState } from 'react'
import { Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { parseMetasCsv, type ParsedMetaCsvRow } from '@/lib/metas-csv-parser'
import { FileDropzone } from '@/components/importacao/FileDropzone'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import type { Negocio, Unidade } from '@/types'

const BATCH_SIZE = 500

interface ImportarMetasDialogProps {
  unidades: Unidade[]
  negocios: Negocio[]
  onImportado: () => void
}

/** Importa metas anuais/mensais de um CSV no formato unidade;negocio;ano;codigo;meta_avr;mes (mesmo padrão usado como referência no painel antigo). Sobrescreve metas já cadastradas pra mesma chave. */
export function ImportarMetasDialog({ unidades, negocios, onImportado }: ImportarMetasDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [linhas, setLinhas] = useState<ParsedMetaCsvRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  function unidadeAtual(codigoOuSlug: string): string | undefined {
    return unidades.find(u => u.codigo === codigoOuSlug || u.nome_ginfo === codigoOuSlug)?.codigo
  }

  const codigosNegocio = new Set(negocios.map(n => n.codigo))

  const validas = linhas
    .map(l => ({ ...l, unidade: unidadeAtual(l.unidade) }))
    .filter((l): l is ParsedMetaCsvRow => l.unidade !== undefined && codigosNegocio.has(l.negocio))

  const unidadesDesconhecidas = Array.from(new Set(linhas.filter(l => !unidadeAtual(l.unidade)).map(l => l.unidade)))
  const negociosDesconhecidos = Array.from(new Set(linhas.filter(l => !codigosNegocio.has(l.negocio)).map(l => l.negocio)))

  async function handleFile(f: File) {
    setFile(f)
    const texto = await f.text()
    const resultado = parseMetasCsv(texto)
    setLinhas(resultado.linhas)
    setErrosParse(resultado.erros)
  }

  async function handleImportar() {
    setImportando(true)
    try {
      for (let i = 0; i < validas.length; i += BATCH_SIZE) {
        const batch = validas.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from('metas').upsert(batch, { onConflict: 'unidade,negocio,ano,codigo,mes' })
        if (error) throw new Error(error.message)
      }
      toast({ title: `${validas.length} meta(s) importada(s) com sucesso` })
      onImportado()
      handleClose()
    } catch (err) {
      toast({ title: 'Erro ao importar metas', description: String(err), variant: 'destructive' })
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
        <Button size="sm" variant="outline" className="gap-2"><Upload className="h-4 w-4" />Importar CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Importar metas via CSV</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Formato: <span className="font-mono">unidade;negocio;ano;codigo;meta_avr;mes</span> (decimal com vírgula, mês 0 = meta anual).
          Metas já cadastradas pra mesma unidade/negócio/ano/código/mês são sobrescritas.
        </p>

        <FileDropzone label="Selecione o arquivo .csv" accept=".csv" file={file} onFile={handleFile} />

        {file && (
          <div className="space-y-1.5 text-sm">
            <p>
              {validas.length} linha(s) pronta(s) pra importar
              {linhas.length !== validas.length ? ` (${linhas.length - validas.length} ignorada(s))` : ''}.
            </p>
            {unidadesDesconhecidas.length > 0 && (
              <p className="text-amber-600">Unidade(s) não cadastrada(s), linhas ignoradas: {unidadesDesconhecidas.join(', ')}</p>
            )}
            {negociosDesconhecidos.length > 0 && (
              <p className="text-amber-600">Negócio(s) não cadastrado(s), linhas ignoradas: {negociosDesconhecidos.join(', ')}</p>
            )}
            {errosParse.length > 0 && (
              <p className="text-red-600">{errosParse.length} linha(s) com erro de leitura no arquivo.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={handleImportar} disabled={!file || validas.length === 0 || importando}>
            {importando ? 'Importando...' : `Importar ${validas.length} meta(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
