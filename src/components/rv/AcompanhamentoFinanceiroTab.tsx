import { useEffect, useMemo, useState } from 'react'
import { RV_FINANCEIRO_DRE } from '@/lib/constants'
import { useIndicadorDreMatriz, linhasDreParaIndicador } from '@/hooks/useIndicadorDreMatriz'
import { useValesIndicador } from '@/hooks/useValesIndicador'
import { TabelaIndicadorGenerica } from '@/components/rv/TabelaIndicadorGenerica'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'

const PREFIXO_DRE = 'dre:'
const PREFIXO_VALES = 'vales'
const chaveDre = (id: string) => `${PREFIXO_DRE}${id}`

/**
 * Acompanhamento da RV do Financeiro — seletor único combinando os
 * indicadores com origem no DRE (Despesa Administrativa, Custo Operacional,
 * Multas) e o Vales (dispersão do DRE vs % da Meta de Perdas), que antes
 * viviam em dois cards/seletores separados (IndicadoresDreCard + ValesPerdasCard).
 */
export function AcompanhamentoFinanceiroTab() {
  const [verIndicadorChave, setVerIndicadorChave] = useState(chaveDre(RV_FINANCEIRO_DRE[0].id))
  const fonte: 'dre' | 'vales' = verIndicadorChave === PREFIXO_VALES ? 'vales' : 'dre'
  const idDre = fonte === 'dre' ? verIndicadorChave.slice(PREFIXO_DRE.length) : RV_FINANCEIRO_DRE[0].id

  const [verAno, setVerAno] = useState('')
  const { matriz, carregando: carregandoDre, anosDisponiveis: anosDre, ind } = useIndicadorDreMatriz(
    RV_FINANCEIRO_DRE, idDre, verAno ? Number(verAno) : null,
  )
  const { linhas: linhasVales, carregando: carregandoVales, anosDisponiveis: anosVales } = useValesIndicador(
    'rv_vales_financeiro_meta', verAno ? Number(verAno) : null,
  )

  const anosDisponiveis = useMemo(
    () => Array.from(new Set([...anosDre, ...anosVales])).sort((a, b) => b - a),
    [anosDre, anosVales],
  )
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(verAno))) setVerAno(String(anosDisponiveis[0]))
  }, [anosDisponiveis, verAno])

  const linhasDre = useMemo(() => linhasDreParaIndicador(matriz), [matriz])

  const linhas = fonte === 'dre' ? linhasDre : linhasVales
  const carregando = fonte === 'dre' ? carregandoDre : carregandoVales
  const titulo = fonte === 'dre' ? ind.nome : 'Vales'
  const subtitulo = fonte === 'dre'
    ? (ind.tipo === 'avr'
      ? `${verAno} · AVR do mês vs meta do Orçamento · quanto menor melhor · verde = meta batida, vermelho = meta perdida`
      : `${verAno} · dispersão do mês (coluna diferença do DRE, contas ${ind.prefixos.join(' + ')}) · verde = sem estouro (≥ 0)`)
    : `${verAno} · dispersão do mês (contas 052/053, DRE consolidado) vs % da Meta de Perdas de Vales`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Indicador</Label>
          <Select value={verIndicadorChave} onValueChange={setVerIndicadorChave}>
            <SelectTrigger className={cn('w-64', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Indicadores do DRE</SelectLabel>
                {RV_FINANCEIRO_DRE.map(i => <SelectItem key={chaveDre(i.id)} value={chaveDre(i.id)}>{i.nome}</SelectItem>)}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Perdas</SelectLabel>
                <SelectItem value={PREFIXO_VALES}>Vales</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={verAno} onValueChange={setVerAno}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TabelaIndicadorGenerica
        titulo={titulo}
        subtitulo={subtitulo}
        linhas={linhas}
        carregando={carregando}
        mostrarNegocio={fonte === 'dre'}
        semDadosTexto="Sem dados do DRE pra esse ano."
      />
    </div>
  )
}
