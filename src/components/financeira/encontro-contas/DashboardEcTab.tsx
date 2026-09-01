import { useMemo, useState } from 'react'
import { Camera, Check, FileStack, Loader2, Wallet, Clock, CheckCircle2 } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth } from '@/context/AuthContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { COR_AVR, MES_ABREV, getChartColors } from '@/components/farol/chart-shared'
import { useCopiarComoImagem } from '@/hooks/useCopiarComoImagem'
import { STATUS_PILL } from '@/lib/encontro-contas'
import { cn, formatCurrencyCompact, formatCurrencyInteiro } from '@/lib/utils'
import type { EncontroContas, Unidade } from '@/types'

interface DashboardEcTabProps {
  ecs: EncontroContas[]
  unidades: Unidade[]
  loading: boolean
}

/** Contagem de uma célula da tabela "Status por unidade" — zero fica só um traço neutro, sem colorido, pra destacar visualmente só onde tem EC de fato. */
function CelulaContagem({ valor, corClasse }: { valor: number; corClasse: string }) {
  if (valor === 0) return <span className="text-muted-foreground">—</span>
  return (
    <span className={cn('inline-flex min-w-[28px] justify-center rounded-full px-2 py-0.5 text-xs font-semibold', corClasse)}>
      {valor}
    </span>
  )
}

function TooltipEvolucao({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 text-xs shadow-md text-popover-foreground">
      <p className="mb-1 font-semibold">{label}</p>
      <p className="flex items-center gap-1.5 text-muted-foreground">
        <span className="h-2 w-2 rounded-full" style={{ background: COR_AVR }} />
        Descontado: <span className="font-medium text-popover-foreground">{formatCurrencyCompact(payload[0].value)}</span>
      </p>
    </div>
  )
}


