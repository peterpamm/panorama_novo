import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { OPERACOES_DTO_T1 } from '@/lib/dto-t1-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'
import type { DtoT1Meta } from '@/types'

/**
 * Cadastro da meta (%) e peso do indicador DTO T1 — uma linha por unidade,
 * só ESTÂNCIA e CDR BAHIA (as únicas que se enquadram nesse indicador),
 * resolvidas dinamicamente via apelidos cadastrados na Administração.
 */
export function DtoT1MetaCard() {
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const [metas, setMetas] = useState<Record<string, { metaPct: string; peso: string }>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  const unidadesAlvo = useMemo(
    () => OPERACOES_DTO_T1
      .map(op => resolverUnidade(op, unidades))
      .filter((u, i, arr): u is NonNullable<typeof u> => u !== undefined && arr.findIndex(x => x?.codigo === u.codigo) === i),
    [unidades],
  )

  useEffect(() => {
    supabase.from('rv_dto_t1_meta').select('*').then(({ data, error }) => {
      if (error || !data) return
      const m: Record<string, { metaPct: string; peso: string }> = {}
      for (const r of data as DtoT1Meta[]) {
        m[r.unidade] = { metaPct: r.meta_pct.toLocaleString('pt-BR'), peso: r.peso.toLocaleString('pt-BR') }
      }
      setMetas(m)
    })
  }, [])

  async function handleSalvar(unidadeCodigo: string) {
    const atual = metas[unidadeCodigo] ?? { metaPct: '', peso: '' }
    setSalvando(unidadeCodigo)
    const { error } = await supabase
      .from('rv_dto_t1_meta')
      .upsert({ unidade: unidadeCodigo, meta_pct: parseNumeroPtBr(atual.metaPct), peso: parseNumeroPtBr(atual.peso) }, { onConflict: 'unidade' })
    setSalvando(null)
    if (error) {
      toast({ title: 'Erro ao salvar meta do DTO T1', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Meta do DTO T1 salva' })
  }

  return (
    <TableCard
      titulo="DTO T1"
      subtitulo="Meta (%) e peso por unidade — só ESTÂNCIA e CDR BAHIA se enquadram — quanto maior o % dentro do prazo melhor."
      className="max-w-md"
    >
      {unidadesAlvo.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma unidade ESTÂNCIA/CDR BAHIA reconhecida — cadastre o apelido na Administração se o nome da unidade for diferente.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead className="w-28 text-center">Meta (%)</TableHead>
              <TableHead className="w-28 text-center">Peso (%)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unidadesAlvo.map(u => (
              <TableRow key={u.codigo} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                <TableCell className="text-sm font-medium">{u.nome}</TableCell>
                <TableCell className="text-center">
                  <Input
                    value={metas[u.codigo]?.metaPct ?? ''}
                    onChange={e => setMetas(prev => ({ ...prev, [u.codigo]: { metaPct: e.target.value, peso: prev[u.codigo]?.peso ?? '' } }))}
                    onBlur={() => handleSalvar(u.codigo)}
                    placeholder="Ex: 90"
                    className="mx-auto h-8 w-20 text-center tabular-nums"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Input
                    value={metas[u.codigo]?.peso ?? ''}
                    onChange={e => setMetas(prev => ({ ...prev, [u.codigo]: { metaPct: prev[u.codigo]?.metaPct ?? '', peso: e.target.value } }))}
                    onBlur={() => handleSalvar(u.codigo)}
                    placeholder="Ex: 10"
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
