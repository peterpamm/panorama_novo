import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'

interface ValesMetaCardProps {
  /** Tabela de % da Meta de Perdas de Vales do setor (peso só quando temPeso). */
  tabela: 'rv_vales_distribuicao_meta' | 'rv_vales_financeiro_meta'
  /** Distribuição não tem peso aqui — é por função (PesosDistribuicaoFuncaoCard). Financeiro continua com peso único aqui. */
  temPeso?: boolean
}

/**
 * % da Meta de Perdas do indicador Vales (e, no Financeiro, também o peso
 * único) — a liderança tem que gastar no máximo esse % (ex: 95) do que a
 * Meta de Perdas de Vales permite no mês (metas_perdas_indicadores,
 * indicador='vales', anual/12). Meta única, vale pra todas as unidades e
 * lideranças do setor. Reaproveitado pelas Metas de Distribuição e do
 * Financeiro, cada uma com sua própria tabela.
 */
export function ValesMetaCard({ tabela, temPeso = true }: ValesMetaCardProps) {
  const { toast } = useToast()
  const [peso, setPeso] = useState('')
  const [pctMeta, setPctMeta] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    supabase.from(tabela).select('*').maybeSingle().then(({ data, error }) => {
      if (error || !data) return
      const row = data as { peso?: number; pct_meta: number }
      if (temPeso) setPeso(Number(row.peso ?? 0).toLocaleString('pt-BR'))
      setPctMeta(Number(row.pct_meta).toLocaleString('pt-BR'))
    })
  }, [tabela, temPeso])

  async function handleSalvar() {
    setSalvando(true)
    const payload: Record<string, unknown> = { id: true, pct_meta: parseNumeroPtBr(pctMeta) }
    if (temPeso) payload.peso = parseNumeroPtBr(peso)
    const { error } = await supabase.from(tabela).upsert(payload, { onConflict: 'id' })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar meta de Vales', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Meta de Vales salva' })
  }

  return (
    <TableCard
      titulo="Vales"
      subtitulo={temPeso
        ? 'Peso e % da Meta de Perdas de Vales que a liderança pode gastar no mês, vale pra todas as unidades.'
        : '% da Meta de Perdas de Vales que a liderança pode gastar no mês, vale pra todas as unidades.'}
      className="max-w-md"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Indicador</TableHead>
            <TableHead className="w-32 text-center">% da Meta de Perdas</TableHead>
            {temPeso && <TableHead className="w-28 text-center">Peso (%)</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
            <TableCell className="text-sm font-medium">Vales</TableCell>
            <TableCell className="text-center">
              <Input
                value={pctMeta}
                onChange={e => setPctMeta(e.target.value)}
                onBlur={handleSalvar}
                placeholder="Ex: 95"
                className="mx-auto h-8 w-24 text-center tabular-nums"
              />
            </TableCell>
            {temPeso && (
              <TableCell className="text-center">
                <Input
                  value={peso}
                  onChange={e => setPeso(e.target.value)}
                  onBlur={handleSalvar}
                  placeholder="Ex: 10"
                  className="mx-auto h-8 w-20 text-center tabular-nums"
                />
              </TableCell>
            )}
          </TableRow>
        </TableBody>
      </Table>
      {salvando && <p className="px-4 pb-3 text-xs text-muted-foreground">Salvando...</p>}
    </TableCard>
  )
}
