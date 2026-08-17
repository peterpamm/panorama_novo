import { useState } from 'react'
import { Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { parseLucroXlsx, type LinhaLucro } from '@/lib/lucro-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { FileDropzone } from '@/components/importacao/FileDropzone'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import type { LucroAmbevRow, Unidade } from '@/types'

const BATCH_SIZE = 500

interface ImportarLucroDialogProps {
  unidades: Unidade[]
  onImportado: () => void
}

/**
 * Importa a planilha de Lucro da Ambev (Volume Atual × R$/HL por
 * unidade×negócio×mês, vindo da coluna "Vigencia") — mesmo padrão dos
 * demais importadores (resolve unidade pelos apelidos cadastrados,
 * upsert em lote). Registros do mesmo período são sobrescritos.
 */
export function ImportarLucroDialog({ unidades, onImportado }: ImportarLucroDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [linhas, setLinhas] = useState<LinhaLucro[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  function codigoConhecido(nome: string): string | undefined {
    return resolverUnidade(nome, unidades)?.codigo
  }

  const validas: LucroAmbevRow[] = linhas
    .map(l => ({ ...l, unidade: codigoConhecido(l.unidadeNome) }))
    .filter((l): l is LinhaLucro & { unidade: string } => l.unidade !== undefined)
    .map(l => ({
      unidade: l.unidade,
      negocio: l.negocio,
      ano: l.ano,
      mes: l.mes,
      volume: l.volume,
      valor_hl: l.valorHl,
      lucro: l.lucro,
    }))

  const desconhecidas = Array.from(new Set(
    linhas.filter(l => !codigoConhecido(l.unidadeNome)).map(l => l.unidadeNome),
  ))

  async function handleFile(f: File) {
    setFile(f)
    const resultado = await parseLucroXlsx(f)
    setLinhas(resultado.linhas)
    setErrosParse(resultado.erros)
  }

  async function handleImportar() {
    setImportando(true)
    try {
      for (let i = 0; i < validas.length; i += BATCH_SIZE) {
        const batch = validas.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('lucro_ambev')
          .upsert(batch, { onConflict: 'unidade,negocio,ano,mes' })
        if (error) throw new Error(error.message)
      }
      toast({ title: `${validas.length} registro(s) importado(s) com sucesso` })
      onImportado()
      handleClose()
    } catch (err) {
      toast({ title: 'Erro ao importar Lucro', description: String(err), variant: 'destructive' })
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
        <Button size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Importar planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Lucro</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Planilha da Ambev com as colunas <span className="font-mono">Vigencia</span> (ex: ROTA_2_3_2026 = negócio
          ROTA, março/2026), <span className="font-mono">Unidade - Nome</span>, <span className="font-mono">Volume Atual</span>,{' '}
          <span className="font-mono">R$/HL</span> e <span className="font-mono">Lucro</span>. Registros do mesmo
          negócio/mês/ano são sobrescritos.
        </p>

        <FileDropzone label="Selecione o arquivo .xlsx" file={file} onFile={handleFile} />

        {file && (
          <div className="space-y-1.5 text-sm">
            <p>
              {validas.length} registro(s) pronto(s) pra importar
              {linhas.length !== validas.length ? ` (${linhas.length - validas.length} ignorado(s))` : ''}.
            </p>
            {desconhecidas.length > 0 && (
              <p className="text-amber-600">
                Unidade(s) não reconhecida(s) (cadastre um apelido em Administração se o nome vier diferente),
                linhas ignoradas: {desconhecidas.join(', ')}
              </p>
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
