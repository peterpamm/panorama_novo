import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'
import { parseDuracaoParaMinutos, formatarMinutosComoDuracao } from '@/lib/duracao'

interface ArmazemMetaPorUnidadeCardProps {
  /** Tabela com uma linha por unidade (unidade PK) — sem coluna de peso, que fica numa tabela singleton à parte. */
  tabela: 'rv_armazem_efc_meta' | 'rv_armazem_tma_meta'
  /** Nome da coluna de meta nessa tabela (meta_pct pro EFC, meta_minutos pro TMA). */
  coluna: 'meta_pct' | 'meta_minutos'
  titulo: string
  subtitulo: string
  colunaHead: string
  placeholder: string
  /** 'duracao' aceita e mostra "HH:MM" (convertido pra minutos por baixo dos panos, igual ao resultado importado do TMA); default 'numero'. */
  formato?: 'numero' | 'duracao'
}

/**
 * Meta por unidade (vale o ano todo, sem quebra por mês) dos indicadores do
 * Armazém T2 que variam por unidade — EFC e TMA. O peso é único e fica numa
 * tabela à parte (ver PesosArmazemT2Card), igual ao padrão da Devolução da
 * Distribuição.
 */
export function ArmazemMetaPorUnidadeCard({ tabela, coluna, titulo, subtitulo, colunaHead, placeholder, formato = 'numero' }: ArmazemMetaPorUnidadeCardProps) {
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const [metas, setMetas] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => {
    supabase.from(tabela).select('*').then(({ data, error }) => {
      if (error || !data) return
      const m: Record<string, string> = {}
      for (const r of data as Record<string, unknown>[]) {
        const valor = Number(r[coluna])
        m[r.unidade as string] = formato === 'duracao' ? formatarMinutosComoDuracao(valor) : valor.toLocaleString('pt-BR')
      }
      setMetas(m)
    })
  }, [tabela, coluna, formato])

  async function handleSalvar(unidadeCodigo: string) {
    const raw = metas[unidadeCodigo] ?? ''
    const valorNumerico = formato === 'duracao' ? (parseDuracaoParaMinutos(raw) ?? 0) : parseNumeroPtBr(raw)
    setSalvando(unidadeCodigo)
    const { error } = await supabase
      .from(tabela)
      .upsert({ unidade: unidadeCodigo, [coluna]: valorNumerico }, { onConflict: 'unidade' })
    setSalvando(null)
    if (error) {
      toast({ title: `Erro ao salvar meta de ${titulo}`, description: error.message, variant: 'destructive' })
      return
    }
    if (formato === 'duracao') setMetas(prev => ({ ...prev, [unidadeCodigo]: formatarMinutosComoDuracao(valorNumerico) }))
    toast({ title: `Meta de ${titulo} salva` })
  }

  return (
    <TableCard titulo={titulo} subtitulo={subtitulo} className="max-w-md">
      {unidades.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma unidade cadastrada ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead className="w-28 text-center">{colunaHead}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unidades.map(u => (
              <TableRow key={u.codigo} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                <TableCell className="text-sm font-medium">{u.nome}</TableCell>
                <TableCell className="text-center">
                  <Input
                    value={metas[u.codigo] ?? ''}
                    onChange={e => setMetas(prev => ({ ...prev, [u.codigo]: e.target.value }))}
                    onBlur={() => handleSalvar(u.codigo)}
                    placeholder={placeholder}
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
