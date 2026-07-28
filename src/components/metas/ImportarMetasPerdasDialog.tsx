import { useState } from 'react'
import { Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { parseMetasPerdasXlsx, type ParsedMetaPerdaIndicador, type ParsedMetaPerdaTotal } from '@/lib/metas-perdas-xlsx-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { FileDropzone } from '@/components/importacao/FileDropzone'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import type { Unidade } from '@/types'

const BATCH_SIZE = 500

interface ImportarMetasPerdasDialogProps {
  unidades: Unidade[]
  onImportado: () => void
}

/**
 * Importa a Meta de Perdas via .xlsx no formato "ACUMULADO" (indicadores nas
 * linhas, unidades nas colunas) — grava a meta de cada indicador em
 * metas_perdas_indicadores, e o TOTAL/"Perdas (sem OC) Acumulado" (%) em
 * metas_perdas (mesmos campos de sempre, base do cálculo mensal). A planilha
 * não tem coluna de ano — o campo Ano abaixo vale pra todas as linhas do arquivo.
 */
export function ImportarMetasPerdasDialog({ unidades, onImportado }: ImportarMetasPerdasDialogProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const [indicadores, setIndicadores] = useState<ParsedMetaPerdaIndicador[]>([])
  const [totais, setTotais] = useState<ParsedMetaPerdaTotal[]>([])
  const [erros, setErros] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  function unidadeAtual(nome: string): string | undefined {
    return resolverUnidade(nome, unidades)?.codigo
  }

  const indicadoresValidos = indicadores
    .map(i => ({ ...i, unidade: unidadeAtual(i.unidade) }))
    .filter((i): i is ParsedMetaPerdaIndicador => i.unidade !== undefined)
  const totaisValidos = totais
    .map(t => ({ ...t, unidade: unidadeAtual(t.unidade) }))
    .filter((t): t is ParsedMetaPerdaTotal => t.unidade !== undefined)

  const unidadesDesconhecidas = Array.from(new Set([
    ...indicadores.filter(i => !unidadeAtual(i.unidade)).map(i => i.unidade),
    ...totais.filter(t => !unidadeAtual(t.unidade)).map(t => t.unidade),
  ]))

  async function handleFile(f: File) {
    setFile(f)
    const resultado = await parseMetasPerdasXlsx(f)
    setIndicadores(resultado.indicadores)
    setTotais(resultado.totais)
    setErros(resultado.erros)
  }

  async function handleImportar() {
    const anoNum = Number(ano)
    if (!anoNum) {
      toast({ title: 'Informe o ano', variant: 'destructive' })
      return
    }
    setImportando(true)
    try {
      const linhasIndicadores = indicadoresValidos.map(i => ({ unidade: i.unidade, ano: anoNum, indicador: i.indicador, meta_anual: i.meta_anual }))
      for (let idx = 0; idx < linhasIndicadores.length; idx += BATCH_SIZE) {
        const batch = linhasIndicadores.slice(idx, idx + BATCH_SIZE)
        const { error } = await supabase.from('metas_perdas_indicadores').upsert(batch, { onConflict: 'unidade,ano,indicador' })
        if (error) throw new Error(error.message)
      }

      const linhasTotais = totaisValidos.map(t => ({ unidade: t.unidade, ano: anoNum, meta_pct: t.meta_pct, meta_anual: t.meta_anual }))
      if (linhasTotais.length > 0) {
        const { error } = await supabase.from('metas_perdas').upsert(linhasTotais, { onConflict: 'unidade,ano' })
        if (error) throw new Error(error.message)
      }

      toast({
        title: `Meta de perdas de ${anoNum} importada com sucesso`,
        description: `${linhasIndicadores.length} indicador(es) × unidade, ${linhasTotais.length} total(is) de unidade.`,
      })
      onImportado()
      handleClose()
    } catch (err) {
      toast({ title: 'Erro ao importar meta de perdas', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setFile(null)
    setIndicadores([])
    setTotais([])
    setErros([])
  }

  return (
    <Dialog open={open} onOpenChange={v => (v ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2"><Upload className="h-4 w-4" />Importar planilha</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Importar Meta de Perdas (.xlsx)</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Planilha "ACUMULADO": indicadores nas linhas (Devolução, Indisponibilidade, Vales, Multas, Processos
          Trabalhistas, Desconto CIVF, Sinistro de Frota, BNS, TOTAL, Faturamento, Perdas (sem OC) Acumulado %),
          unidades nas colunas. Célula zerada ou vazia = meta zero pra perder naquele indicador. Meta já
          cadastrada pra mesma unidade/ano/indicador é sobrescrita.
        </p>

        <div className="space-y-1.5">
          <Label>Ano da meta</Label>
          <Input type="number" value={ano} onChange={e => setAno(e.target.value)} className="w-28" />
        </div>

        <FileDropzone label="Selecione o arquivo .xlsx" file={file} onFile={handleFile} />

        {file && (
          <div className="space-y-1.5 text-sm">
            <p>
              {indicadoresValidos.length} linha(s) de indicador e {totaisValidos.length} unidade(s) com TOTAL/% prontas pra importar.
            </p>
            {unidadesDesconhecidas.length > 0 && (
              <p className="text-amber-600">Unidade(s) não cadastrada(s), ignoradas: {unidadesDesconhecidas.join(', ')}</p>
            )}
            {erros.length > 0 && (
              <p className="text-red-600">{erros.join(' ')}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={handleImportar} disabled={!file || indicadoresValidos.length === 0 || importando}>
            {importando ? 'Importando...' : `Importar meta de ${ano || '...'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
