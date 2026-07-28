import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'

/**
 * Indicadores de frota com meta e peso únicos, em valor R$ (não vêm do DRE,
 * cadastro manual) — Desconto CIVF e Desconto Stress Test, na mesma caixa
 * pra economizar espaço (mesmo padrão do IndicadoresMetaUnicaCard da
 * Segurança, mas com o campo de meta em R$).
 */
const INDICADORES_DESCONTO_FROTA = [
  { id: 'desconto_civf', nome: 'Desconto CIVF', tabela: 'rv_desconto_civf_meta' },
  { id: 'desconto_stress_test', nome: 'Desconto Stress Test', tabela: 'rv_desconto_stress_test_meta' },
] as const

export function DescontosFrotaMetaCard() {
  const { toast } = useToast()
  const [valores, setValores] = useState<Record<string, { meta: string; peso: string }>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => {
    Promise.all(INDICADORES_DESCONTO_FROTA.map(ind => supabase.from(ind.tabela).select('*').maybeSingle())).then(resultados => {
      const v: Record<string, { meta: string; peso: string }> = {}
      resultados.forEach((res, i) => {
        if (res.error || !res.data) return
        const ind = INDICADORES_DESCONTO_FROTA[i]
        const row = res.data as { meta_valor: number; peso: number }
        v[ind.id] = { meta: Number(row.meta_valor).toLocaleString('pt-BR'), peso: Number(row.peso).toLocaleString('pt-BR') }
      })
      setValores(v)
    })
  }, [])

  async function handleSalvar(indId: (typeof INDICADORES_DESCONTO_FROTA)[number]['id']) {
    const ind = INDICADORES_DESCONTO_FROTA.find(i => i.id === indId)!
    const atual = valores[indId] ?? { meta: '', peso: '' }
    setSalvando(indId)
    const { error } = await supabase
      .from(ind.tabela)
      .upsert({ id: true, meta_valor: parseNumeroPtBr(atual.meta), peso: parseNumeroPtBr(atual.peso) }, { onConflict: 'id' })
    setSalvando(null)
    if (error) {
      toast({ title: `Erro ao salvar meta do ${ind.nome}`, description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: `Meta do ${ind.nome} salva` })
  }

  return (
    <TableCard
      titulo="Desconto CIVF / Desconto Stress Test"
      subtitulo="Meta única (R$) e peso, cada um vale pra todas as unidades."
      className="max-w-md"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Indicador</TableHead>
            <TableHead className="w-32 text-center">Valor (R$)</TableHead>
            <TableHead className="w-28 text-center">Peso (%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {INDICADORES_DESCONTO_FROTA.map(ind => (
            <TableRow key={ind.id} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
              <TableCell className="text-sm font-medium">{ind.nome}</TableCell>
              <TableCell className="text-center">
                <Input
                  value={valores[ind.id]?.meta ?? ''}
                  onChange={e => setValores(prev => ({ ...prev, [ind.id]: { meta: e.target.value, peso: prev[ind.id]?.peso ?? '' } }))}
                  onBlur={() => handleSalvar(ind.id)}
                  placeholder="Ex: 1.500,00"
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
