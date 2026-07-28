import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'

/**
 * Peso dos indicadores do Armazém T2 que têm meta por unidade (EFC, TMA) ou
 * por unidade/mês (Presenteísmo AL) — cada um numa tabela singleton própria,
 * cadastrados juntos aqui pra economizar espaço (mesmo padrão do
 * IndicadoresMetaUnicaCard). Refugo e Quebras têm meta única, então o peso
 * deles já vem junto na própria meta (ver ArmazemRefugoQuebrasMetaCard).
 */
const INDICADORES_PESO = [
  { id: 'efc', nome: 'EFC', tabela: 'rv_armazem_efc_peso' },
  { id: 'tma', nome: 'TMA', tabela: 'rv_armazem_tma_peso' },
  { id: 'presenteismo_al', nome: 'Presenteísmo AL', tabela: 'rv_armazem_presenteismo_al_peso' },
] as const

export function PesosArmazemT2Card() {
  const { toast } = useToast()
  const [pesos, setPesos] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => {
    Promise.all(INDICADORES_PESO.map(ind => supabase.from(ind.tabela).select('*').maybeSingle())).then(resultados => {
      const p: Record<string, string> = {}
      resultados.forEach((res, i) => {
        if (res.error || !res.data) return
        const ind = INDICADORES_PESO[i]
        p[ind.id] = Number((res.data as { peso: number }).peso).toLocaleString('pt-BR')
      })
      setPesos(p)
    })
  }, [])

  async function handleSalvar(indId: (typeof INDICADORES_PESO)[number]['id']) {
    const ind = INDICADORES_PESO.find(i => i.id === indId)!
    setSalvando(indId)
    const { error } = await supabase
      .from(ind.tabela)
      .upsert({ id: true, peso: parseNumeroPtBr(pesos[indId] ?? '') }, { onConflict: 'id' })
    setSalvando(null)
    if (error) {
      toast({ title: `Erro ao salvar peso do ${ind.nome}`, description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: `Peso do ${ind.nome} salvo` })
  }

  return (
    <TableCard
      titulo="Pesos — EFC / TMA / Presenteísmo AL"
      subtitulo="Peso (%) único de cada indicador, vale pra todas as unidades — a meta de cada um é cadastrada no card próprio."
      className="max-w-md"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Indicador</TableHead>
            <TableHead className="w-28 text-center">Peso (%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {INDICADORES_PESO.map(ind => (
            <TableRow key={ind.id} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
              <TableCell className="text-sm font-medium">{ind.nome}</TableCell>
              <TableCell className="text-center">
                <Input
                  value={pesos[ind.id] ?? ''}
                  onChange={e => setPesos(prev => ({ ...prev, [ind.id]: e.target.value }))}
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
