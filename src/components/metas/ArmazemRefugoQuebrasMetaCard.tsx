import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'

/**
 * Refugo e Quebras (Armazém T2) — meta e peso únicos, uma linha só, vale pra
 * todas as unidades (mesmo padrão do DescontosFrotaMetaCard). Refugo em %
 * (quanto menor melhor), Quebras em R$ (quanto menor melhor, resultado ainda
 * sem importação automática).
 */
const INDICADORES = [
  { id: 'refugo', nome: 'Refugo', tabela: 'rv_armazem_refugo_meta', campo: 'meta_pct', unidade: '%', placeholder: 'Ex: 2' },
  { id: 'quebras', nome: 'Quebras', tabela: 'rv_armazem_quebras_meta', campo: 'meta_valor', unidade: 'R$', placeholder: 'Ex: 1.500,00' },
] as const

export function ArmazemRefugoQuebrasMetaCard() {
  const { toast } = useToast()
  const [valores, setValores] = useState<Record<string, { meta: string; peso: string }>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => {
    Promise.all(INDICADORES.map(ind => supabase.from(ind.tabela).select('*').maybeSingle())).then(resultados => {
      const v: Record<string, { meta: string; peso: string }> = {}
      resultados.forEach((res, i) => {
        if (res.error || !res.data) return
        const ind = INDICADORES[i]
        const row = res.data as Record<string, number>
        v[ind.id] = { meta: Number(row[ind.campo]).toLocaleString('pt-BR'), peso: Number(row.peso).toLocaleString('pt-BR') }
      })
      setValores(v)
    })
  }, [])

  async function handleSalvar(indId: (typeof INDICADORES)[number]['id']) {
    const ind = INDICADORES.find(i => i.id === indId)!
    const atual = valores[indId] ?? { meta: '', peso: '' }
    setSalvando(indId)
    const { error } = await supabase
      .from(ind.tabela)
      .upsert({ id: true, [ind.campo]: parseNumeroPtBr(atual.meta), peso: parseNumeroPtBr(atual.peso) }, { onConflict: 'id' })
    setSalvando(null)
    if (error) {
      toast({ title: `Erro ao salvar meta do ${ind.nome}`, description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: `Meta do ${ind.nome} salva` })
  }

  return (
    <TableCard
      titulo="Refugo / Quebras"
      subtitulo="Meta única e peso, cada um vale pra todas as unidades — Refugo em %, Quebras em R$. Quanto menor melhor nos dois."
      className="max-w-md"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Indicador</TableHead>
            <TableHead className="w-32 text-center">Meta</TableHead>
            <TableHead className="w-28 text-center">Peso (%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {INDICADORES.map(ind => (
            <TableRow key={ind.id} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
              <TableCell className="text-sm font-medium">
                {ind.nome} <span className="text-xs text-muted-foreground">({ind.unidade})</span>
              </TableCell>
              <TableCell className="text-center">
                <Input
                  value={valores[ind.id]?.meta ?? ''}
                  onChange={e => setValores(prev => ({ ...prev, [ind.id]: { meta: e.target.value, peso: prev[ind.id]?.peso ?? '' } }))}
                  onBlur={() => handleSalvar(ind.id)}
                  placeholder={ind.placeholder}
                  className="mx-auto h-8 w-28 text-center tabular-nums"
                />
              </TableCell>
              <TableCell className="text-center">
                <Input
                  value={valores[ind.id]?.peso ?? ''}
                  onChange={e => setValores(prev => ({ ...prev, [ind.id]: { meta: prev[ind.id]?.meta ?? '', peso: e.target.value } }))}
                  onBlur={() => handleSalvar(ind.id)}
                  placeholder="Ex: 10"
                  className="mx-auto h-8 w-20 text-center tabular-nums"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {salvando && <p className="px-4 pb-3 text-xs text-muted-foreground">Salvando...</p>}
    </TableCard>
  )
}
