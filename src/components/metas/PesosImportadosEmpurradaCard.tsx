import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'

const INDICADORES = [
  { tabela: 'rv_empurrada_gty_meta', rotulo: 'GTY' },
  { tabela: 'rv_empurrada_tmv_meta', rotulo: 'TMV' },
  { tabela: 'rv_empurrada_rendicao_meta', rotulo: 'Tempo de Rendição' },
] as const

/**
 * Peso (%) de GTY/TMV/Tempo de Rendição — só a RV de Empurrada usa. Sem
 * meta própria aqui: resultado/meta já vêm importados na Reunião Resultados
 * (setor Distribuição, nomes T1), essa tela só define quanto cada um pesa
 * na apuração da Empurrada.
 */
export function PesosImportadosEmpurradaCard() {
  const { toast } = useToast()
  const [pesos, setPesos] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => {
    Promise.all(INDICADORES.map(ind => supabase.from(ind.tabela).select('*').maybeSingle())).then(resultados => {
      const novos: Record<string, string> = {}
      resultados.forEach((r, i) => {
        if (r.data) novos[INDICADORES[i].tabela] = Number((r.data as { peso: number }).peso).toLocaleString('pt-BR')
      })
      setPesos(novos)
    })
  }, [])

  async function handleSalvar(tabela: string) {
    setSalvando(tabela)
    const { error } = await supabase.from(tabela).upsert({ id: true, peso: parseNumeroPtBr(pesos[tabela] ?? '') }, { onConflict: 'id' })
    setSalvando(null)
    if (error) {
      toast({ title: 'Erro ao salvar peso', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Peso salvo' })
  }

  return (
    <TableCard titulo="GTY / TMV / Tempo de Rendição" subtitulo="Só o peso — resultado e meta já vêm importados na Reunião Resultados." className="max-w-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Indicador</TableHead>
            <TableHead className="w-28 text-center">Peso (%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {INDICADORES.map(ind => (
            <TableRow key={ind.tabela} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
              <TableCell className="text-sm font-medium">{ind.rotulo}</TableCell>
              <TableCell className="text-center">
                <Input
                  value={pesos[ind.tabela] ?? ''}
                  onChange={e => setPesos(p => ({ ...p, [ind.tabela]: e.target.value }))}
                  onBlur={() => handleSalvar(ind.tabela)}
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
