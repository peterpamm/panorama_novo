import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { useLucroAmbev } from '@/hooks/useLucroAmbev'
import { TabelaLucro } from '@/components/financeira/TabelaLucro'
import { TableCard } from '@/components/ui/table-card'
import type { Unidade } from '@/types'

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

interface Props {
  unidades: Unidade[]
  ano: number
  mes: number
}

/**
 * Slide "Lucro" do SDG Corporativo (logo depois do EBITDA) — a tabela
 * inteira do Lucro que a Ambev paga, todas as unidades, no mesmo mês/ano
 * selecionado no header da apresentação. Mesma tabela do SDG Corp Fin >
 * Lucro (`TabelaLucro`); o dado vem da importação da planilha da Ambev,
 * independente do DRE, então um mês com DRE mas sem Lucro importado aparece
 * vazio (não é erro).
 */
export function SlideLucro({ unidades, ano, mes }: Props) {
  const { linhas, loading } = useLucroAmbev()
  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  const linhasPeriodo = useMemo(
    () => linhas.filter(l => l.ano === ano && l.mes === mes),
    [linhas, ano, mes],
  )

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        <TableCard
          titulo={`Lucro — ${MESES_NOMES[mes - 1]}/${ano}`}
          subtitulo="Volume Atual × R$/HL, todas as unidades · Volume e Lucro já projetados pro mês cheio (a planilha da Ambev traz uma quinzena)"
        >
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : linhasPeriodo.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum dado de Lucro pra {MESES_NOMES[mes - 1]}/{ano} — importe a planilha em Área Financeira &gt; SDG Corp Fin &gt; Lucro.
            </p>
          ) : (
            <TabelaLucro linhasPeriodo={linhasPeriodo} nomesUnidades={nomesUnidades} />
          )}
        </TableCard>
      </div>
    </div>
  )
}
