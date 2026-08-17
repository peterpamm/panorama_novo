import { useState } from 'react'
import { Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { parseDisponibilidadeArmazemXlsx, type LinhaDisponibilidadeArmazem } from '@/lib/disponibilidade-armazem-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { FileDropzone } from '@/components/importacao/FileDropzone'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import type { Unidade } from '@/types'

interface ImportarDisponibilidadeArmazemDialogProps {
  unidades: Unidade[]
  onImportado: () => void
}

/**
 * Importa Disponibilidade Armazém (Filial / Disp. Contratado / META) —
 * alimenta o "Disp. Armazém" do Farol Gerentes. A planilha do Armazém às
 * vezes vem sem a coluna META — nesse caso o upsert só manda `real`, e o
 * banco preserva a meta que já estava salva (não some/zera). Quando a
 * planilha TEM a coluna META, atualiza os dois juntos.
 */
export function ImportarDisponibilidadeArmazemDialog({ unidades, onImportado }: ImportarDisponibilidadeArmazemDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [linhas, setLinhas] = useState<LinhaDisponibilidadeArmazem[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [temColunaMeta, setTemColunaMeta] = useState(true)
  const [importando, setImportando] = useState(false)

  function codigoConhecido(nome: string): string | undefined {
    return resolverUnidade(nome, unidades)?.codigo
  }

  const validas = linhas
    .map(l => ({ ...l, unidade: codigoConhecido(l.unidadeNome) }))
    .filter((l): l is LinhaDisponibilidadeArmazem & { unidade: string } => l.unidade !== undefined)

  const desconhecidas = Array.from(new Set(
    linhas.filter(l => !codigoConhecido(l.unidadeNome)).map(l => l.unidadeNome),
  ))

  async function handleFile(f: File) {
    setFile(f)
    const resultado = await parseDisponibilidadeArmazemXlsx(f)
    setLinhas(resultado.linhas)
    setErrosParse(resultado.erros)
    setTemColunaMeta(resultado.temColunaMeta)
  }

  async function handleImportar() {
    setImportando(true)
    try {
      // Sem a coluna META, o payload nem inclui o campo `meta` — o upsert só
      // atualiza `real`, preservando a meta que já estava salva pra cada
      // unidade (em vez de um DELETE + INSERT como a Disponibilidade Rota).
      const payload = temColunaMeta
        ? validas.map(l => ({ unidade: l.unidade, real: l.real, meta: l.meta }))
        : validas.map(l => ({ unidade: l.unidade, real: l.real }))

      const { error } = await supabase
        .from('disponibilidade_armazem_acumulada')
        .upsert(payload, { onConflict: 'unidade' })
      if (error) throw new Error(error.message)

      toast({
        title: `${validas.length} unidade(s) importada(s) com sucesso`,
        description: temColunaMeta ? 'Meta e realizado atualizados.' : 'Só o realizado foi atualizado (planilha sem coluna de meta) — meta anterior preservada.',
      })
      onImportado()
      handleClose()
    } catch (err) {
      toast({ title: 'Erro ao importar Disponibilidade Armazém', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setFile(null)
    setLinhas([])
    setErrosParse([])
    setTemColunaMeta(true)
  }

  return (
    <Dialog open={open} onOpenChange={v => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />Importar Disponibilidade Armazém
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Disponibilidade Armazém</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Colunas: <span className="font-mono">Filial</span>, <span className="font-mono">Disp. Contratado</span> (realizado)
          e <span className="font-mono">META</span>. Alimenta o indicador "Disp. Armazém" do Farol Gerentes. Se a planilha não
          tiver a coluna de meta, a importação atualiza só o realizado e preserva a última meta salva.
        </p>

        <FileDropzone label="Selecione o arquivo .xlsx" file={file} onFile={handleFile} />

        {file && (
          <div className="space-y-1.5 text-sm">
            <p>
              {validas.length} unidade(s) pronta(s) pra importar
              {linhas.length !== validas.length ? ` (${linhas.length - validas.length} ignorada(s))` : ''}.
            </p>
            {!temColunaMeta && (
              <p className="text-amber-600">Essa planilha não tem a coluna de meta — só o realizado será atualizado.</p>
            )}
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
            {importando ? 'Importando...' : `Importar ${validas.length} unidade(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
