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
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
      <input ref={pastaInputRef} type="file" multiple className="hidden" onChange={handleChange} />
      <input ref={arquivosInputRef} type="file" multiple accept=".xlsx" className="hidden" onChange={handleChange} />

      {arquivos.length > 0 ? (
        <div className="flex items-center gap-3 text-sm">
          <FileSpreadsheet className="h-8 w-8 text-green-600" />
          <div>
            <p className="font-medium">{arquivos.length} arquivo{arquivos.length === 1 ? '' : 's'} .xlsx selecionado{arquivos.length === 1 ? '' : 's'}</p>
            <p className="text-muted-foreground">Use os botões abaixo pra escolher outra pasta ou outros arquivos</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Selecione os relatórios DRE pra importar</p>
          <p className="text-xs text-muted-foreground">Pasta inteira (ex: DRE_novo, lê todas as subpastas de uma vez) ou só os arquivos que mudaram</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => pastaInputRef.current?.click()}>Selecionar pasta</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => arquivosInputRef.current?.click()}>Selecionar arquivos</Button>
      </div>
    </div>
  )
}
