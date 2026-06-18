import { useRef, useState } from 'react'
import { Upload, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileDropzoneProps {
  label: string
  accept?: string
  file: File | null
  onFile: (f: File) => void
}

export function FileDropzone({ label, accept = '.xlsx,.xls', file, onFile }: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
      )}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
      {file
        ? (
          <div className="flex items-center gap-3 text-sm">
            <FileSpreadsheet className="h-8 w-8 text-green-600" />
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          </div>
        )
        : (
          <div className="flex flex-col items-center gap-2 text-center">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">Clique ou arraste o arquivo aqui</p>
          </div>
        )
      }
    </div>
  )
}
