import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { OPERACOES_DTO_T1 } from '@/lib/dto-t1-parser'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { cn, parseNumeroPtBr } from '@/lib/utils'
import type { ExcessoVelocidadeMeta, FaiMeta } from '@/types'

type Tabela = 'rv_excesso_velocidade_meta' | 'rv_fai_meta'

interface LinhaMeta {
  key: string
  indicadorNome: string
  tabela: Tabela
  unidadeCodigo: string
  unidadeNome: string
}

/**
 * Cadastro da meta (máximo de ocorrências) e peso do Excesso de Velocidade e
 * do FAI — os dois ficam na mesma caixa porque as duas metas são de
 * quantidade (não %) e são complementares: Excesso de Velocidade vale pra
 * todas as unidades menos ESTÂNCIA e Camaçari ARM; o FAI é o indicador que
 * compensa justamente essas duas. Quanto menor a contagem melhor, nos dois.
 */
export function ExcessoVelocidadeFaiMetaCard() {
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const [valores, setValores] = useState<Record<string, { metaMax: string; peso: string }>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  const linhas = useMemo<LinhaMeta[]>(() => {
    const estanciaCodigo = resolverUnidade('ESTÂNCIA', unidades)?.codigo

    const excessoRows: LinhaMeta[] = unidades
      .filter(u => u.codigo !== estanciaCodigo)
      .map(u => ({ key: `excesso_velocidade|${u.codigo}`, indicadorNome: 'Excesso de Velocidade', tabela: 'rv_excesso_velocidade_meta', unidadeCodigo: u.codigo, unidadeNome: u.nome }))

    const faiUnidades = OPERACOES_DTO_T1
      .map(op => resolverUnidade(op, unidades))
      .filter((u, i, arr): u is NonNullable<typeof u> => u !== undefined && arr.findIndex(x => x?.codigo === u.codigo) === i)
    const faiRows: LinhaMeta[] = faiUnidades
      .map(u => ({ key: `fai|${u.codigo}`, indicadorNome: 'FAI', tabela: 'rv_fai_meta', unidadeCodigo: u.codigo, unidadeNome: u.nome }))

    return [...excessoRows, ...faiRows].sort((a, b) => a.unidadeNome.localeCompare(b.unidadeNome) || a.indicadorNome.localeCompare(b.indicadorNome))
  }, [unidades])

  useEffect(() => {
    Promise.all([
      supabase.from('rv_excesso_velocidade_meta').select('*'),
      supabase.from('rv_fai_meta').select('*'),
    ]).then(([rExcesso, rFai]) => {
      const v: Record<string, { metaMax: string; peso: string }> = {}
      for (const r of (rExcesso.data as ExcessoVelocidadeMeta[]) ?? []) {
        v[`excesso_velocidade|${r.unidade}`] = { metaMax: r.meta_max.toLocaleString('pt-BR'), peso: r.peso.toLocaleString('pt-BR') }
      }
      for (const r of (rFai.data as FaiMeta[]) ?? []) {
        v[`fai|${r.unidade}`] = { metaMax: r.meta_max.toLocaleString('pt-BR'), peso: r.peso.toLocaleString('pt-BR') }
      }
      setValores(v)
    })
  }, [])

  async function handleSalvar(linha: LinhaMeta) {
    const atual = valores[linha.key] ?? { metaMax: '', peso: '' }
    setSalvando(linha.key)
    const { error } = await supabase
      .from(linha.tabela)
      .upsert({ unidade: linha.unidadeCodigo, meta_max: parseNumeroPtBr(atual.metaMax), peso: parseNumeroPtBr(atual.peso) }, { onConflict: 'unidade' })
    setSalvando(null)
    if (error) {
      toast({ title: `Erro ao salvar meta do ${linha.indicadorNome}`, description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: `Meta do ${linha.indicadorNome} salva` })
  }

  return (
    <TableCard
      titulo="Excesso de Velocidade / FAI"
      subtitulo="Máximo de ocorrências (nº) e peso por unidade — quanto menor a contagem melhor, nos dois."
      className="max-w-lg"
    >
      {linhas.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma unidade cadastrada ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead>Indicador</TableHead>
              <TableHead className="w-28 text-center">Máximo</TableHead>
              <TableHead className="w-28 text-center">Peso (%)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(l => (
              <TableRow key={l.key} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                <TableCell className="text-sm font-medium">{l.unidadeNome}</TableCell>
                <TableCell className={cn(
                  'text-xs',
                  l.indicadorNome === 'FAI' ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-muted-foreground',
                )}>
                  {l.indicadorNome}
                </TableCell>
                <TableCell className="text-center">
                  <Input
                    value={valores[l.key]?.metaMax ?? ''}
                    onChange={e => setValores(prev => ({ ...prev, [l.key]: { metaMax: e.target.value, peso: prev[l.key]?.peso ?? '' } }))}
                    onBlur={() => handleSalvar(l)}
                    placeholder="Ex: 5"
                    className="mx-auto h-8 w-20 text-center tabular-nums"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Input
                    value={valores[l.key]?.peso ?? ''}
                    onChange={e => setValores(prev => ({ ...prev, [l.key]: { metaMax: prev[l.key]?.metaMax ?? '', peso: e.target.value } }))}
                    onBlur={() => handleSalvar(l)}
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
