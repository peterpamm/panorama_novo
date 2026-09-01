import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard, tableCardActionClass } from '@/components/ui/table-card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatarMinutosComoDuracao } from '@/lib/duracao'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface RegistroMetaMensal {
  unidade: string
  ano: number
  mes: number
  valor: number
}

interface ArmazemT1MetaMensalCardProps {
  tabela: 'metas_armazem_t1_tma' | 'metas_armazem_t1_disponibilidade_gente' | 'metas_armazem_t1_presenteismo_al'
  titulo: string
  /** 'duracao' mostra "HH:MM" (TMA); 'pct' mostra "X%" (Disponibilidade de Gente, Presenteísmo AL). */
  formato: 'duracao' | 'pct'
}

/**
 * Meta mensal já cadastrada (importada em RV de Armazém &gt; Importação) de um
 * indicador do T1 (Estância/CDR Bahia) que muda todo mês — TMA,
 * Disponibilidade de Gente ou Presenteísmo AL. Só a visualização; o peso é
 * único (ver PesosArmazemT1Card).
 */
export function ArmazemT1MetaMensalCard({ tabela, titulo, formato }: ArmazemT1MetaMensalCardProps) {
  const { unidades } = useUnidades()

  const [registros, setRegistros] = useState<RegistroMetaMensal[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const { data, error } = await supabase.from(tabela).select('*')
      if (!error) setRegistros((data as RegistroMetaMensal[]) ?? [])
      setCarregando(false)
    }
    carregar()
  }, [tabela])

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
      titulo={titulo}
      subtitulo={carregando
        ? 'Carregando...'
        : `${verAno} · ${formato === 'duracao' ? 'duração (HH:MM) por mês' : '% por mês'} · importada em RV de Armazém > Importação`}
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
          Nenhuma meta importada ainda — importe em RV de Armazém &gt; Importação.
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
                    {v === null ? '—' : formato === 'duracao' ? formatarMinutosComoDuracao(v) : `${v.toLocaleString('pt-BR')}%`}
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