/** Dashboard (Etapa 7): indicadores gerenciais + farol por unidade (com "Copiar imagem" — `useCopiarComoImagem`, mesmo mecanismo dos cards de Ranking — pra mandar pro grupo). Filtro De/Até restringe cards e tabelas — não a evolução mensal (é uma série histórica) nem o farol (reflete o status atual, não uma janela de datas). Unidade (não-admin) só vê o próprio farol — as ECs já vêm com RLS restrito à própria unidade, então cards/tabelas já saem naturalmente escopados. */
export function DashboardEcTab({ ecs, unidades, loading }: DashboardEcTabProps) {
  const { role, unidade: minhaUnidade } = useAuth()
  const isAdmin = role === 'admin'
  const nomesUnidades = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])
  const { ref: refFarol, status: statusFarol, copiar: copiarFarol } = useCopiarComoImagem('farol-encontro-contas')

  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const ecsFiltrados = useMemo(() => ecs.filter(e => {
    if (dataDe && e.data < dataDe) return false
    if (dataAte && e.data > dataAte) return false
    return true
  }), [ecs, dataDe, dataAte])

  const cards = useMemo(() => ({
    total: ecsFiltrados.length,
    valorTotal: ecsFiltrados.reduce((acc, e) => acc + e.valor, 0),
    pendentes: ecsFiltrados.filter(e => e.status === 'pendente').length,
    concluidos: ecsFiltrados.filter(e => e.status === 'concluido' || e.status === 'validado').length,
  }), [ecsFiltrados])

  const porUnidade = useMemo(() => {
    const mapa = new Map<string, { qtd: number; valor: number }>()
    for (const e of ecsFiltrados) {
      const chave = e.unidade ?? '__sem__'
      const atual = mapa.get(chave) ?? { qtd: 0, valor: 0 }
      mapa.set(chave, { qtd: atual.qtd + 1, valor: atual.valor + e.valor })
    }
    return Array.from(mapa.entries())
      .map(([unidade, v]) => ({ unidade, nome: unidade === '__sem__' ? 'Sem unidade' : (nomesUnidades.get(unidade) ?? unidade), ...v }))
      .sort((a, b) => b.valor - a.valor)
  }, [ecsFiltrados, nomesUnidades])

  const porMotivo = useMemo(() => {
    const mapa = new Map<string, { qtd: number; valor: number }>()
    for (const e of ecsFiltrados) {
      const chave = e.motivo ?? 'Sem motivo'
      const atual = mapa.get(chave) ?? { qtd: 0, valor: 0 }
      mapa.set(chave, { qtd: atual.qtd + 1, valor: atual.valor + e.valor })
    }
    return Array.from(mapa.entries()).map(([motivo, v]) => ({ motivo, ...v })).sort((a, b) => b.valor - a.valor)
  }, [ecsFiltrados])

  const evolucaoMensal = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const e of ecs) {
      const chave = e.data.slice(0, 7) // 'YYYY-MM'
      mapa.set(chave, (mapa.get(chave) ?? 0) + e.valor)
    }
    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([chave, valor]) => ({ mesLabel: `${MES_ABREV[Number(chave.slice(5, 7))]}/${chave.slice(2, 4)}`, valor }))
  }, [ecs])

  // AMBEV é o consolidado LOG20 — não existe EC específico dela, então some da lista.
  const unidadesStatus = useMemo(
    () => (isAdmin ? unidades : unidades.filter(u => u.codigo === minhaUnidade)).filter(u => u.codigo !== 'AMBEV'),
    [unidades, isAdmin, minhaUnidade],
  )
  const statusPorUnidade = useMemo(() => unidadesStatus.map(u => {
    const daUnidade = ecs.filter(e => e.unidade === u.codigo)
    return {
      unidade: u,
      concluido: daUnidade.filter(e => e.status === 'concluido').length,
      em_andamento: daUnidade.filter(e => e.status === 'em_andamento').length,
      pendente: daUnidade.filter(e => e.status === 'pendente').length,
    }
  }), [unidadesStatus, ecs])
  const totaisStatus = useMemo(() => statusPorUnidade.reduce((acc, u) => ({
    concluido: acc.concluido + u.concluido,
    em_andamento: acc.em_andamento + u.em_andamento,
    pendente: acc.pendente + u.pendente,
  }), { concluido: 0, em_andamento: 0, pendente: 0 }), [statusPorUnidade])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando...
      </div>
    )
  }

  const { axis, cursor } = getChartColors()

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">De</Label>
          <Input type="date" value={dataDe} onChange={e => setDataDe(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <Input type="date" value={dataAte} onChange={e => setDataAte(e.target.value)} className="w-40" />
        </div>
        <p className="pb-2 text-xs text-muted-foreground">Filtra os cards e as tabelas abaixo — não afeta a evolução mensal.</p>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><FileStack className="h-4 w-4" /> Total de ECs</div>
          <div className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{cards.total}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Wallet className="h-4 w-4" /> Valor total</div>
          <div className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{formatCurrencyCompact(cards.valorTotal)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-4 w-4" /> Pendentes</div>
          <div className="mt-1.5 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{cards.pendentes}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4" /> Concluídos</div>
          <div className="mt-1.5 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{cards.concluidos}</div>
        </Card>
      </div>

      <TableCard titulo="Evolução mensal dos descontos" subtitulo="Valor total por mês (últimos 12 meses com dado)">
        {evolucaoMensal.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Sem dados ainda.</p>
        ) : (
          <div className="h-[280px] w-full p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucaoMensal} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <XAxis dataKey="mesLabel" tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 12, fontWeight: 500 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 11, fontWeight: 500 }} tickFormatter={v => formatCurrencyCompact(v)} width={56} />
                <Tooltip content={<TooltipEvolucao />} cursor={{ fill: cursor }} />
                <Bar dataKey="valor" name="Descontado" fill={COR_AVR} radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </TableCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TableCard titulo="ECs por unidade" subtitulo={`${porUnidade.length} unidade(s)`}>
          {porUnidade.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Sem dados ainda.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Unidade</TableHead><TableHead className="text-center">Qtd.</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {porUnidade.map(u => (
                  <TableRow key={u.unidade} className="border-gray-200/30 dark:border-gray-700/30">
                    <TableCell className="text-sm">{u.nome}</TableCell>
                    <TableCell className="text-center text-sm tabular-nums text-muted-foreground">{u.qtd}</TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">{formatCurrencyInteiro(u.valor)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-gray-200/30 bg-muted/40 dark:border-gray-700/30 hover:bg-muted/40">
                  <TableCell className="text-sm font-semibold">Total</TableCell>
                  <TableCell className="text-center text-sm font-semibold tabular-nums">{cards.total}</TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">{formatCurrencyInteiro(cards.valorTotal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </TableCard>

        <TableCard titulo="ECs por motivo" subtitulo={`${porMotivo.length} motivo(s)`}>
          {porMotivo.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Sem dados ainda.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Motivo</TableHead><TableHead className="text-center">Qtd.</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
              <TableBody>
                {porMotivo.map(m => (
                  <TableRow key={m.motivo} className="border-gray-200/30 dark:border-gray-700/30">
                    <TableCell className="text-sm">{m.motivo}</TableCell>
                    <TableCell className="text-center text-sm tabular-nums text-muted-foreground">{m.qtd}</TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">{formatCurrencyInteiro(m.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableCard>
      </div>

      <TableCard
        ref={refFarol}
        titulo="Status por unidade"
        subtitulo="Quantidade de ECs por status, em cada unidade"
        acoes={
          <Button
            variant="outline" size="sm" className="gap-2" onClick={copiarFarol} disabled={statusFarol === 'copiando'} data-no-print
          >
            {statusFarol === 'copiado' ? <Check className="h-4 w-4 text-emerald-500" /> : <Camera className="h-4 w-4" />}
            {statusFarol === 'copiado' ? 'Copiado!' : statusFarol === 'copiando' ? 'Gerando...' : 'Copiar imagem'}
          </Button>
        }
      >
        {statusPorUnidade.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Sem dados ainda.</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-center">Concluídos</TableHead>
                <TableHead className="text-center">Em tratativa</TableHead>
                <TableHead className="text-center">Pendente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statusPorUnidade.map(({ unidade, concluido, em_andamento, pendente }) => (
                <TableRow key={unidade.codigo} className="border-gray-200/30 dark:border-gray-700/30">
                  <TableCell className="text-sm">{unidade.nome}</TableCell>
                  <TableCell className="text-center"><CelulaContagem valor={concluido} corClasse={STATUS_PILL.concluido} /></TableCell>
                  <TableCell className="text-center"><CelulaContagem valor={em_andamento} corClasse={STATUS_PILL.em_andamento} /></TableCell>
                  <TableCell className="text-center"><CelulaContagem valor={pendente} corClasse={STATUS_PILL.pendente} /></TableCell>
                </TableRow>
              ))}
              <TableRow className="border-gray-200/30 bg-muted/40 dark:border-gray-700/30 hover:bg-muted/40">
                <TableCell className="text-sm font-semibold">Total</TableCell>
                <TableCell className="text-center"><CelulaContagem valor={totaisStatus.concluido} corClasse={STATUS_PILL.concluido} /></TableCell>
                <TableCell className="text-center"><CelulaContagem valor={totaisStatus.em_andamento} corClasse={STATUS_PILL.em_andamento} /></TableCell>
                <TableCell className="text-center"><CelulaContagem valor={totaisStatus.pendente} corClasse={STATUS_PILL.pendente} /></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </TableCard>
    </div>
  )
}
