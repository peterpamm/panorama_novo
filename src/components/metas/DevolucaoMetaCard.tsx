import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'
import type { MetaDevolucao } from '@/types'

/**
 * Cadastro da meta (%) do indicador Devolução, uma linha por unidade — o
 * peso é por função (COORD. DU / SUPERVISOR DU, ver
 * PesosDistribuicaoFuncaoCard). Quanto menor melhor (devolução é perda).
 */
export function DevolucaoMetaCard() {
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const [metas, setMetas] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('rv_devolucao_meta').select('*').then(({ data, error }) => {
      if (error || !data) return
      const m: Record<string, string> = {}
      for (const r of data as MetaDevolucao[]) {
        m[r.unidade] = r.meta_pct.toLocaleString('pt-BR')
      }
      setMetas(m)
    })
  }, [])

  async function handleSalvar(unidadeCodigo: string) {
    const raw = metas[unidadeCodigo] ?? ''
    setSalvando(unidadeCodigo)
    const { error } = await supabase
      .from('rv_devolucao_meta')
      .upsert({ unidade: unidadeCodigo, meta_pct: parseNumeroPtBr(raw) }, { onConflict: 'unidade' })
    setSalvando(null)
    if (error) {
      toast({ title: 'Erro ao salvar meta de Devolução', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Meta de Devolução salva' })
  }

  return (
    <TableCard
      titulo="Devolução — meta por unidade"
      subtitulo="Meta (%) de cada unidade, quanto menor melhor. O peso é por função (cadastro de peso da aba)."
      className="max-w-md"
    >
      {unidades.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma unidade cadastrada ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead className="w-28 text-center">Meta (%)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unidades.map(u => (
              <TableRow key={u.codigo} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                <TableCell className="text-sm font-medium">{u.nome}</TableCell>
                <TableCell className="text-center">
                  <Input
                    value={metas[u.codigo] ?? ''}
                    onChange={e => setMetas(prev => ({ ...prev, [u.codigo]: e.target.value }))}
                    onBlur={() => handleSalvar(u.codigo)}
                    placeholder="Ex: 3"
                    className="mx-auto h-8 w-20 text-center tabular-nums"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {salvando && <p className="px-4 pb-3 text-xs text-muted-foreground">Salvando...</p>}
    </TableCard>
  )
}
