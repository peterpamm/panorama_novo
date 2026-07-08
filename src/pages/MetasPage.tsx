import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { useNegocios } from '@/hooks/useNegocios'
import { useMetas } from '@/hooks/useMetas'
import { useMetasPerdas } from '@/hooks/useMetasPerdas'
import { CONTA_RECEITA, NOME_RECEITA, PACOTES } from '@/lib/constants'
import { ImportarMetasDialog } from '@/components/metas/ImportarMetasDialog'
import { ImportarMetasPerdasDialog } from '@/components/metas/ImportarMetasPerdasDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrencyInteiro } from '@/lib/utils'

const MESES_LABEL: Record<number, string> = {
  0: 'Anual', 1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho',
  7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro',
}

const FORM_INICIAL = {
  unidade: '', negocio: '', ano: String(new Date().getFullYear()), codigo: '', mes: '0', metaAvr: '',
}

const FORM_PERDAS_INICIAL = {
  unidade: '', ano: String(new Date().getFullYear()), metaPct: '', metaAnual: '',
}

function MetasGeraisTab() {
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const { negocios } = useNegocios()

  const [filtroUnidade, setFiltroUnidade] = useState('')
  const { metas, loading, recarregar } = useMetas(filtroUnidade || null)

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)

  const metasOrdenadas = useMemo(
    () => [...metas].sort((a, b) => a.negocio.localeCompare(b.negocio) || b.ano - a.ano || a.codigo.localeCompare(b.codigo) || a.mes - b.mes),
    [metas],
  )

  function abrirDialog() {
    setForm({ ...FORM_INICIAL, unidade: filtroUnidade })
    setOpen(true)
  }

  async function handleSalvar() {
    const ano = Number(form.ano)
    const mes = Number(form.mes)
    const metaAvr = Number(form.metaAvr.replace(',', '.'))
    if (!form.unidade || !form.negocio || !form.codigo || !form.ano || form.metaAvr === '' || Number.isNaN(metaAvr)) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const { error } = await supabase
      .from('metas')
      .upsert({ unidade: form.unidade, negocio: form.negocio, ano, codigo: form.codigo, mes, meta_avr: metaAvr }, { onConflict: 'unidade,negocio,ano,codigo,mes' })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar meta', description: error.message, variant: 'destructive' })
      return
    }
    setOpen(false)
    if (form.unidade === filtroUnidade) recarregar()
    toast({ title: 'Meta salva com sucesso' })
  }

  async function handleExcluir(id: string | undefined) {
    if (!id) return
    const { error } = await supabase.from('metas').delete().eq('id', id)
    if (error) {
      toast({ title: 'Erro ao excluir meta', description: error.message, variant: 'destructive' })
      return
    }
    recarregar()
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Metas usadas só quando o período importado não traz AVO (meta por conta já calculada pelo GInfo) —
        ex: arquivos antigos, ou indicadores que não correspondem a uma conta do plano de contas.
      </p>

      <div className="flex items-end justify-between gap-4">
        <div className="w-64 space-y-1.5">
          <Label>Unidade</Label>
          <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
            <SelectTrigger><SelectValue placeholder="Selecione uma unidade" /></SelectTrigger>
            <SelectContent>
              {unidades.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <ImportarMetasDialog unidades={unidades} negocios={negocios} onImportado={recarregar} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2" onClick={abrirDialog}><Plus className="h-4 w-4" />Nova meta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova meta</DialogTitle></DialogHeader>
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
                  <Label>Negócio</Label>
                  <Select value={form.negocio} onValueChange={v => setForm(f => ({ ...f, negocio: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {negocios.map(n => <SelectItem key={n.codigo} value={n.codigo}>{n.nome} ({n.codigo})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Ano</Label>
                  <Input type="number" value={form.ano} onChange={e => setForm(f => ({ ...f, ano: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mês</Label>
                  <Select value={form.mes} onValueChange={v => setForm(f => ({ ...f, mes: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MESES_LABEL).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Pacote</Label>
                  <Select value={form.codigo} onValueChange={v => setForm(f => ({ ...f, codigo: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CONTA_RECEITA}>{NOME_RECEITA} ({CONTA_RECEITA})</SelectItem>
                      {Object.entries(PACOTES).map(([codigo, info]) => (
                        <SelectItem key={codigo} value={codigo}>{info.nome} ({codigo})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Meta AVR (%)</Label>
                  <Input value={form.metaAvr} onChange={e => setForm(f => ({ ...f, metaAvr: e.target.value }))} placeholder="Ex: 85,00" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSalvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!filtroUnidade ? (
        <p className="text-sm text-muted-foreground">Selecione uma unidade para ver as metas cadastradas.</p>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Negócio</TableHead>
                  <TableHead>Ano</TableHead>
                  <TableHead>Pacote</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead>Meta (%)</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>)}
                    </TableRow>
                  ))
                ) : metasOrdenadas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-6">
                      Nenhuma meta manual cadastrada para esta unidade.
                    </TableCell>
                  </TableRow>
                ) : (
                  metasOrdenadas.map(m => (
                    <TableRow key={m.id}>
                      <TableCell>{m.negocio}</TableCell>
                      <TableCell>{m.ano}</TableCell>
                      <TableCell>{m.codigo === CONTA_RECEITA ? NOME_RECEITA : PACOTES[m.codigo]?.nome ?? m.codigo}</TableCell>
                      <TableCell>{MESES_LABEL[m.mes] ?? m.mes}</TableCell>
                      <TableCell>{m.meta_avr.toFixed(2)}%</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleExcluir(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MetasPerdasTab() {
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const { metasPerdas, loading, recarregar } = useMetasPerdas()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(FORM_PERDAS_INICIAL)
  const [salvando, setSalvando] = useState(false)

  const nomesUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  const metasOrdenadas = useMemo(
    () => [...metasPerdas].sort((a, b) => {
      const nomeA = nomesUnidade.get(a.unidade) ?? a.unidade
      const nomeB = nomesUnidade.get(b.unidade) ?? b.unidade
      return b.ano - a.ano || nomeA.localeCompare(nomeB)
    }),
    [metasPerdas, nomesUnidade],
  )

  function abrirDialog() {
    setForm(FORM_PERDAS_INICIAL)
    setOpen(true)
  }

  async function handleSalvar() {
    const ano = Number(form.ano)
    const metaPct = Number(form.metaPct.replace(',', '.'))
    const metaAnual = Number(form.metaAnual.replace(',', '.'))
    if (!form.unidade || !form.ano || form.metaPct === '' || Number.isNaN(metaPct) || form.metaAnual === '' || Number.isNaN(metaAnual)) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const { error } = await supabase
      .from('metas_perdas')
      .upsert({ unidade: form.unidade, ano, meta_pct: metaPct, meta_anual: metaAnual }, { onConflict: 'unidade,ano' })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar meta de perdas', description: error.message, variant: 'destructive' })
      return
    }
    setOpen(false)
    recarregar()
    toast({ title: 'Meta de perdas salva com sucesso' })
  }

  async function handleExcluir(id: string | undefined) {
    if (!id) return
    const { error } = await supabase.from('metas_perdas').delete().eq('id', id)
    if (error) {
      toast({ title: 'Erro ao excluir meta de perdas', description: error.message, variant: 'destructive' })
      return
    }
    recarregar()
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Meta de Perdas: só por unidade e ano (sempre consolidado) — base do Painel de Perdas.
        Guarda a meta percentual (sobre o faturamento) e a meta financeira anual; a meta mensal exibida abaixo é o anual dividido por 12.
      </p>

      <div className="flex items-end justify-end gap-2">
        <ImportarMetasPerdasDialog unidades={unidades} onImportado={recarregar} />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={abrirDialog}><Plus className="h-4 w-4" />Nova meta de perdas</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova meta de perdas</DialogTitle></DialogHeader>
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Meta Anual (%)</TableHead>
                <TableHead>Meta Mensal (R$)</TableHead>
                <TableHead>Meta Anual (R$)</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>)}
                  </TableRow>
                ))
              ) : metasOrdenadas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-6">
                    Nenhuma meta de perdas cadastrada ainda.
                  </TableCell>
                </TableRow>
              ) : (
                metasOrdenadas.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>{nomesUnidade.get(m.unidade) ?? m.unidade}</TableCell>
                    <TableCell>{m.ano}</TableCell>
                    <TableCell>{m.meta_pct.toFixed(2)}%</TableCell>
                    <TableCell>{formatCurrencyInteiro(m.meta_anual / 12)}</TableCell>
                    <TableCell>{formatCurrencyInteiro(m.meta_anual)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleExcluir(m.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export function MetasPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="gerais">
        <TabsList>
          <TabsTrigger value="gerais">Metas Gerais</TabsTrigger>
          <TabsTrigger value="perdas">Metas de Perdas</TabsTrigger>
        </TabsList>
        <TabsContent value="gerais" className="pt-4">
          <MetasGeraisTab />
        </TabsContent>
        <TabsContent value="perdas" className="pt-4">
          <MetasPerdasTab />
        </TabsContent>
      </Tabs>
      <Toaster />
    </div>
  )
}
