import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard, tableCardActionClass } from '@/components/ui/table-card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { MetaPresenteismoDu } from '@/types'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/**
 * Meta mensal (%) do Presenteísmo DU já cadastrada — importada em
 * RV de Distribuição &gt; Importação (mesmo formato de arquivo do Presenteísmo
 * geral de Metas de Gente), aqui só a visualização. O peso é por função
 * (COORD. DU / SUPERVISOR DU, ver PesosDistribuicaoFuncaoCard). Quanto menor
 * melhor.
 */
export function PresenteismoDuMetaCard() {
  const { unidades } = useUnidades()

  const [registros, setRegistros] = useState<MetaPresenteismoDu[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const { data, error } = await supabase.from('metas_presenteismo_du').select('*')
      if (!error) setRegistros((data as MetaPresenteismoDu[]) ?? [])
      setCarregando(false)
    }
    carregar()
  }, [])

  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])
  const anosDisponiveis = useMemo(
    () => Array.from(new Set(registros.map(r => r.ano))).sort((a, b) => b - a),
    [registros],
  )
  const [verAno, setVerAno] = useState('')
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(verAno))) setVerAno(String(anosDisponiveis[0]))
  }, [anosDisponiveis, verAno])

  const linhasVisualizacao = useMemo(() => {
    const anoNum = Number(verAno)
    const codigos = Array.from(new Set(registros.filter(r => r.ano === anoNum).map(r => r.unidade)))
    return codigos
      .map(codigo => ({
        unidade: codigo,
        nome: nomesUnidades.get(codigo) ?? codigo,
        meses: Array.from({ length: 12 }, (_, i) => {
          const mes = i + 1
          return registros.find(r => r.unidade === codigo && r.ano === anoNum && r.mes === mes)?.valor ?? null
        }),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [registros, verAno, nomesUnidades])

  return (
    <TableCard
      titulo="Presenteísmo DU"
      subtitulo={carregando
        ? 'Carregando...'
        : `${verAno} · % por mês, quanto menor melhor · importada em RV de Distribuição > Importação`}
      acoes={
        <Select value={verAno} onValueChange={setVerAno}>
          <SelectTrigger className={cn('h-8 w-20 text-xs', tableCardActionClass)}><SelectValue /></SelectTrigger>
          <SelectContent>
            {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      }
    >
      {carregando ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : linhasVisualizacao.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma meta importada ainda — importe em RV de Distribuição &gt; Importação.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              {MESES_ABREV.map(m => (
                <TableHead key={m} className="text-center">{m}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhasVisualizacao.map(l => (
              <TableRow key={l.unidade} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                <TableCell className="py-1.5 text-sm font-medium">{l.nome}</TableCell>
                {l.meses.map((v, i) => (
                  <TableCell key={i} className="py-1.5 text-center text-xs tabular-nums text-muted-foreground">
                    {v === null ? '—' : `${v.toLocaleString('pt-BR')}%`}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TableCard>
  )
}
