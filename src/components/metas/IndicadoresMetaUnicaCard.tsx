import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'

/**
 * Indicadores de segurança que têm meta e peso únicos (uma linha só, vale
 * pra todas as unidades) — cada um na sua própria tabela, mas cadastrados
 * juntos aqui numa tabela só pra economizar espaço na tela (em vez de um
 * quadrado por indicador). `campo` é o nome da coluna de meta na tabela
 * (meta_pct pros indicadores de %, meta_max pros de quantidade máxima).
 */
const INDICADORES_META_UNICA = [
  { id: 'dto_t2', nome: 'DTO T2', tabela: 'rv_dto_t2_meta', campo: 'meta_pct' },
  { id: 'gsd', nome: 'GSD', tabela: 'rv_gsd_meta', campo: 'meta_pct' },
  { id: 'logon', nome: 'LogOn', tabela: 'rv_logon_meta', campo: 'meta_pct' },
  { id: 'tri', nome: 'TRI', tabela: 'rv_tri_meta', campo: 'meta_max' },
] as const

/** Cadastro único da meta e do peso dos indicadores DTO T2, GSD, LogOn (% — quanto maior melhor) e TRI (quantidade máxima — quanto menor melhor). */
export function IndicadoresMetaUnicaCard() {
  const { toast } = useToast()
  const [valores, setValores] = useState<Record<string, { meta: string; peso: string }>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => {
    Promise.all(INDICADORES_META_UNICA.map(ind => supabase.from(ind.tabela).select('*').maybeSingle())).then(resultados => {
      const m: Record<string, { meta: string; peso: string }> = {}
      resultados.forEach((res, i) => {
        if (res.error || !res.data) return
        const ind = INDICADORES_META_UNICA[i]
        const row = res.data as Record<string, number>
        m[ind.id] = { meta: Number(row[ind.campo]).toLocaleString('pt-BR'), peso: Number(row.peso).toLocaleString('pt-BR') }
      })
      setValores(m)
    })
  }, [])

  async function handleSalvar(indId: (typeof INDICADORES_META_UNICA)[number]['id']) {
    const ind = INDICADORES_META_UNICA.find(i => i.id === indId)!
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
      titulo="DTO T2 / GSD / LogOn / TRI"
      subtitulo="Meta única e peso, cada um vale pra todas as unidades — DTO T2/GSD/LogOn em %, quanto maior melhor; TRI em quantidade máxima, quanto menor melhor."
      className="max-w-md"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Indicador</TableHead>
            <TableHead className="w-28 text-center">Meta</TableHead>
            <TableHead className="w-28 text-center">Peso (%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {INDICADORES_META_UNICA.map(ind => (
            <TableRow key={ind.id} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
              <TableCell className="text-sm font-medium">{ind.nome}</TableCell>
              <TableCell className="text-center">
                <Input
                  value={valores[ind.id]?.meta ?? ''}
                  onChange={e => setValores(prev => ({ ...prev, [ind.id]: { meta: e.target.value, peso: prev[ind.id]?.peso ?? '' } }))}
                  onBlur={() => handleSalvar(ind.id)}
                  placeholder={ind.campo === 'meta_max' ? 'Ex: 0' : 'Ex: 90'}
                  className="mx-auto h-8 w-20 text-center tabular-nums"
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
