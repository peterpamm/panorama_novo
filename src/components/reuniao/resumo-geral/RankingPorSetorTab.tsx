import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PillToggle } from '@/components/ui/pill-toggle'
import { atribuirRankComDesempate } from '@/lib/reuniao-resultados'
import { somarAcumuladoAnual } from '@/lib/resumo-geral-calculations'
import { RankingTabelaPontos, type RankingLinhaPontos } from '@/components/ranking/RankingTabelas'
import { deltaFarolPacoteUnidadeMes } from '@/hooks/useReuniaoDados'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { useOrcamentoTodasUnidades } from '@/hooks/useOrcamentoTodasUnidades'
import { MESES_NOMES, ANOS_RESUMO_GERAL, type SetorConsolidado } from '@/pages/reuniao/ReuniaoResumoGeralPage'
import type { ResumoGeralHistorico, Unidade } from '@/types'

const VISOES = [
  { value: 'mes', label: 'Mês' },
  { value: 'ytd', label: 'YTD (acumulado ano)' },
] as const
type Visao = (typeof VISOES)[number]['value']

interface RankingPorSetorTabProps {
  ano: string
  setAno: (v: string) => void
  mes: string
  setMes: (v: string) => void
  unidades: Unidade[]
  setores: SetorConsolidado[]
  historicoDoAno: (unidade: string) => ResumoGeralHistorico | null
  carregando: boolean
}

/** Ranking por Setor (Etapa 4): mesmo ranking que já existe na aba "Resultado do Mês" de cada setor, os 6 juntos numa tela só — com toggle "YTD" pra ver o acumulado do ano de cada setor em vez de só o mês selecionado. */
export function RankingPorSetorTab({ ano, setAno, mes, setMes, unidades, setores, historicoDoAno, carregando }: RankingPorSetorTabProps) {
  const mesNum = Number(mes)
  const [visao, setVisao] = useState<Visao>('mes')
  const { rows: rowsDre } = useDreLongoTodasUnidades()
  const { orcamentos } = useOrcamentoTodasUnidades()
  const nomesUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  const rankingsPorSetor = useMemo(() => {
    return setores.map(s => {
      if (visao === 'ytd') {
        const base = s.unidadesDoTotal.map(({ unidade, negocio }) => {
          const historico = historicoDoAno(unidade)
          const pontos = somarAcumuladoAnual(
            mes => s.totalPorUnidadeMes[`${unidade}|${negocio}|${mes}`] ?? null,
            historico ? { mesFinal: historico.mes_final, pontuacaoAcumulada: historico[s.setor] } : null,
          )
          return { unidade: `${unidade}|${negocio}`, pontos, ebitdaDelta: null as number | null, rank: null as number | null }
        })
        return { label: s.label, ranking: atribuirRankComDesempate(base, l => l.pontos, () => null) }
      }
      const base = s.unidadesDoTotal.map(({ unidade, negocio }) => ({
        unidade: `${unidade}|${negocio}`,
        pontos: s.totalPorUnidadeMes[`${unidade}|${negocio}|${mesNum}`] ?? null,
        // Delta do EBITDA vs meta — critério de desempate e o que aparece na coluna/pódio.
        ebitdaDelta: deltaFarolPacoteUnidadeMes(rowsDre, orcamentos, '232', unidade, Number(ano), mesNum, negocio),
        rank: null as number | null,
      }))
      return { label: s.label, ranking: atribuirRankComDesempate(base, l => l.pontos, l => l.ebitdaDelta) }
    })
  }, [setores, rowsDre, orcamentos, ano, mesNum, visao, historicoDoAno])

  // Chave dos rankings é `unidade|negocio` (pra diferenciar Camaçari Rota/Armazém) — nome exibido cai pro nome puro da unidade quando não achar o composto.
  const nomesComposto = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of setores) {
      for (const p of s.unidadesDoTotal) {
        const nome = nomesUnidade.get(p.unidade) ?? p.unidade
        m.set(`${p.unidade}|${p.negocio}`, p.negocio === 'CONS' ? nome : `${nome} · ${p.negocio === 'ROTA' ? 'Rota' : 'Armazém'}`)
      }
    }
    return m
  }, [setores, nomesUnidade])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANOS_RESUMO_GERAL.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {visao === 'mes' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mês</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <PillToggle opcoes={VISOES} value={visao} onChange={setVisao} />
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {rankingsPorSetor.map(({ label, ranking }) => (
            <RankingTabelaPontos
              key={label}
              linhas={ranking as RankingLinhaPontos[]}
              nomesUnidade={nomesComposto}
              titulo={label}
              subtitulo={visao === 'ytd'
                ? `${ano} — acumulado do ano (YTD)`
                : `${MESES_NOMES[mesNum - 1]}/${ano} · critério de desempate: Δ EBITDA`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
