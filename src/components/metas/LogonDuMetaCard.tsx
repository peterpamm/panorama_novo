import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'

/**
 * Meta única (%) do indicador LogOn DU — vale pra todas as unidades, quanto
 * maior melhor. O peso é por função (COORD. DU / SUPERVISOR DU, ver
 * PesosDistribuicaoFuncaoCard) — LogOn DU não conta pra SUPERVISOR DU.
 */
export function LogonDuMetaCard() {
  const { toast } = useToast()
  const [metaPct, setMetaPct] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    supabase.from('rv_logon_du_meta').select('*').maybeSingle().then(({ data, error }) => {
      if (error || !data) return
      setMetaPct(Number((data as { meta_pct: number }).meta_pct).toLocaleString('pt-BR'))
    })
  }, [])

  async function handleSalvar() {
    setSalvando(true)
    const { error } = await supabase
      .from('rv_logon_du_meta')
      .upsert({ id: true, meta_pct: parseNumeroPtBr(metaPct) }, { onConflict: 'id' })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar meta de LogOn DU', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Meta de LogOn DU salva' })
  }

  return (
    <TableCard titulo="LogOn DU" subtitulo="Meta única (%), vale pra todas as unidades — quanto maior melhor." className="max-w-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Indicador</TableHead>
            <TableHead className="w-28 text-center">Meta (%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
            <TableCell className="text-sm font-medium">LogOn DU</TableCell>
            <TableCell className="text-center">
              <Input
                value={metaPct}
                onChange={e => setMetaPct(e.target.value)}
                onBlur={handleSalvar}
                placeholder="Ex: 90"
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
