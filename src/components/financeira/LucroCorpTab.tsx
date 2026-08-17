import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useUnidades } from '@/hooks/useUnidades'
import { useLucroAmbev } from '@/hooks/useLucroAmbev'
import { ImportarLucroDialog } from '@/components/financeira/ImportarLucroDialog'
import { TabelaLucro } from '@/components/financeira/TabelaLucro'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { TableCard } from '@/components/ui/table-card'
import { cn } from '@/lib/utils'

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const ANO_ATUAL = new Date().getFullYear()
const ANOS_OPCOES = [ANO_ATUAL + 1, ANO_ATUAL, ANO_ATUAL - 1]

/**
 * Lucro que a Ambev paga por unidade, baseado no volume de bebida entregue
 * (Volume Atual × R$/HL, planilha própria da Ambev) — cada negócio
 * (ROTA/AS hoje, Armazém entra depois) vira um grupo de 3 colunas
 * (Volume/R$/HL/Lucro). A tabela em si é a `TabelaLucro`, compartilhada com
 * o slide "Lucro" da apresentação do SDG Corporativo.
 */
export function LucroCorpTab() {
  const { unidades } = useUnidades()
  const { linhas, loading, recarregar } = useLucroAmbev()
  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  const [ano, setAno] = useState(ANO_ATUAL)
  const [mes, setMes] = useState(new Date().getMonth() + 1)

  const linhasPeriodo = useMemo(() => linhas.filter(l => l.ano === ano && l.mes === mes), [linhas, ano, mes])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
              <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANOS_OPCOES.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Mês</Label>
            <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
              <SelectTrigger className={cn('w-40', selectGlamour)}><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <ImportarLucroDialog unidades={unidades} onImportado={recarregar} />
      </div>

      <TableCard
        titulo={`Lucro — ${MESES_NOMES[mes - 1]}/${ano}`}
        subtitulo="Volume e Lucro já projetados pro mês cheio (a planilha da Ambev traz o valor de uma quinzena)"
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : linhasPeriodo.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhum dado de Lucro pra {MESES_NOMES[mes - 1]}/{ano} ainda — importe a planilha acima.
          </p>
        ) : (
          <TabelaLucro linhasPeriodo={linhasPeriodo} nomesUnidades={nomesUnidades} />
        )}
      </TableCard>
    </div>
  )
}
