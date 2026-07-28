import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'
import type { PesoDistribuicaoFuncao } from '@/types'

const INDICADORES = [
  { id: 'indisponibilidade', nome: 'Indisponibilidade' },
  { id: 'pacote_gente', nome: 'Pacote de Gente' },
  { id: 'vales', nome: 'Vales' },
  { id: 'logon_du', nome: 'LogOn DU' },
  { id: 'devolucao', nome: 'Devolução' },
  { id: 'presenteismo_du', nome: 'Presenteísmo DU' },
] as const satisfies readonly { id: PesoDistribuicaoFuncao['indicador']; nome: string }[]

interface PesosDistribuicaoFuncaoCardProps {
  funcao: PesoDistribuicaoFuncao['funcao']
}

/**
 * Peso (%) de cada indicador da RV de Distribuição pra uma função —
 * COORD. DU não tem Vales, SUPERVISOR DU não tem LogOn DU nem Pacote de
 * Gente. A meta de cada indicador continua única e compartilhada entre as
 * funções (cadastrada nos cards de cada indicador) — aqui só o peso, que é
 * a única coisa que muda entre COORD. DU e SUPERVISOR DU.
 */
export function PesosDistribuicaoFuncaoCard({ funcao }: PesosDistribuicaoFuncaoCardProps) {
  const { toast } = useToast()
  const [pesos, setPesos] = useState<Record<string, string>>({})

  const indicadores = INDICADORES.filter(ind => {
    if (ind.id === 'logon_du') return funcao === 'COORD. DU'
    if (ind.id === 'pacote_gente') return funcao === 'COORD. DU'
    if (ind.id === 'vales') return funcao === 'SUPERVISOR DU'
    return true
  })

  useEffect(() => {
    supabase.from('rv_distribuicao_peso_funcao').select('*').eq('funcao', funcao).then(({ data, error }) => {
      if (error) return
      const p: Record<string, string> = {}
      for (const r of (data ?? []) as PesoDistribuicaoFuncao[]) {
        p[r.indicador] = Number(r.peso).toLocaleString('pt-BR')
      }
      setPesos(p)
    })
  }, [funcao])

  async function salvarPeso(indicador: PesoDistribuicaoFuncao['indicador']) {
    const peso = parseNumeroPtBr(pesos[indicador] ?? '')
    const { error } = await supabase
      .from('rv_distribuicao_peso_funcao')
      .upsert({ funcao, indicador, peso }, { onConflict: 'funcao,indicador' })
    if (error) {
      toast({ title: 'Erro ao salvar peso', description: error.message, variant: 'destructive' })
      return
    }
    setPesos(prev => ({ ...prev, [indicador]: peso.toLocaleString('pt-BR') }))
  }

  return (
    <TableCard
      titulo={`Pesos — ${funcao}`}
      subtitulo="Peso (%) de cada indicador pra essa função — a meta continua a mesma pras duas funções."
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
          {indicadores.map(ind => (
            <TableRow key={ind.id} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
              <TableCell className="text-sm font-medium">{ind.nome}</TableCell>
              <TableCell className="text-center">
                <Input
                  value={pesos[ind.id] ?? ''}
                  onChange={e => setPesos(prev => ({ ...prev, [ind.id]: e.target.value }))}
                  onBlur={() => salvarPeso(ind.id)}
                  placeholder="Ex: 10"
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
