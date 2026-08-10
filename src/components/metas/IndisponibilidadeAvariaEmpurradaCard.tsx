import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'

/**
 * Indicadores da RV de Empurrada com meta e peso únicos, em R$ — Indisponibilidade
 * (mesmo dado do Painel de Perdas que a Distribuição usa, meta própria de
 * Empurrada) e Avaria de Transporte (mesmo resultado do indicador Vales —
 * DRE contas 051/052 — mas com meta direta em R$, não % da Meta de Perdas
 * anual como Distribuição/Financeiro usam). Mesmo padrão do
 * DescontosFrotaMetaCard, na mesma caixa pra economizar espaço.
 */
const INDICADORES_EMPURRADA_RS = [
  { id: 'indisponibilidade', nome: 'Indisponibilidade', tabela: 'rv_empurrada_indisponibilidade_meta' },
  { id: 'avaria_transporte', nome: 'Avaria de Transporte', tabela: 'rv_empurrada_avaria_transporte_meta' },
] as const

export function IndisponibilidadeAvariaEmpurradaCard() {
  const { toast } = useToast()
  const [valores, setValores] = useState<Record<string, { meta: string; peso: string }>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => {
    Promise.all(INDICADORES_EMPURRADA_RS.map(ind => supabase.from(ind.tabela).select('*').maybeSingle())).then(resultados => {
      const v: Record<string, { meta: string; peso: string }> = {}
      resultados.forEach((res, i) => {
        if (res.error || !res.data) return
        const ind = INDICADORES_EMPURRADA_RS[i]
        const row = res.data as { meta_valor: number; peso: number }
        v[ind.id] = { meta: Number(row.meta_valor).toLocaleString('pt-BR'), peso: Number(row.peso).toLocaleString('pt-BR') }
      })
      setValores(v)
    })
  }, [])

  async function handleSalvar(indId: (typeof INDICADORES_EMPURRADA_RS)[number]['id']) {
    const ind = INDICADORES_EMPURRADA_RS.find(i => i.id === indId)!
    const atual = valores[indId] ?? { meta: '', peso: '' }
    setSalvando(indId)
    const { error } = await supabase
      .from(ind.tabela)
      .upsert({ id: true, meta_valor: parseNumeroPtBr(atual.meta), peso: parseNumeroPtBr(atual.peso) }, { onConflict: 'id' })
    setSalvando(null)
    if (error) {
      toast({ title: `Erro ao salvar meta de ${ind.nome}`, description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: `Meta de ${ind.nome} salva` })
  }

  return (
    <TableCard
      titulo="Indisponibilidade / Avaria de Transporte"
      subtitulo="Meta única (R$) e peso, cada um vale só pra Empurrada."
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
          {INDICADORES_EMPURRADA_RS.map(ind => (
            <TableRow key={ind.id} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
              <TableCell className="text-sm font-medium">{ind.nome}</TableCell>
              <TableCell className="text-center">
                <Input
                  value={valores[ind.id]?.meta ?? ''}
                  onChange={e => setValores(prev => ({ ...prev, [ind.id]: { meta: e.target.value, peso: prev[ind.id]?.peso ?? '' } }))}
                  onBlur={() => handleSalvar(ind.id)}
                  placeholder="Ex: 0,00"
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
