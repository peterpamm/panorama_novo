import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'

/**
 * Metas de resultado do Financeiro — indicadores que não são peso de RV, só
 * uma meta cadastrada pra comparação (ex: % de aderência das Rotinas
 * Financeiras, usado no Dashboard de Rotinas). `campo` é o nome da coluna de
 * meta na tabela (hoje só meta_pct — abre espaço pra outros formatos no
 * futuro, mesmo padrão do IndicadoresMetaUnicaCard da Segurança).
 */
const INDICADORES_RESULTADO_FINANCEIRO = [
  { id: 'rotinas_financeiras', nome: 'Rotinas Financeiras (% de aderência)', tabela: 'meta_rotinas_financeiras', campo: 'meta_pct' },
] as const

export function MetasResultadoTab() {
  const { toast } = useToast()
  const [valores, setValores] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => {
    Promise.all(INDICADORES_RESULTADO_FINANCEIRO.map(ind => supabase.from(ind.tabela).select('*').maybeSingle())).then(resultados => {
      const v: Record<string, string> = {}
      resultados.forEach((res, i) => {
        if (res.error || !res.data) return
        const ind = INDICADORES_RESULTADO_FINANCEIRO[i]
        const row = res.data as Record<string, number>
        v[ind.id] = Number(row[ind.campo]).toLocaleString('pt-BR')
      })
      setValores(v)
    })
  }, [])

  async function handleSalvar(indId: (typeof INDICADORES_RESULTADO_FINANCEIRO)[number]['id']) {
    const ind = INDICADORES_RESULTADO_FINANCEIRO.find(i => i.id === indId)!
    setSalvando(indId)
    const { error } = await supabase
      .from(ind.tabela)
      .upsert({ id: true, [ind.campo]: parseNumeroPtBr(valores[indId] ?? '') }, { onConflict: 'id' })
    setSalvando(null)
    if (error) {
      toast({ title: `Erro ao salvar meta de ${ind.nome}`, description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: `Meta de ${ind.nome} salva` })
  }

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Metas de resultado do Financeiro — não são peso de RV, só o valor usado pra comparação (ex: verde/vermelho no
        Dashboard de Rotinas). Novos indicadores de resultado entram aqui conforme forem definidos.
      </p>

      <TableCard titulo="Metas de Resultado" subtitulo="Meta única por indicador, vale pra todas as unidades." className="max-w-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Indicador</TableHead>
              <TableHead className="w-28 text-center">Meta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {INDICADORES_RESULTADO_FINANCEIRO.map(ind => (
              <TableRow key={ind.id} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                <TableCell className="text-sm font-medium">{ind.nome}</TableCell>
                <TableCell className="text-center">
                  <Input
                    value={valores[ind.id] ?? ''}
                    onChange={e => setValores(prev => ({ ...prev, [ind.id]: e.target.value }))}
                    onBlur={() => handleSalvar(ind.id)}
                    placeholder="Ex: 90"
                    className="mx-auto h-8 w-20 text-center tabular-nums"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {salvando && <p className="px-4 pb-3 text-xs text-muted-foreground">Salvando...</p>}
      </TableCard>
    </div>
  )
}
