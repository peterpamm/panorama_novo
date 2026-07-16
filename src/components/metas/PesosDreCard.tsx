import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { RvIndicadorDre } from '@/lib/constants'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'

/** Tabelas de pesos dos indicadores DRE por setor (codigo PK + peso, mesmo formato). */
export type TabelaPesosDre = 'rv_gente_pesos_dre' | 'rv_financeiro_pesos_dre' | 'rv_frota_pesos_dre' | 'rv_seguranca_pesos_dre'

interface PesosDreCardProps {
  /** Tabela de pesos do setor (codigo PK + peso). */
  tabela: TabelaPesosDre
  indicadores: RvIndicadorDre[]
  subtitulo: string
}

/**
 * Card de cadastro dos pesos (%) dos indicadores de RV com origem no DRE —
 * peso único por indicador (vale pra todas as unidades), salvo no blur do
 * input. Compartilhado entre as abas de metas dos setores (Gente, Financeiro).
 */
export function PesosDreCard({ tabela, indicadores, subtitulo }: PesosDreCardProps) {
  const { toast } = useToast()
  const [pesos, setPesos] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.from(tabela).select('*').then(({ data, error }) => {
      if (error) return
      const m: Record<string, string> = {}
      for (const r of (data ?? []) as { codigo: string; peso: number }[]) {
        m[r.codigo] = r.peso.toLocaleString('pt-BR')
      }
      setPesos(m)
    })
  }, [tabela])

  async function salvarPeso(codigo: string) {
    const peso = parseNumeroPtBr(pesos[codigo] ?? '')
    const { error } = await supabase
      .from(tabela)
      .upsert({ codigo, peso }, { onConflict: 'codigo' })
    if (error) {
      toast({ title: 'Erro ao salvar peso', description: error.message, variant: 'destructive' })
      return
    }
    setPesos(prev => ({ ...prev, [codigo]: peso.toLocaleString('pt-BR') }))
  }

  return (
    <TableCard titulo="Peso dos indicadores do DRE" subtitulo={subtitulo} className="max-w-xl">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Indicador (DRE)</TableHead>
            <TableHead>Contas</TableHead>
            <TableHead className="w-32 text-center">Peso (%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {indicadores.map(ind => (
            <TableRow key={ind.id} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
              <TableCell className="text-sm font-medium">{ind.nome}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{ind.prefixos.join(' + ')}</TableCell>
              <TableCell className="text-center">
                <Input
                  value={pesos[ind.id] ?? ''}
                  onChange={e => setPesos(prev => ({ ...prev, [ind.id]: e.target.value }))}
                  onBlur={() => salvarPeso(ind.id)}
                  placeholder="0"
                  className="mx-auto h-8 w-20 text-center tabular-nums"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableCard>
  )
}
