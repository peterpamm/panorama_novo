import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'

/**
 * Meta única (R$) do indicador Indisponibilidade — vale pra todas as
 * unidades. O resultado mensal não tem importação própria aqui — já vem da
 * planilha importada no Painel de Perdas (painel_perdas_aux, indicador =
 * 'indisponibilidade'). O peso é por função (COORD. DU / SUPERVISOR DU, ver
 * PesosDistribuicaoFuncaoCard).
 */
export function IndisponibilidadeMetaCard() {
  const { toast } = useToast()
  const [metaValor, setMetaValor] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    supabase.from('rv_indisponibilidade_meta').select('*').maybeSingle().then(({ data, error }) => {
      if (error || !data) return
      setMetaValor(Number((data as { meta_valor: number }).meta_valor).toLocaleString('pt-BR'))
    })
  }, [])

  async function handleSalvar() {
    setSalvando(true)
    const { error } = await supabase
      .from('rv_indisponibilidade_meta')
      .upsert({ id: true, meta_valor: parseNumeroPtBr(metaValor) }, { onConflict: 'id' })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar meta de Indisponibilidade', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Meta de Indisponibilidade salva' })
  }

  return (
    <TableCard titulo="Indisponibilidade" subtitulo="Meta única (R$), vale pra todas as unidades." className="max-w-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Indicador</TableHead>
            <TableHead className="w-32 text-center">Valor (R$)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
            <TableCell className="text-sm font-medium">Indisponibilidade</TableCell>
            <TableCell className="text-center">
              <Input
                value={metaValor}
                onChange={e => setMetaValor(e.target.value)}
                onBlur={handleSalvar}
                placeholder="Ex: 1.500,00"
                className="mx-auto h-8 w-28 text-center tabular-nums"
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {salvando && <p className="px-4 pb-3 text-xs text-muted-foreground">Salvando...</p>}
    </TableCard>
  )
}
