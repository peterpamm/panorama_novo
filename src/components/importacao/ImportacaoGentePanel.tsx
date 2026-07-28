import { useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Search, Trash2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { parseRvLiderancasFile, type ParsedRvLiderancaRow } from '@/lib/rv-liderancas-csv-parser'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { ImportarResultadosGente } from '@/components/importacao/ImportarResultadosGente'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrencyInteiro, parseNumeroPtBr } from '@/lib/utils'
import type { RvLideranca } from '@/types'

const BATCH_SIZE = 500

/** Aba "Gente" da Importação: sobe a RV das lideranças (upsert por nome) e lista o cadastro atual. */
export function ImportacaoGentePanel() {
  const { toast } = useToast()

  // ── Cadastro atual ─────────────────────────────────────────────────────────
  const [registros, setRegistros] = useState<RvLideranca[]>([])
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase
      .from('rv_liderancas')
      .select('*')
      .order('operacao')
      .order('nome')
    if (error) {
      toast({ title: 'Erro ao carregar RV das lideranças', description: error.message, variant: 'destructive' })
    }
    setRegistros((data as RvLideranca[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Importação ─────────────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null)
  const [linhas, setLinhas] = useState<ParsedRvLiderancaRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseRvLiderancasFile(f)
      setLinhas(resultado.linhas)
      setErrosParse(resultado.erros)
    } catch (err) {
      setLinhas([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  async function handleImportar() {
    setImportando(true)
    try {
      for (let i = 0; i < linhas.length; i += BATCH_SIZE) {
        const batch = linhas.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('rv_liderancas')
          .upsert(batch, { onConflict: 'nome' })
        if (error) throw new Error(error.message)
      }
      toast({ title: `${linhas.length} liderança(s) importada(s)/atualizada(s)` })
      setFile(null)
      setLinhas([])
      setErrosParse([])
      await carregar()
    } catch (err) {
      toast({ title: 'Erro ao importar RV', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  // ── Filtros da tabela ──────────────────────────────────────────────────────
  const [filtroOperacao, setFiltroOperacao] = useState('todas')
  const [filtroNegocio, setFiltroNegocio] = useState('todos')
  const [filtroSetor, setFiltroSetor] = useState('todos')
  const [filtroFuncao, setFiltroFuncao] = useState('todas')
  const [filtroNome, setFiltroNome] = useState('')

  const operacoesDisponiveis = useMemo(
    () => Array.from(new Set(registros.map(r => r.operacao))).sort(),
    [registros],
  )
  const negociosDisponiveis = useMemo(
    () => Array.from(new Set(registros.map(r => r.negocio).filter(n => n !== ''))).sort(),
    [registros],
  )
  const setoresDisponiveis = useMemo(
    () => Array.from(new Set(registros.map(r => r.setor).filter(s => s !== ''))).sort(),
    [registros],
  )
  const funcoesDisponiveis = useMemo(
    () => Array.from(new Set(registros.map(r => r.funcao))).sort(),
    [registros],
  )

  const registrosFiltrados = useMemo(() => {
    const busca = filtroNome.trim().toUpperCase()
    return registros.filter(r =>
      (filtroOperacao === 'todas' || r.operacao === filtroOperacao)
      && (filtroNegocio === 'todos' || r.negocio === filtroNegocio)
      && (filtroSetor === 'todos' || r.setor === filtroSetor)
      && (filtroFuncao === 'todas' || r.funcao === filtroFuncao)
      && (busca === '' || r.nome.includes(busca)),
    )
  }, [registros, filtroOperacao, filtroNegocio, filtroSetor, filtroFuncao, filtroNome])

  const filtroAtivo = filtroOperacao !== 'todas' || filtroNegocio !== 'todos' || filtroSetor !== 'todos' || filtroFuncao !== 'todas' || filtroNome.trim() !== ''
  const totalRv = useMemo(() => registrosFiltrados.reduce((acc, r) => acc + r.valor, 0), [registrosFiltrados])

  // ── Edição / exclusão ──────────────────────────────────────────────────────
  const [editando, setEditando] = useState<RvLideranca | null>(null)
  const [form, setForm] = useState({ operacao: '', negocio: '', setor: '', funcao: '', nome: '', valor: '' })
  const [excluindo, setExcluindo] = useState<RvLideranca | null>(null)
  const [salvando, setSalvando] = useState(false)

  function abrirEdicao(r: RvLideranca) {
    setForm({
      operacao: r.operacao,
      negocio: r.negocio,
      setor: r.setor,
      funcao: r.funcao,
      nome: r.nome,
      valor: r.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
    })
    setEditando(r)
  }

  async function handleSalvarEdicao() {
    if (!editando?.id) return
    const valor = parseNumeroPtBr(form.valor.replace(/R\$\s*/gi, ''))
    if (!form.nome.trim() || !form.operacao.trim() || valor <= 0) {
      toast({ title: 'Preencha operação, nome e um valor válido', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const { error } = await supabase
      .from('rv_liderancas')
      .update({
        operacao: form.operacao.trim().toUpperCase(),
        negocio: form.negocio.trim().toUpperCase(),
        setor: form.setor.trim().toUpperCase(),
        funcao: form.funcao.trim().toUpperCase(),
        nome: form.nome.trim().toUpperCase(),
        valor,
      })
      .eq('id', editando.id)
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Liderança atualizada' })
    setEditando(null)
    await carregar()
  }

  async function handleExcluir() {
    if (!excluindo?.id) return
    setSalvando(true)
    const { error } = await supabase.from('rv_liderancas').delete().eq('id', excluindo.id)
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: `${excluindo.nome} removido(a) do cadastro` })
    setExcluindo(null)
    await carregar()
  }

  const [excluindoFiltrados, setExcluindoFiltrados] = useState(false)

  async function handleExcluirFiltrados() {
    const ids = registrosFiltrados.map(r => r.id).filter((id): id is string => id !== undefined)
    if (ids.length === 0) return
    setSalvando(true)
    const { error } = await supabase.from('rv_liderancas').delete().in('id', ids)
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: `${ids.length} liderança(s) removida(s) do cadastro` })
    setExcluindoFiltrados(false)
    await carregar()
  }

  const [limpandoTudo, setLimpandoTudo] = useState(false)

  async function handleLimparTudo() {
    setSalvando(true)
    // delete sem filtro é bloqueado pelo PostgREST — usa um filtro que casa tudo
    const { error } = await supabase.from('rv_liderancas').delete().neq('nome', '')
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao limpar cadastro', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Cadastro de RV limpo' })
    setLimpandoTudo(false)
    await carregar()
  }

  return (
    <div className="space-y-6">
      {/* ── Upload (duas colunas) ── */}
      <div className="grid grid-cols-1 gap-8 border-b pb-6 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold">RV das Lideranças</h2>
          <p className="text-sm text-muted-foreground">
            Suba a planilha de RV (Excel ou CSV) com as colunas{' '}
            <span className="font-mono text-xs">OPERAÇÃO · NEGOCIO · SETOR · FUNÇÃO · NOME · VALOR</span>.
            O cadastro é atualizado pelo <strong>nome</strong> da liderança — reimportar substitui os valores existentes.
          </p>
          <FilePickerButton label="Planilha de RV (.xlsx ou .csv)" accept=".xlsx,.xls,.csv,.txt" file={file} onFile={handleFile} />

          {errosParse.length > 0 && (
            <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
              <p className="mb-1 font-semibold">{errosParse.length} linha(s) ignorada(s):</p>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto">
                {errosParse.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {file && (
            <div className="flex items-center gap-3">
              <Button onClick={handleImportar} disabled={linhas.length === 0 || importando} className="gap-2">
                {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Importar {linhas.length} liderança(s)
              </Button>
              <Button variant="outline" onClick={() => { setFile(null); setLinhas([]); setErrosParse([]) }} disabled={importando}>
                Cancelar
              </Button>
            </div>
          )}
        </div>

        <ImportarResultadosGente />
      </div>

      {/* ── Filtros ── */}
      {registros.length > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Unidade</Label>
            <Select value={filtroOperacao} onValueChange={setFiltroOperacao}>
              <SelectTrigger className={`w-52 ${selectGlamour}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {operacoesDisponiveis.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Negócio</Label>
            <Select value={filtroNegocio} onValueChange={setFiltroNegocio}>
              <SelectTrigger className={`w-40 ${selectGlamour}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {negociosDisponiveis.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {setoresDisponiveis.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Setor</Label>
              <Select value={filtroSetor} onValueChange={setFiltroSetor}>
                <SelectTrigger className={`w-44 ${selectGlamour}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {setoresDisponiveis.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Função</Label>
            <Select value={filtroFuncao} onValueChange={setFiltroFuncao}>
              <SelectTrigger className={`w-48 ${selectGlamour}`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {funcoesDisponiveis.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filtroNome}
                onChange={e => setFiltroNome(e.target.value)}
                placeholder="Buscar pessoa..."
                className={`w-64 pl-9 ${selectGlamour}`}
              />
            </div>
          </div>
          {filtroAtivo && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => { setFiltroOperacao('todas'); setFiltroNegocio('todos'); setFiltroSetor('todos'); setFiltroFuncao('todas'); setFiltroNome('') }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* ── Cadastro atual ── */}
      <TableCard
        titulo="RV cadastrada"
        subtitulo={carregando
          ? 'Carregando...'
          : filtroAtivo
            ? `${registrosFiltrados.length} de ${registros.length} liderança(s) · Total do filtro ${formatCurrencyInteiro(totalRv)}`
            : `${registros.length} liderança(s) · Total ${formatCurrencyInteiro(totalRv)}`}
        acoes={registros.length > 0 && (
          <>
            {filtroAtivo && registrosFiltrados.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-white/20 bg-white/10 text-white hover:bg-red-500/30 hover:text-white"
                onClick={() => setExcluindoFiltrados(true)}
              >
                <Trash2 className="h-4 w-4" />
                Excluir {registrosFiltrados.length} filtrado(s)
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-white/20 bg-white/10 text-white hover:bg-red-500/30 hover:text-white"
              onClick={() => setLimpandoTudo(true)}
            >
              <Trash2 className="h-4 w-4" />
              Limpar cadastro
            </Button>
          </>
        )}
      >
        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando cadastro...
          </div>
        ) : registros.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma liderança cadastrada ainda — importe a planilha acima.
          </p>
        ) : registrosFiltrados.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma liderança encontrada com esses filtros.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operação</TableHead>
                <TableHead>Negócio</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-center">Valor RV</TableHead>
                <TableHead className="w-24 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrosFiltrados.map(r => (
                <TableRow key={r.id ?? r.nome} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="text-sm font-medium">{r.operacao}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.negocio || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.setor || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.funcao}</TableCell>
                  <TableCell className="text-sm">{r.nome}</TableCell>
                  <TableCell className="text-center text-sm font-semibold tabular-nums">
                    {Math.round(r.valor).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => abrirEdicao(r)}
                        aria-label={`Editar ${r.nome}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400"
                        onClick={() => setExcluindo(r)}
                        aria-label={`Excluir ${r.nome}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      {/* ── Dialog de edição ── */}
      <Dialog open={editando !== null} onOpenChange={v => { if (!v) setEditando(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar liderança</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rv-operacao">Operação</Label>
                <Input id="rv-operacao" value={form.operacao} onChange={e => setForm(f => ({ ...f, operacao: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rv-negocio">Negócio</Label>
                <Input id="rv-negocio" value={form.negocio} onChange={e => setForm(f => ({ ...f, negocio: e.target.value }))} placeholder="ROTA / ARMAZEM..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rv-setor">Setor</Label>
                <Input id="rv-setor" value={form.setor} onChange={e => setForm(f => ({ ...f, setor: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rv-funcao">Função</Label>
                <Input id="rv-funcao" value={form.funcao} onChange={e => setForm(f => ({ ...f, funcao: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rv-nome">Nome</Label>
              <Input id="rv-nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rv-valor">Valor RV</Label>
              <Input id="rv-valor" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="400,00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditando(null)} disabled={salvando}>Cancelar</Button>
            <Button onClick={handleSalvarEdicao} disabled={salvando} className="gap-2">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog de excluir filtrados ── */}
      <Dialog open={excluindoFiltrados} onOpenChange={v => { if (!v) setExcluindoFiltrados(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir lideranças filtradas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remover as <span className="font-semibold text-foreground">{registrosFiltrados.length} liderança(s)</span> que
            estão no filtro atual? Essa ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindoFiltrados(false)} disabled={salvando}>Cancelar</Button>
            <Button variant="destructive" onClick={handleExcluirFiltrados} disabled={salvando} className="gap-2">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir {registrosFiltrados.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog de limpar tudo ── */}
      <Dialog open={limpandoTudo} onOpenChange={v => { if (!v) setLimpandoTudo(false) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Limpar cadastro de RV</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Excluir <span className="font-semibold text-foreground">todas as {registros.length} lideranças</span> cadastradas?
            Essa ação não pode ser desfeita — você vai precisar reimportar a planilha.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLimpandoTudo(false)} disabled={salvando}>Cancelar</Button>
            <Button variant="destructive" onClick={handleLimparTudo} disabled={salvando} className="gap-2">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir tudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog de confirmação de exclusão ── */}
      <Dialog open={excluindo !== null} onOpenChange={v => { if (!v) setExcluindo(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir liderança</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remover <span className="font-semibold text-foreground">{excluindo?.nome}</span> ({excluindo?.operacao}) do cadastro de RV?
            Essa ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)} disabled={salvando}>Cancelar</Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={salvando} className="gap-2">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
