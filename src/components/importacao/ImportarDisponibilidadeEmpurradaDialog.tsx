import { useState } from 'react'
import { Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { parseDisponibilidadeEmpurradaXlsx, type LinhaDisponibilidadeEmpurrada } from '@/lib/disponibilidade-empurrada-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { MODELO_DISPONIBILIDADE_EMPURRADA } from '@/lib/modelos-importacao'
import { FileDropzone } from '@/components/importacao/FileDropzone'
import { BotaoModeloPlanilha } from '@/components/importacao/BotaoModeloPlanilha'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import type { DisponibilidadeEmpurradaAcumulada, Unidade } from '@/types'

interface ImportarDisponibilidadeEmpurradaDialogProps {
  unidades: Unidade[]
  onImportado: () => void
}

/**
 * Importa Disponibilidade Empurrada Acumulada (Unidade / % Disp / Meta) —
 * alimenta o "Disp. Empurrada" do Farol Gerentes (antes sempre "pendente",
 * sem fonte de dado). Mesmo padrão da Disponibilidade Rota: não é
 * histórico, cada importação APAGA tudo que tinha antes e insere de novo
 * (o número já vem acumulado da fonte, só precisamos do último). Na
 * prática só Ponta Grossa e Estância usam esse indicador.
 */
export function ImportarDisponibilidadeEmpurradaDialog({ unidades, onImportado }: ImportarDisponibilidadeEmpurradaDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [linhas, setLinhas] = useState<LinhaDisponibilidadeEmpurrada[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  function codigoConhecido(nome: string): string | undefined {
    return resolverUnidade(nome, unidades)?.codigo
  }

  const validas: DisponibilidadeEmpurradaAcumulada[] = linhas
    .map(l => ({ ...l, unidade: codigoConhecido(l.unidadeNome) }))
    .filter((l): l is LinhaDisponibilidadeEmpurrada & { unidade: string } => l.unidade !== undefined)
    .map(l => ({ unidade: l.unidade, meta: l.meta, real: l.real }))

  const desconhecidas = Array.from(new Set(
    linhas.filter(l => !codigoConhecido(l.unidadeNome)).map(l => l.unidadeNome),
  ))

  async function handleFile(f: File) {
    setFile(f)
    const resultado = await parseDisponibilidadeEmpurradaXlsx(f)
    setLinhas(resultado.linhas)
    setErrosParse(resultado.erros)
  }

  async function handleImportar() {
    setImportando(true)
    try {
      // Substitui tudo — apaga o que tinha antes e insere de novo (delete
      // sem filtro é bloqueado pelo PostgREST, usa um filtro que casa tudo).
      const { error: erroDelete } = await supabase.from('disponibilidade_empurrada_acumulada').delete().neq('unidade', '')
      if (erroDelete) throw new Error(erroDelete.message)

      if (validas.length > 0) {
        const { error: erroInsert } = await supabase.from('disponibilidade_empurrada_acumulada').insert(validas)
        if (erroInsert) throw new Error(erroInsert.message)
      }

      toast({ title: `${validas.length} unidade(s) importada(s) com sucesso`, description: 'Substituiu a importação anterior.' })
      onImportado()
      handleClose()
    } catch (err) {
      toast({ title: 'Erro ao importar Disponibilidade Empurrada', description: String(err), variant: 'destructive' })
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
          <Upload className="h-4 w-4" />Importar Disponibilidade Empurrada
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Disponibilidade Empurrada Acumulada</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Colunas: <span className="font-mono">Unidade</span>, <span className="font-mono">% Disp</span> (realizado) e{' '}
          <span className="font-mono">Meta</span>. Alimenta o indicador "Disp. Empurrada" do Farol Gerentes (na prática
          só Ponta Grossa e Estância) — como o valor já vem acumulado, essa importação <strong>substitui</strong> a
          anterior por completo, não soma.
        </p>

        <div className="flex justify-end">
          <BotaoModeloPlanilha nomeArquivo="modelo_disponibilidade_empurrada" abas={MODELO_DISPONIBILIDADE_EMPURRADA} />
        </div>
        <FileDropzone label="Selecione o arquivo .xlsx" file={file} onFile={handleFile} />

        {file && (
          <div className="space-y-1.5 text-sm">
            <p>
              {validas.length} unidade(s) pronta(s) pra importar
              {linhas.length !== validas.length ? ` (${linhas.length - validas.length} ignorada(s))` : ''}.
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
            {importando ? 'Importando...' : `Substituir por ${validas.length} unidade(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
