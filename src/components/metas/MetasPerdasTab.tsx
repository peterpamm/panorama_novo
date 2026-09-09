import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useMetasPerdas } from '@/hooks/useMetasPerdas'
import { mesesAtivosNoAno } from '@/lib/farol-calculations'
import { INDICADORES_PERDAS, type IndicadorKey } from '@/lib/painel-perdas-calculations'
import { ImportarMetasPerdasDialog } from '@/components/metas/ImportarMetasPerdasDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { MetaPerdaIndicador } from '@/types'

const FORM_PERDAS_INICIAL = {
  unidade: '', ano: String(new Date().getFullYear()), metaPct: '', metaAnual: '',
}

/** Valor inteiro pt-BR sem "R$" — mesmo padrão do Painel de Perdas. */
function fmtValor(v: number): string {
  return Math.round(v).toLocaleString('pt-BR')
}

/** Destaque de fundo pras linhas TOTAL e Meta (%) — tom mais forte, dentro da paleta azul do layout. */
const LINHA_DESTAQUE = 'border-gray-200/30 dark:border-gray-700/30 bg-blue-500/10 dark:bg-blue-500/15 font-semibold hover:bg-blue-500/15 dark:hover:bg-blue-500/20'

interface TabelaMetaPerdasProps {
  titulo: string
  subtitulo: string
  unidadesColunas: string[]
  nomesUnidade: Map<string, string>
  valorIndicador: (indicador: IndicadorKey, unidade: string) => number | null
  metaDaUnidade: (unidade: string) => { meta_anual: number; meta_pct: number } | undefined
  /** 1 = anual (sempre), pro mensal = quantos meses a unidade esteve ativa no ano (ver `mesesAtivosNoAno`) — a Meta (%) não muda, é a mesma nos dois quadros. */
  divisorDaUnidade: (unidade: string) => number
  carregando: boolean
}

