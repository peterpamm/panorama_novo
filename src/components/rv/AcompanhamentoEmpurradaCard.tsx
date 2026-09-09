import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useDreLongoTodasUnidades } from '@/hooks/useDreLongoTodasUnidades'
import { resolverUnidade } from '@/lib/unidade-resolver'
import { calcularSemaforo } from '@/lib/farol-calculations'
import { formatarResultado } from '@/lib/reuniao-resultados'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { cn } from '@/lib/utils'
import type { PainelPerdasAux, ReuniaoIndicador, ReuniaoResultadoMensal } from '@/types'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const PREFIXOS_AVARIA_TRANSPORTE = ['052', '053']

const INDICADORES_EMPURRADA = [
  { id: 'indisponibilidade', nome: 'Indisponibilidade' },
  { id: 'avaria_transporte', nome: 'Avaria de Transporte' },
  { id: 'gty', nome: 'GTY' },
  { id: 'tmv', nome: 'TMV' },
  { id: 'tempo_rendicao', nome: 'Tempo de Rendição' },
] as const

const NOME_IMPORTADO: Record<'gty' | 'tmv' | 'tempo_rendicao', string> = {
  gty: 'GTY',
  tmv: 'TMV',
  tempo_rendicao: 'TEMPO RENDIÇÃO',
}

interface MetaValorPeso {
  meta_valor: number
  peso: number
}

