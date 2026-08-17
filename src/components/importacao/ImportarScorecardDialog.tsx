import { useState } from 'react'
import { Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { parseScorecardXlsx, type LinhaScorecard } from '@/lib/scorecard-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { FileDropzone } from '@/components/importacao/FileDropzone'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import type { Unidade } from '@/types'

interface ImportarScorecardDialogProps {
  unidades: Unidade[]
  onImportado: () => void
}

/**
 * Importa o Scorecard (Unidade / Canal / Score) — uma linha por unidade ×
 * canal, onde o canal vira o negócio do app ("Apoio Logístico" = Armazém,
 * "Distribuição Urbana" = Rota, "Empurrada" = Empurrada, ver
 * `scorecard-parser.ts`). Alimenta as linhas "Scorecard Rota./Arm./Empur."
 * do Farol Gerentes. Cada importação substitui o snapshot inteiro (mesmo
 * padrão da Disponibilidade Rota), então a planilha precisa vir completa.
 */
export function ImportarScorecardDialog({ unidades, onImportado }: ImportarScorecardDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [linhas, setLinhas] = useState<LinhaScorecard[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  function codigoConhecido(nome: string): string | undefined {
    return resolverUnidade(nome, unidades)?.codigo
  }

  const validas = linhas
    .map(l => ({ unidade: codigoConhecido(l.unidadeNome), negocio: l.negocio, score: l.score }))
    .filter((l): l is { unidade: string; negocio: LinhaScorecard['negocio']; score: number } => l.unidade !== undefined)

  const desconhecidas = Array.from(new Set(
    linhas.filter(l => !codigoConhecido(l.unidadeNome)).map(l => l.unidadeNome),
  ))

  async function handleFile(f: File) {
    setFile(f)
    const resultado = await parseScorecardXlsx(f)
    setLinhas(resultado.linhas)
    setErrosParse(resultado.erros)
  }

  async function handleImportar() {
    setImportando(true)
    try {
      // Substitui tudo — apaga o que tinha antes e insere de novo (delete
      // sem filtro é bloqueado pelo PostgREST, usa um filtro que casa tudo).
      const { error: erroDelete } = await supabase.from('scorecard_acumulado').delete().neq('unidade', '')
      if (erroDelete) throw new Error(erroDelete.message)

      if (validas.length > 0) {
        const { error: erroInsert } = await supabase.from('scorecard_acumulado').insert(validas)
        if (erroInsert) throw new Error(erroInsert.message)
      }

      toast({ title: `${validas.length} linha(s) importada(s) com sucesso`, description: 'Substituiu a importação anterior.' })
      onImportado()
      handleClose()
    } catch (err) {
      toast({ title: 'Erro ao importar Scorecard', description: String(err), variant: 'destructive' })
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
          <Upload className="h-4 w-4" />Importar Scorecard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Scorecard</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Colunas: <span className="font-mono">Unidade</span>, <span className="font-mono">Canal</span> e{' '}
          <span className="font-mono">Score</span> (aceita 97,4%, 0,974 ou 97,4 — sempre lido como percentual).
          Canais: <span className="font-mono">Apoio Logístico</span> (Armazém), <span className="font-mono">Distribuição Urbana</span> (Rota)
          e <span className="font-mono">Empurrada</span>. Alimenta as linhas "Scorecard Rota./Arm./Empur." do Farol Gerentes,
          que batem com 80% ou mais. Cada importação substitui a anterior inteira.
        </p>

        <FileDropzone label="Selecione o arquivo .xlsx" file={file} onFile={handleFile} />

        {file && (
          <div className="space-y-1.5 text-sm">
            <p>
              {validas.length} linha(s) pronta(s) pra importar
              {linhas.length !== validas.length ? ` (${linhas.length - validas.length} ignorada(s))` : ''}.
            </p>
            {desconhecidas.length > 0 && (
              <p className="text-amber-600">
                Unidade(s) não reconhecida(s) (cadastre um apelido em Administração se o nome vier diferente),
                linhas ignoradas: {desconhecidas.join(', ')}
              </p>
            )}
            {errosParse.length > 0 && (
              <div className="text-red-600">
                <p>{errosParse.length} linha(s) com erro de leitura:</p>
                <ul className="ml-4 list-disc">
                  {errosParse.slice(0, 5).map(e => <li key={e}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={handleImportar} disabled={!file || validas.length === 0 || importando}>
            {importando ? 'Importando...' : `Importar ${validas.length} linha(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
