import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'

/**
 * Quebras do Armazém T1 (Estância/CDR Bahia) — meta (R$) e peso únicos, uma
 * linha só, vale pras duas unidades (mesmo esquema do Quebras do T2). Sem
 * importação automática ainda.
 */
export function ArmazemT1QuebrasMetaCard() {
  const { toast } = useToast()
  const [meta, setMeta] = useState('')
  const [peso, setPeso] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    supabase.from('rv_armazem_t1_quebras_meta').select('*').maybeSingle().then(({ data, error }) => {
      if (error || !data) return
      const row = data as { meta_valor: number; peso: number }
      setMeta(Number(row.meta_valor).toLocaleString('pt-BR'))
      setPeso(Number(row.peso).toLocaleString('pt-BR'))
    })
  }, [])

  async function handleSalvar() {
    setSalvando(true)
    const { error } = await supabase
      .from('rv_armazem_t1_quebras_meta')
      .upsert({ id: true, meta_valor: parseNumeroPtBr(meta), peso: parseNumeroPtBr(peso) }, { onConflict: 'id' })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar meta de Quebras (T1)', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Meta de Quebras (T1) salva' })
  }

  return (
    <TableCard
      titulo="Quebras (T1)"
      subtitulo="Meta única (R$) e peso, valem pra Estância e CDR Bahia. Quanto menor melhor."
      className="max-w-md"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Indicador</TableHead>
            <TableHead className="w-32 text-center">Meta (R$)</TableHead>
            <TableHead className="w-28 text-center">Peso (%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
            <TableCell className="text-sm font-medium">Quebras</TableCell>
            <TableCell className="text-center">
              <Input
                value={meta}
                onChange={e => setMeta(e.target.value)}
                onBlur={handleSalvar}
                placeholder="Ex: 1.500,00"
                className="mx-auto h-8 w-28 text-center tabular-nums"
              />
            </TableCell>
            <TableCell className="text-center">
              <Input
                value={peso}
                onChange={e => setPeso(e.target.value)}
                onBlur={handleSalvar}
                placeholder="Ex: 10"
                className="mx-auto h-8 w-20 text-center tabular-nums"
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {salvando && <p className="px-4 pb-3 text-xs text-muted-foreground">Salvando...</p>}
    </TableCard>
  )
}