function fmtValor(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * Acompanhamento dos 5 indicadores da RV de Empurrada (só Estância) — mesmos
 * dados e mesma regra da apuração (RvApuracao, RvEmpurradaPage): Indisponibilidade
 * (painel_perdas_aux, mesmo dado do Painel de Perdas) e Avaria de Transporte
 * (DRE 052/053, mesmo resultado do indicador Vales, meta direta em R$) vêm do
 * Painel de Perdas; GTY/TMV/Tempo de Rendição já vêm importados na Reunião
 * Resultados (setor Distribuição, nomes T1) — sem cadastro de meta aqui, só
 * exibição.
 */
export function AcompanhamentoEmpurradaCard() {
  const { unidades } = useUnidades()
  const estanciaCodigo = useMemo(() => resolverUnidade('ESTÂNCIA', unidades)?.codigo, [unidades])
  const { rows: rowsDre, loading: loadingDre } = useDreLongoTodasUnidades()

  const [indId, setIndId] = useState<(typeof INDICADORES_EMPURRADA)[number]['id']>('indisponibilidade')

  // ── Indisponibilidade (painel_perdas_aux) ──────────────────────────────────
  const [resultadosIndisp, setResultadosIndisp] = useState<PainelPerdasAux[]>([])
  const [metaIndisp, setMetaIndisp] = useState<MetaValorPeso | null>(null)
  const [carregandoIndisp, setCarregandoIndisp] = useState(true)

  // ── Avaria de Transporte (meta própria, R$ direto) ─────────────────────────
  const [metaAvaria, setMetaAvaria] = useState<MetaValorPeso | null>(null)
  const [carregandoAvaria, setCarregandoAvaria] = useState(true)

  // ── GTY / TMV / Tempo de Rendição (Reunião Resultados) ─────────────────────
  const [indicadoresImportados, setIndicadoresImportados] = useState<ReuniaoIndicador[]>([])
  const [resultadosImportados, setResultadosImportados] = useState<ReuniaoResultadoMensal[]>([])
  const [carregandoImportados, setCarregandoImportados] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregandoIndisp(true)
      setCarregandoAvaria(true)
      setCarregandoImportados(true)
      const [r, mi, ma, inds] = await Promise.all([
        supabase.from('painel_perdas_aux').select('*').eq('indicador', 'indisponibilidade'),
        supabase.from('rv_empurrada_indisponibilidade_meta').select('*').maybeSingle(),
        supabase.from('rv_empurrada_avaria_transporte_meta').select('*').maybeSingle(),
        supabase.from('reuniao_resultados_indicadores').select('*').eq('setor', 'distribuicao').eq('ativo', true)
          .or('nome.in.(GTY,TMV,TEMPO RENDIÇÃO),nome_t1.in.(GTY,TMV,TEMPO RENDIÇÃO)'),
      ])
      setResultadosIndisp((r.data as PainelPerdasAux[]) ?? [])
      setMetaIndisp(mi.data as MetaValorPeso | null)
      setCarregandoIndisp(false)
      setMetaAvaria(ma.data as MetaValorPeso | null)
      setCarregandoAvaria(false)

      const indicadores = (inds.data as ReuniaoIndicador[]) ?? []
      setIndicadoresImportados(indicadores)
      const ids = indicadores.map(i => i.id)
      if (ids.length > 0) {
        const { data } = await supabase.from('reuniao_resultados_mensais').select('*').in('indicador_id', ids)
        setResultadosImportados((data as ReuniaoResultadoMensal[]) ?? [])
      } else {
        setResultadosImportados([])
      }
      setCarregandoImportados(false)
    }
    carregar()
  }, [])

  const anosIndisponibilidade = useMemo(
    () => Array.from(new Set(resultadosIndisp.filter(r => r.unidade === estanciaCodigo).map(r => r.ano))).sort((a, b) => b - a),
    [resultadosIndisp, estanciaCodigo],
  )
  const anosAvariaTransporte = useMemo(
    () => Array.from(new Set(rowsDre.filter(r => r.tipo_periodo === 'MENSAL' && r.unidade === estanciaCodigo && r.negocio === 'CONS').map(r => r.ano))).sort((a, b) => b - a),
    [rowsDre, estanciaCodigo],
  )
  const anosImportados = useMemo(() => {
    if (indId !== 'gty' && indId !== 'tmv' && indId !== 'tempo_rendicao') return []
    const nome = NOME_IMPORTADO[indId]
    const idsDoIndicador = indicadoresImportados.filter(i => i.nome === nome || i.nome_t1 === nome).map(i => i.id)
    return Array.from(new Set(indicadoresImportados.filter(i => idsDoIndicador.includes(i.id)).map(i => i.ano))).sort((a, b) => b - a)
  }, [indId, indicadoresImportados])

  const anosDisponiveis = indId === 'indisponibilidade'
    ? anosIndisponibilidade
    : indId === 'avaria_transporte'
      ? anosAvariaTransporte
      : anosImportados

  const [ano, setAno] = useState('')
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(ano))) setAno(String(anosDisponiveis[0]))
  }, [anosDisponiveis, ano])

  const mesesIndisponibilidade = useMemo(() => {
    const anoNum = Number(ano)
    if (!anoNum || !estanciaCodigo) return null
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      return resultadosIndisp.find(r => r.unidade === estanciaCodigo && r.ano === anoNum && r.mes === mes)?.valor ?? null
    })
  }, [resultadosIndisp, ano, estanciaCodigo])

  const mesesAvariaTransporte = useMemo(() => {
    const anoNum = Number(ano)
    if (!anoNum || !estanciaCodigo) return null
    const mensal = rowsDre.filter(r => r.tipo_periodo === 'MENSAL' && r.ano === anoNum && r.unidade === estanciaCodigo && r.negocio === 'CONS')
    if (mensal.length === 0) return null
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      const rowsMes = mensal.filter(r => r.mes === mes)
      if (rowsMes.length === 0) return null
      return rowsMes.filter(r => PREFIXOS_AVARIA_TRANSPORTE.some(p => r.conta_codigo.startsWith(p))).reduce((acc, r) => acc + (r.diferenca ?? 0), 0)
    })
  }, [rowsDre, ano, estanciaCodigo])

  const mesesImportados = useMemo(() => {
    if (indId !== 'gty' && indId !== 'tmv' && indId !== 'tempo_rendicao') return null
    const anoNum = Number(ano)
    if (!anoNum || !estanciaCodigo) return null
    const nome = NOME_IMPORTADO[indId]
    const indConfig = indicadoresImportados.find(i => i.ano === anoNum && (i.nome === nome || i.nome_t1 === nome))
    if (!indConfig) return null
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      const linha = resultadosImportados.find(r => r.indicador_id === indConfig.id && r.unidade === estanciaCodigo && r.negocio === 'CONS' && r.mes === mes)
      if (!linha || linha.resultado === null) return null
      return { resultado: linha.resultado, meta: linha.meta, formato: indConfig.formato, natureza: indConfig.natureza }
    })
  }, [indId, ano, estanciaCodigo, indicadoresImportados, resultadosImportados])

  const carregando = indId === 'indisponibilidade'
    ? carregandoIndisp
    : indId === 'avaria_transporte'
      ? (carregandoAvaria || loadingDre)
      : carregandoImportados

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Indicador</Label>
          <Select value={indId} onValueChange={v => setIndId(v as typeof indId)}>
            <SelectTrigger className={cn('w-56', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {INDICADORES_EMPURRADA.map(i => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {indId === 'indisponibilidade' ? (
        <TableCard
          titulo="Indisponibilidade"
          subtitulo={carregando ? 'Carregando...' : `Estância · ${ano} · resultado do mês (R$) vs meta · mesmo dado do Painel de Perdas`}
        >
          {carregando ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : !mesesIndisponibilidade ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Sem resultados importados — importe na página Importação, aba Painel de Perdas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  {MESES_ABREV.map(m => <TableHead key={m} className="text-center">{m}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="py-1.5 text-sm font-medium">
                    Estância
                    {metaIndisp === null && <span className="ml-1 text-[10px] text-muted-foreground">(sem meta)</span>}
                  </TableCell>
                  {mesesIndisponibilidade.map((valor, i) => {
                    if (valor === null) return <TableCell key={i} className="py-1.5 text-center text-xs text-muted-foreground">—</TableCell>
                    const bateu = metaIndisp === null ? null : valor >= metaIndisp.meta_valor
                    return (
                      <TableCell
                        key={i}
                        title={metaIndisp !== null ? `Meta: R$ ${fmtValor(metaIndisp.meta_valor)}` : 'Sem meta cadastrada'}
                        className={cn(
                          'py-1.5 text-center text-xs font-medium tabular-nums',
                          bateu === null ? 'text-foreground' : bateu ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                        )}
                      >
                        {fmtValor(valor)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </TableCard>
      ) : indId === 'avaria_transporte' ? (
        <TableCard
          titulo="Avaria de Transporte"
          subtitulo={carregando ? 'Carregando...' : `Estância · ${ano} · dispersão do mês (contas 052/053, DRE consolidado) vs meta (R$)`}
        >
          {carregando ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : !mesesAvariaTransporte ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Sem dados do DRE pra esse ano.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  {MESES_ABREV.map(m => <TableHead key={m} className="text-center">{m}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="py-1.5 text-sm font-medium">
                    Estância
                    {metaAvaria === null && <span className="ml-1 text-[10px] text-muted-foreground">(sem meta)</span>}
                  </TableCell>
                  {mesesAvariaTransporte.map((valor, i) => {
                    if (valor === null) return <TableCell key={i} className="py-1.5 text-center text-xs text-muted-foreground">—</TableCell>
                    const bateu = metaAvaria === null ? null : valor >= metaAvaria.meta_valor
                    return (
                      <TableCell
                        key={i}
                        title={metaAvaria !== null ? `Meta: R$ ${fmtValor(metaAvaria.meta_valor)}` : 'Sem meta cadastrada'}
                        className={cn(
                          'py-1.5 text-center text-xs font-medium tabular-nums',
                          bateu === null ? 'text-foreground' : bateu ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                        )}
                      >
                        {fmtValor(valor)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </TableCard>
      ) : (
        <TableCard
          titulo={INDICADORES_EMPURRADA.find(i => i.id === indId)!.nome}
          subtitulo={carregando ? 'Carregando...' : `Estância · ${ano} · já importado na Reunião Resultados (Distribuição) · resultado do mês vs meta`}
        >
          {carregando ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : !mesesImportados ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Sem indicador cadastrado/importado pra esse ano na Reunião Resultados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  {MESES_ABREV.map(m => <TableHead key={m} className="text-center">{m}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="py-1.5 text-sm font-medium">Estância</TableCell>
                  {mesesImportados.map((c, i) => {
                    if (c === null) return <TableCell key={i} className="py-1.5 text-center text-xs text-muted-foreground">—</TableCell>
                    const bateu = c.meta !== null ? calcularSemaforo(c.resultado, c.meta, c.natureza).corClasse === 'positivo' : null
                    return (
                      <TableCell
                        key={i}
                        title={c.meta !== null ? `Meta: ${formatarResultado(c.meta, c.formato)}` : 'Sem meta importada'}
                        className={cn(
                          'py-1.5 text-center text-xs font-medium tabular-nums',
                          bateu === null ? 'text-foreground' : bateu ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold' : 'bg-red-500/10 text-red-600 dark:text-red-400 font-semibold',
                        )}
                      >
                        {formatarResultado(c.resultado, c.formato)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </TableCard>
      )}
    </div>
  )
}