/** Matriz indicador × unidade — reaproveitada pro quadro anual e pro mensal (mesma estrutura, só muda o divisor). */
function TabelaMetaPerdas({ titulo, subtitulo, unidadesColunas, nomesUnidade, valorIndicador, metaDaUnidade, divisorDaUnidade, carregando }: TabelaMetaPerdasProps) {
  return (
    <TableCard titulo={titulo} subtitulo={carregando ? 'Carregando...' : subtitulo}>
      {carregando ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : unidadesColunas.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma meta de perdas cadastrada ainda — importe a planilha ou cadastre manualmente.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                {unidadesColunas.map(u => (
                  <TableHead key={u} className="text-center">{nomesUnidade.get(u) ?? u}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {INDICADORES_PERDAS.map(ind => (
                <TableRow key={ind.key} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="py-1.5 text-sm font-medium">{ind.label}</TableCell>
                  {unidadesColunas.map(u => {
                    const v = valorIndicador(ind.key, u)
                    return (
                      <TableCell key={u} className="py-1.5 text-center text-xs tabular-nums text-muted-foreground">
                        {v === null ? '—' : fmtValor(v / divisorDaUnidade(u))}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
              <TableRow className={LINHA_DESTAQUE}>
                <TableCell className="py-1.5 text-sm">TOTAL</TableCell>
                {unidadesColunas.map(u => {
                  const v = metaDaUnidade(u)?.meta_anual ?? null
                  return (
                    <TableCell key={u} className="py-1.5 text-center text-xs tabular-nums">
                      {v === null ? '—' : fmtValor(v / divisorDaUnidade(u))}
                    </TableCell>
                  )
                })}
              </TableRow>
              <TableRow className={LINHA_DESTAQUE}>
                <TableCell className="py-1.5 text-sm">Meta (%)</TableCell>
                {unidadesColunas.map(u => {
                  const v = metaDaUnidade(u)?.meta_pct ?? null
                  return (
                    <TableCell key={u} className="py-1.5 text-center text-xs tabular-nums">
                      {v === null ? '—' : `${v.toFixed(2)}%`}
                    </TableCell>
                  )
                })}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </TableCard>
  )
}

/**
 * Meta de Perdas: matriz indicador × unidade, pro ano selecionado — mesma
 * lista de indicadores usada no realizado (INDICADORES_PERDAS), agora do
 * lado da meta (máximo a perder no ano). TOTAL (R$) e a Meta (%) continuam
 * vindo de metas_perdas (regra antiga, mesma base do cálculo mensal); os
 * indicadores individuais vêm de metas_perdas_indicadores — ambos
 * preenchidos de uma vez pela importação da planilha "ACUMULADO".
 */
export function MetasPerdasTab() {
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const { metasPerdas, loading: carregandoTotais, recarregar: recarregarTotais } = useMetasPerdas()

  const [indicadores, setIndicadores] = useState<MetaPerdaIndicador[]>([])
  const [carregandoIndicadores, setCarregandoIndicadores] = useState(true)

  async function carregarIndicadores() {
    setCarregandoIndicadores(true)
    const { data, error } = await supabase.from('metas_perdas_indicadores').select('*')
    if (!error) setIndicadores((data as MetaPerdaIndicador[]) ?? [])
    setCarregandoIndicadores(false)
  }
  useEffect(() => { carregarIndicadores() }, [])

  function recarregarTudo() {
    recarregarTotais()
    carregarIndicadores()
  }

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(FORM_PERDAS_INICIAL)
  const [salvando, setSalvando] = useState(false)

  const nomesUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])
  const dataEntradaPorUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.data_entrada])), [unidades])

  /** Quantos meses do `ano` selecionado a unidade esteve ativa — pra dividir a Meta de Perdas anual só por esses meses (ver `mesesAtivosNoAno`), não sempre por 12. */
  function mesesAtivosDaUnidade(unidade: string): number {
    return mesesAtivosNoAno(dataEntradaPorUnidade.get(unidade) ?? null, Number(ano))
  }

  const anosDisponiveis = useMemo(
    () => Array.from(new Set([...metasPerdas.map(m => m.ano), ...indicadores.map(i => i.ano)])).sort((a, b) => b - a),
    [metasPerdas, indicadores],
  )
  const [ano, setAno] = useState('')
  useEffect(() => {
    if (anosDisponiveis.length > 0 && !anosDisponiveis.includes(Number(ano))) setAno(String(anosDisponiveis[0]))
  }, [anosDisponiveis, ano])

  const unidadesColunas = useMemo(() => {
    const anoNum = Number(ano)
    const codigos = new Set([
      ...metasPerdas.filter(m => m.ano === anoNum).map(m => m.unidade),
      ...indicadores.filter(i => i.ano === anoNum).map(i => i.unidade),
    ])
    const semAmbev = Array.from(codigos)
      .filter(c => c !== 'AMBEV')
      .sort((a, b) => (nomesUnidade.get(a) ?? a).localeCompare(nomesUnidade.get(b) ?? b))
    return codigos.has('AMBEV') ? [...semAmbev, 'AMBEV'] : semAmbev
  }, [metasPerdas, indicadores, ano, nomesUnidade])

  function valorIndicador(indicador: IndicadorKey, unidade: string): number | null {
    const anoNum = Number(ano)
    const row = indicadores.find(i => i.unidade === unidade && i.ano === anoNum && i.indicador === indicador)
    return row ? row.meta_anual : null
  }
  function metaDaUnidade(unidade: string) {
    return metasPerdas.find(m => m.unidade === unidade && m.ano === Number(ano))
  }

  function abrirDialog() {
    setForm(FORM_PERDAS_INICIAL)
    setOpen(true)
  }

  async function handleSalvar() {
    const anoForm = Number(form.ano)
    const metaPct = Number(form.metaPct.replace(',', '.'))
    const metaAnual = Number(form.metaAnual.replace(',', '.'))
    if (!form.unidade || !form.ano || form.metaPct === '' || Number.isNaN(metaPct) || form.metaAnual === '' || Number.isNaN(metaAnual)) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const { error } = await supabase
      .from('metas_perdas')
      .upsert({ unidade: form.unidade, ano: anoForm, meta_pct: metaPct, meta_anual: metaAnual }, { onConflict: 'unidade,ano' })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar meta de perdas', description: error.message, variant: 'destructive' })
      return
    }
    setOpen(false)
    recarregarTudo()
    toast({ title: 'Meta de perdas salva com sucesso' })
  }

  const carregando = carregandoTotais || carregandoIndicadores

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Meta de Perdas por indicador — máximo que cada unidade pode perder no ano em cada um (Devolução,
        Indisponibilidade, Vales, Multas, Processos Trabalhistas, Desconto CIVF, Sinistro de Frota, BNS). Célula
        zerada ou vazia = meta zero pra perder naquele indicador. TOTAL (soma dos indicadores) e a Meta (%) sobre o
        faturamento continuam a base do cálculo mensal do Painel de Perdas.
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-2">
          <ImportarMetasPerdasDialog unidades={unidades} onImportado={recarregarTudo} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" onClick={abrirDialog}><Plus className="h-4 w-4" />Ajustar TOTAL/% manualmente</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Ajustar TOTAL / Meta (%) de uma unidade</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-2">
                <div className="space-y-1.5">
                  <Label>Unidade</Label>
                  <Select value={form.unidade} onValueChange={v => setForm(f => ({ ...f, unidade: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {unidades.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Ano</Label>
                  <Input type="number" value={form.ano} onChange={e => setForm(f => ({ ...f, ano: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Meta Anual (%)</Label>
                  <Input value={form.metaPct} onChange={e => setForm(f => ({ ...f, metaPct: e.target.value }))} placeholder="Ex: -2,42" />
                </div>
                <div className="space-y-1.5">
                  <Label>Meta Anual (R$)</Label>
                  <Input value={form.metaAnual} onChange={e => setForm(f => ({ ...f, metaAnual: e.target.value }))} placeholder="Ex: -1.019.671,58" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSalvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <TabelaMetaPerdas
        titulo="Meta de Perdas — Anual"
        subtitulo={`${ano} · máximo a perder no ano por indicador · TOTAL = soma dos indicadores · Meta (%) sobre o faturamento`}
        unidadesColunas={unidadesColunas}
        nomesUnidade={nomesUnidade}
        valorIndicador={valorIndicador}
        metaDaUnidade={metaDaUnidade}
        divisorDaUnidade={() => 1}
        carregando={carregando}
      />

      <TabelaMetaPerdas
        titulo="Meta de Perdas — Mensal"
        subtitulo={`${ano} · meta anual dividida pelos meses ativos de cada unidade (data de entrada em Administração > Unidades — 12 pras que já operavam desde janeiro) · Meta (%) é a mesma do quadro anual`}
        unidadesColunas={unidadesColunas}
        nomesUnidade={nomesUnidade}
        valorIndicador={valorIndicador}
        metaDaUnidade={metaDaUnidade}
        divisorDaUnidade={mesesAtivosDaUnidade}
        carregando={carregando}
      />
    </div>
  )
}
