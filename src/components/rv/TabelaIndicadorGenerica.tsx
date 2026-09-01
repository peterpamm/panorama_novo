import { Loader2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { cn } from '@/lib/utils'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export interface CelulaIndicador {
  texto: string
  tooltip: string
  /** null = sem meta cadastrada (célula não colore, mas mostra o valor). */
  bateu: boolean | null
}

export interface LinhaIndicador {
  key: string
  nome: string
  /** Só exibida quando `mostrarNegocio` — Camaçari/Ponta Grossa abrindo ROTA/ARM. */
  negocio?: string
  /** AMBEV etc — linha em negrito/destacada. */
  destaque?: boolean
  meses: (CelulaIndicador | null)[]
}

interface TabelaIndicadorGenericaProps {
  titulo: string
  subtitulo: string
  linhas: LinhaIndicador[]
  carregando: boolean
  mostrarNegocio?: boolean
  semDadosTexto?: string
}

/**
 * Tabela unidade×mês genérica pro Acompanhamento de RV — cada setor calcula
 * as `linhas` já formatadas (texto/tooltip/bateu por célula, ver
 * `CelulaIndicador`) no seu próprio hook de indicador, e essa tabela só
 * renderiza. Um componente só substitui a dezena de tabelas quase-idênticas
 * que cada card de indicador (DescontosFrotaCard, FrotaT1Card,
 * IndicadoresDistribuicaoCard etc.) desenhava com sua própria cópia do JSX.
 */
export function TabelaIndicadorGenerica({ titulo, subtitulo, linhas, carregando, mostrarNegocio, semDadosTexto }: TabelaIndicadorGenericaProps) {
  return (
    <TableCard titulo={titulo} subtitulo={carregando ? 'Carregando...' : subtitulo}>
      {carregando ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : linhas.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{semDadosTexto ?? 'Sem dados pra esse ano.'}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              {mostrarNegocio && <TableHead>Negócio</TableHead>}
              {MESES_ABREV.map(m => (
                <TableHead key={m} className="text-center">{m}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(l => (
              <TableRow
                key={l.key}
                className={cn(
                  'border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30',
                  l.destaque && 'bg-muted/40 font-semibold',
                )}
              >
                <TableCell className="py-1.5 text-sm font-medium">{l.nome}</TableCell>
                {mostrarNegocio && (
                  <TableCell className={cn(
                    'py-1.5 text-sm',
                    !l.negocio || l.negocio === 'CONS' ? 'text-muted-foreground' : 'font-semibold text-blue-600 dark:text-blue-400',
                  )}>
                    {l.negocio ?? '—'}
                  </TableCell>
                )}
                {l.meses.map((c, i) => {
                  if (c === null) return <TableCell key={i} className="py-1.5 text-center text-xs text-muted-foreground">—</TableCell>
                  return (
                    <TableCell
                      key={i}
                      title={c.tooltip}
                      className={cn(
                        'py-1.5 text-center text-xs font-medium tabular-nums',
                        c.bateu === null
                          ? 'text-foreground'
                          : c.bateu
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                      )}
                    >
                      {c.texto}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TableCard>
  )
}
