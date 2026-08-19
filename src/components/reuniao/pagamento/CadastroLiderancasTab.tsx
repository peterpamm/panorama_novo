import { useEffect, useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { ORDEM_SETORES_CADASTRO, SETOR_LABEL, filiaisDoSetorPagamento, resolverFilialSetor } from '@/lib/reuniao-pagamento'
import { parseLiderancasFile, type ParsedLiderancaRow } from '@/lib/reuniao-pagamento-parser'
import { MODELO_LIDERANCAS_PAGAMENTO } from '@/lib/modelos-importacao'
import { BotaoModeloPlanilha } from '@/components/importacao/BotaoModeloPlanilha'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import type { ReuniaoPagamentoLideranca, SetorPagamento } from '@/types'

const FORM_INICIAL = { setor: '' as SetorPagamento | '', filialChave: '', nome: '', numeroExtratta: '' }

/**
 * Cadastro das lideranças que recebem o prêmio da Reunião Resultados
 * (Reunião Resultados > Pagamento). Dois jeitos de manter em dia: cadastro
 * manual (um por um, com Filial já restrita às combinações válidas do setor
 * escolhido — nunca deixa cadastrar Camaçari sem dizer Rota/Armazém) e
 * importação em massa (planilha FILIAL/SETOR/LIDERANÇA/NÚMERO EXTRATTA,
 * upsert por unidade+negócio+setor+nome — reimportar só atualiza quem
 * mudou, não apaga o resto).
 */
export function CadastroLiderancasTab() {
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const [liderancas, setLiderancas] = useState<ReuniaoPagamentoLideranca[]>([])
  const [carregando, setCarregando] = useState(true)

  async function carregar() {
    setCarregando(true)
    const { data, error } = await supabase.from('reuniao_pagamento_liderancas').select('*').order('setor').order('nome')
    if (error) toast({ title: 'Erro ao carregar lideranças', description: error.message, variant: 'destructive' })
    setLiderancas((data as ReuniaoPagamentoLideranca[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const nomesUnidade = useMemo(() => new Map(unidades.map(u => [u.codigo, u.nome])), [unidades])

  function nomeFilial(l: { unidade: string; negocio: string; setor: SetorPagamento }): string {
    return filiaisDoSetorPagamento(unidades, l.setor).find(p => p.unidade === l.unidade && p.negocio === l.negocio)?.nome
      ?? nomesUnidade.get(l.unidade) ?? l.unidade
  }

  // ── Filtros da tabela ────────────────────────────────────────────────────
  const [filtroSetor, setFiltroSetor] = useState<SetorPagamento | 'todos'>('todos')
  const [filtroFilialChave, setFiltroFilialChave] = useState('todas')
  const [filtroNome, setFiltroNome] = useState('')

  const opcoesFiltroFilial = useMemo(() => {
    const vistas = new Map<string, string>()
    for (const l of liderancas) vistas.set(`${l.unidade}|${l.negocio}`, nomeFilial(l))
    return [...vistas.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [liderancas, unidades]) // eslint-disable-line react-hooks/exhaustive-deps

  const liderancasFiltradas = useMemo(() => {
    const busca = filtroNome.trim().toLowerCase()
    return liderancas.filter(l =>
      (filtroSetor === 'todos' || l.setor === filtroSetor)
      && (filtroFilialChave === 'todas' || `${l.unidade}|${l.negocio}` === filtroFilialChave)
      && (busca === '' || l.nome.toLowerCase().includes(busca)),
    )
  }, [liderancas, filtroSetor, filtroFilialChave, filtroNome])

  // ── Cadastro manual ──────────────────────────────────────────────────────
  const [editando, setEditando] = useState<ReuniaoPagamentoLideranca | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [dialogAberto, setDialogAberto] = useState(false)

  const opcoesFilial = useMemo(
    () => (form.setor ? filiaisDoSetorPagamento(unidades, form.setor) : []),
    [unidades, form.setor],
  )

  function abrirNova() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setDialogAberto(true)
  }

  function abrirEdicao(l: ReuniaoPagamentoLideranca) {
    setEditando(l)
    setForm({ setor: l.setor, filialChave: `${l.unidade}|${l.negocio}`, nome: l.nome, numeroExtratta: l.numero_extratta })
    setDialogAberto(true)
  }

  async function handleSalvar() {
    const nome = form.nome.trim()
    const numeroExtratta = form.numeroExtratta.trim()
    if (!form.setor || !form.filialChave || !nome || !numeroExtratta) {
      toast({ title: 'Preencha setor, filial, nome e número Extratta', variant: 'destructive' })
      return
    }
    const [unidade, negocio] = form.filialChave.split('|')
    setSalvando(true)
    const payload = { unidade, negocio, setor: form.setor, nome, numero_extratta: numeroExtratta }
    const { error } = editando?.id
      ? await supabase.from('reuniao_pagamento_liderancas').update(payload).eq('id', editando.id)
      : await supabase.from('reuniao_pagamento_liderancas').insert(payload)
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar liderança', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: editando ? 'Liderança atualizada' : 'Liderança cadastrada' })
    setDialogAberto(false)
    await carregar()
  }

  const [excluindo, setExcluindo] = useState<ReuniaoPagamentoLideranca | null>(null)
  const [excluindoSalvando, setExcluindoSalvando] = useState(false)

  async function handleExcluir() {
    if (!excluindo?.id) return
    setExcluindoSalvando(true)
    const { error } = await supabase.from('reuniao_pagamento_liderancas').delete().eq('id', excluindo.id)
    setExcluindoSalvando(false)
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Liderança removida' })
    setExcluindo(null)
    await carregar()
  }

  // ── Importação em massa ──────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null)
  const [linhas, setLinhas] = useState<ParsedLiderancaRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseLiderancasFile(f)
      setLinhas(resultado.linhas)
      setErrosParse(resultado.erros)
    } catch (err) {
      setLinhas([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  function limparImportacao() {
    setFile(null)
    setLinhas([])
    setErrosParse([])
  }

  const resolucao = useMemo(() => {
    const resolvidas: { linha: ParsedLiderancaRow; unidade: string; negocio: string }[] = []
    const naoResolvidas: string[] = []
    for (const linha of linhas) {
      if (!linha.setor) {
        naoResolvidas.push(`${linha.nome}: setor "${linha.setorTexto}" não reconhecido`)
        continue
      }
      const alvo = resolverFilialSetor(linha.filialTexto, linha.setor, unidades)
      if (!alvo) {
        naoResolvidas.push(`${linha.nome}: filial "${linha.filialTexto}" não reconhecida pro setor ${SETOR_LABEL[linha.setor]}`)
        continue
      }
      resolvidas.push({ linha, unidade: alvo.unidade, negocio: alvo.negocio })
    }
    return { resolvidas, naoResolvidas }
  }, [linhas, unidades])

  async function handleImportar() {
    const registros = resolucao.resolvidas.map(({ linha, unidade, negocio }) => ({
      unidade, negocio, setor: linha.setor!, nome: linha.nome, numero_extratta: linha.numeroExtratta,
    }))
    if (registros.length === 0) return
    setImportando(true)
    try {
      const { error } = await supabase
        .from('reuniao_pagamento_liderancas')
        .upsert(registros, { onConflict: 'unidade,negocio,setor,nome' })
      if (error) throw new Error(error.message)
      toast({ title: `${registros.length} liderança(s) importada(s) com sucesso` })
      limparImportacao()
      await carregar()
    } catch (err) {
      toast({ title: 'Erro ao importar lideranças', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Suba a planilha (Excel ou CSV) com as colunas{' '}
            <span className="font-mono text-xs">FILIAL · SETOR · LIDERANÇA · NÚMERO EXTRATTA</span> — reimportar só
            atualiza quem já existe (por unidade+negócio+setor+nome), sem apagar o resto. Em caso de dúvida, baixe a
            planilha padrão.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilePickerButton label="Planilha (.xlsx ou .csv)" accept=".xlsx,.xls,.csv,.txt" file={file} onFile={handleFile} />
          <BotaoModeloPlanilha nomeArquivo="modelo_liderancas_pagamento" abas={MODELO_LIDERANCAS_PAGAMENTO} />
        </div>

        {linhas.length > 0 && (
          <div className="rounded-lg border border-gray-200/60 p-3 text-xs dark:border-gray-700/60">
            {resolucao.resolvidas.length} de {linhas.length} linha(s) reconhecida(s):{' '}
            {resolucao.resolvidas.map(r => r.linha.nome).join(' · ')}
          </div>
        )}

        {errosParse.length > 0 && (
          <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
            <p className="mb-1 font-semibold">{errosParse.length} problema(s) no arquivo:</p>
            <ul className="max-h-32 space-y-0.5 overflow-y-auto">{errosParse.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}

        {resolucao.naoResolvidas.length > 0 && (
          <div className="rounded-lg border border-red-300/50 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            <p className="mb-1 font-semibold">
              {resolucao.naoResolvidas.length} linha(s) não reconhecida(s) — cadastre à mão abaixo ou corrija a planilha:
            </p>
            <ul className="max-h-32 space-y-0.5 overflow-y-auto">{resolucao.naoResolvidas.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}

        {file && (
          <div className="flex items-center gap-3">
            <Button onClick={handleImportar} disabled={resolucao.resolvidas.length === 0 || importando} className="gap-2">
              {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar {resolucao.resolvidas.length} liderança(s)
            </Button>
            <Button variant="outline" onClick={limparImportacao} disabled={importando}>Cancelar</Button>
          </div>
        )}
      </div>

      <TableCard
        titulo="Lideranças cadastradas"
        subtitulo={
          carregando
            ? 'Carregando...'
            : liderancasFiltradas.length === liderancas.length
              ? `${liderancas.length} pessoa(s)`
              : `${liderancasFiltradas.length} de ${liderancas.length} pessoa(s)`
        }
        acoes={
          <Button size="sm" onClick={abrirNova} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova liderança
          </Button>
        }
      >
        {!carregando && liderancas.length > 0 && (
          <div className="flex flex-wrap items-end gap-3 border-b border-gray-200/60 p-3 dark:border-gray-700/60">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Setor</Label>
              <Select value={filtroSetor} onValueChange={v => setFiltroSetor(v as SetorPagamento | 'todos')}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {ORDEM_SETORES_CADASTRO.map(s => <SelectItem key={s} value={s}>{SETOR_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Filial</Label>
              <Select value={filtroFilialChave} onValueChange={setFiltroFilialChave}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {opcoesFiltroFilial.map(([chave, nome]) => <SelectItem key={chave} value={chave}>{nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Liderança</Label>
              <Input value={filtroNome} onChange={e => setFiltroNome(e.target.value)} placeholder="Buscar por nome..." className="w-48" />
            </div>
            {(filtroSetor !== 'todos' || filtroFilialChave !== 'todas' || filtroNome !== '') && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => { setFiltroSetor('todos'); setFiltroFilialChave('todas'); setFiltroNome('') }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        )}

        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : liderancas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma liderança cadastrada ainda.</p>
        ) : liderancasFiltradas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma liderança encontrada com esse filtro.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setor</TableHead>
                <TableHead>Filial</TableHead>
                <TableHead>Liderança</TableHead>
                <TableHead>Número Extratta</TableHead>
                <TableHead className="w-24 text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {liderancasFiltradas.map(l => (
                <TableRow key={l.id} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="text-sm font-medium">{SETOR_LABEL[l.setor]}</TableCell>
                  <TableCell className="text-sm">{nomeFilial(l)}</TableCell>
                  <TableCell className="text-sm">{l.nome}</TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">{l.numero_extratta}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => abrirEdicao(l)} aria-label={`Editar ${l.nome}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400" onClick={() => setExcluindo(l)} aria-label={`Excluir ${l.nome}`}>
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

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar liderança' : 'Nova liderança'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Setor</Label>
                <Select
                  value={form.setor}
                  onValueChange={v => setForm(f => ({ ...f, setor: v as SetorPagamento, filialChave: '' }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {ORDEM_SETORES_CADASTRO.map(s => <SelectItem key={s} value={s}>{SETOR_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Filial</Label>
                <Select
                  value={form.filialChave}
                  onValueChange={v => setForm(f => ({ ...f, filialChave: v }))}
                  disabled={!form.setor}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {opcoesFilial.map(p => (
                      <SelectItem key={`${p.unidade}|${p.negocio}`} value={`${p.unidade}|${p.negocio}`}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lideranca-nome">Nome</Label>
              <Input id="lideranca-nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lideranca-extratta">Número Extratta</Label>
              <Input id="lideranca-extratta" value={form.numeroExtratta} onChange={e => setForm(f => ({ ...f, numeroExtratta: e.target.value }))} placeholder="Número do cartão" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={excluindo !== null} onOpenChange={v => { if (!v) setExcluindo(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir liderança</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remover <span className="font-semibold text-foreground">{excluindo?.nome}</span> do cadastro? Se ela vencer
            um setor depois de removida, o relatório de pagamento não vai incluir essa pessoa.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)} disabled={excluindoSalvando}>Cancelar</Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={excluindoSalvando} className="gap-2">
              {excluindoSalvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
