import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'

/**
 * Peso dos indicadores do Armazém T1 (Estância/CDR Bahia) que têm meta
 * mensal por unidade — TMA, Disponibilidade de Gente e Presenteísmo AL —
 * cada um numa tabela singleton própria, cadastrados juntos aqui pra
 * economizar espaço. Cadastro totalmente separado do T2 (ver
 * PesosArmazemT2Card). Quebras tem meta única, então o peso já vem junto na
 * própria meta (ver ArmazemT1QuebrasMetaCard).
 */
const INDICADORES_PESO = [
  { id: 'tma', nome: 'TMA', tabela: 'rv_armazem_t1_tma_peso' },
  { id: 'disponibilidade_gente', nome: 'Disponibilidade de Gente', tabela: 'rv_armazem_t1_disponibilidade_gente_peso' },
  { id: 'presenteismo_al', nome: 'Presenteísmo AL', tabela: 'rv_armazem_t1_presenteismo_al_peso' },
] as const

export function PesosArmazemT1Card() {
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
      titulo="Pesos — TMA / Disponibilidade de Gente / Presenteísmo AL (T1)"
      subtitulo="Peso (%) único de cada indicador, vale pra Estância e CDR Bahia — a meta de cada um é cadastrada no card próprio."
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
