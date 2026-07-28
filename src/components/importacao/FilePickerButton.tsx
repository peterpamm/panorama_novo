import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FilePickerButtonProps {
  label?: string
  accept?: string
  file: File | null
  onFile: (f: File) => void
  className?: string
}

/**
 * Botão compacto de seleção de arquivo — alternativa ao FileDropzone (quadrado
 * grande de arrastar-e-soltar) pra usar ao lado de outros filtros/seletores,
 * sem ocupar uma área grande da tela. Mostra o nome do arquivo escolhido no
 * lugar do label assim que seleciona.
 */
export function FilePickerButton({ label = 'Selecionar arquivo', accept, file, onFile, className }: FilePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        className={cn('max-w-[260px] gap-2', className)}
      >
        <Upload className="h-4 w-4 shrink-0" />
        <span className="truncate">{file ? file.name : label}</span>
      </Button>
    </>
  )
}
