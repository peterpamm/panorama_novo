import { useEffect, useRef } from 'react'
import { FolderOpen, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PastaDropzoneProps {
  arquivos: File[]
  onArquivos: (files: File[]) => void
}

/** Seletor de pasta inteira ou de arquivos individuais — varre recursivamente todos os .xlsx (no caso da pasta) sem depender da estrutura de subpastas (a importação lê tudo do próprio nome do arquivo). */
export function PastaDropzone({ arquivos, onArquivos }: PastaDropzoneProps) {
  const pastaInputRef = useRef<HTMLInputElement>(null)
  const arquivosInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (pastaInputRef.current) {
      pastaInputRef.current.setAttribute('webkitdirectory', 'true')
      pastaInputRef.current.setAttribute('directory', 'true')
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const lista = Array.from(e.target.files ?? []).filter(f => f.name.toLowerCase().endsWith('.xlsx'))
    onArquivos(lista)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input ref={pastaInputRef} type="file" multiple className="hidden" onChange={handleChange} />
      <input ref={arquivosInputRef} type="file" multiple accept=".xlsx" className="hidden" onChange={handleChange} />

      <Button type="button" variant="outline" onClick={() => pastaInputRef.current?.click()} className="gap-2">
        <FolderOpen className="h-4 w-4" />
        Selecionar pasta
      </Button>
      <Button type="button" variant="outline" onClick={() => arquivosInputRef.current?.click()} className="gap-2">
        <FileSpreadsheet className="h-4 w-4" />
        Selecionar arquivos
      </Button>

      {arquivos.length > 0 && (
        <span className="text-sm text-muted-foreground">
          {arquivos.length} arquivo{arquivos.length === 1 ? '' : 's'} .xlsx selecionado{arquivos.length === 1 ? '' : 's'}
        </span>
      )}
    </div>
  )
}
