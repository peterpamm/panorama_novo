import { useEffect, useState } from 'react'
import { Loader2, Pencil, TriangleAlert, UserPlus } from 'lucide-react'
import { useUnidades } from '@/hooks/useUnidades'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import { criarUsuario } from '@/lib/admin-users-api'
import { concederPagina, listarPermissoesAgrupadas, revogarPagina, type UsuarioComPermissoes } from '@/lib/permissoes-api'
import { PAGINAS, type PaginaChave } from '@/lib/permissoes'
import { opcoesNegocioSplit, unidadeSplitNegocio } from '@/lib/rv-gente'

const FORM_INICIAL = { email: '', senha: '', role: 'unidade' as 'admin' | 'unidade', unidade: '', negocio: '' }
const GRUPOS = Array.from(new Set(PAGINAS.map(p => p.grupo)))

function PaginasCheckboxGrid({ prefixo, selecionadas, onToggle }: {
  prefixo: string
  selecionadas: Set<PaginaChave>
  onToggle: (pagina: PaginaChave) => void
}) {
  return (
    <div className="space-y-4">
      {GRUPOS.map(grupo => (
        <div key={grupo}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{grupo}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            {PAGINAS.filter(p => p.grupo === grupo).map(p => (
              <div key={p.chave} className="flex items-center gap-1.5">
                <Checkbox
                  id={`${prefixo}-${p.chave}`}
                  checked={selecionadas.has(p.chave)}
                  onCheckedChange={() => onToggle(p.chave)}
                />
                <Label htmlFor={`${prefixo}-${p.chave}`} className="cursor-pointer text-sm font-normal">{p.label}</Label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * "Criar" via `signUp` isolado (ver admin-users-api.ts); "Matriz de
 * permissões" via `permissoes_paginas` (ver permissoes-api.ts) — as duas só
 * funcionam de fato pro dono (RLS exige `auth_dono()`), mas essa tela só é
 * alcançável por ele mesmo (Administração é `donoApenas`, ver App.tsx).
 * Trocar acesso/senha ou excluir um usuário já existente continua sendo no
 * dashboard do Supabase — isso sim exige a Admin API (service_role).
 */
export function UsuariosTab() {
  const { unidades } = useUnidades()
  const { toast } = useToast()

  const [form, setForm] = useState(FORM_INICIAL)
  const [paginasNovoUsuario, setPaginasNovoUsuario] = useState<Set<PaginaChave>>(new Set())
  const [salvando, setSalvando] = useState(false)

  // Unidades com 2 gerentes (Camaçari e Ponta Grossa — cada uma abre Rota e
  // Armazém como negócio separado) — precisa escolher de qual negócio é
  // esse usuário, senão o Painel Geral da RV mistura a liderança dos dois
  // gerentes.
  const unidadeSelecionada = unidades.find(u => u.codigo === form.unidade)
  const precisaNegocio = form.role === 'unidade' && !!unidadeSelecionada && unidadeSplitNegocio(unidadeSelecionada.codigo, unidadeSelecionada.nome)
  // Camaçari é Rota+Armazém, Ponta Grossa é Empurrada+Armazém — nunca o mesmo par (ver opcoesNegocioSplit).
  const opcoesNegocio = unidadeSelecionada ? opcoesNegocioSplit(unidadeSelecionada.codigo, unidadeSelecionada.nome) : []

  function toggleNovoUsuario(pagina: PaginaChave) {
    setPaginasNovoUsuario(prev => {
      const novo = new Set(prev)
      if (novo.has(pagina)) novo.delete(pagina)
      else novo.add(pagina)
      return novo
    })
  }

  async function handleCriar() {
    const email = form.email.trim()
    if (!email || !form.senha) {
      toast({ title: 'Preencha email e senha', variant: 'destructive' })
      return
    }
    if (form.senha.length < 6) {
      toast({ title: 'Senha precisa ter pelo menos 6 caracteres', variant: 'destructive' })
      return
    }
    if (form.role === 'unidade' && !form.unidade) {
      toast({ title: 'Selecione a unidade', variant: 'destructive' })
      return
    }
    if (precisaNegocio && !form.negocio) {
      toast({ title: 'Selecione de qual gerente/negócio é esse usuário', variant: 'destructive' })
      return
    }
    setSalvando(true)
    try {
      await criarUsuario({
        email,
        senha: form.senha,
        role: form.role,
        unidade: form.role === 'unidade' ? form.unidade : undefined,
        rvNegocio: precisaNegocio ? form.negocio : undefined,
        paginasIniciais: Array.from(paginasNovoUsuario),
      })
      toast({ title: 'Usuário criado', description: `${email} só ganha acesso depois de você rodar SELECT sync_auth_app_metadata(); no SQL Editor.` })
      setForm(FORM_INICIAL)
      setPaginasNovoUsuario(new Set())
      await carregarMatriz()
    } catch (err) {
      toast({ title: 'Erro ao criar usuário', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const [matriz, setMatriz] = useState<UsuarioComPermissoes[]>([])
  const [carregandoMatriz, setCarregandoMatriz] = useState(true)

  async function carregarMatriz() {
    setCarregandoMatriz(true)
    try {
      setMatriz(await listarPermissoesAgrupadas())
    } catch (err) {
      toast({ title: 'Erro ao carregar matriz de permissões', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
    } finally {
      setCarregandoMatriz(false)
    }
  }

  useEffect(() => { carregarMatriz() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [editando, setEditando] = useState<UsuarioComPermissoes | null>(null)

  async function toggleEditando(pagina: PaginaChave) {
    if (!editando) return
    const jaTem = editando.paginas.has(pagina)
    // otimista: atualiza a tela antes da resposta, reverte se der erro
    setEditando(prev => {
      if (!prev) return prev
      const paginas = new Set(prev.paginas)
      if (jaTem) paginas.delete(pagina)
      else paginas.add(pagina)
      return { ...prev, paginas }
    })
    try {
      if (jaTem) await revogarPagina(editando.userId, pagina)
      else await concederPagina(editando.userId, editando.email, pagina)
      setMatriz(prev => prev.map(u => u.userId === editando.userId
        ? { ...u, paginas: new Set(jaTem ? [...u.paginas].filter(p => p !== pagina) : [...u.paginas, pagina]) }
        : u))
    } catch (err) {
      toast({ title: 'Erro ao atualizar permissão', description: err instanceof Error ? err.message : undefined, variant: 'destructive' })
      setEditando(prev => {
        if (!prev) return prev
        const paginas = new Set(prev.paginas)
        if (jaTem) paginas.add(pagina)
        else paginas.delete(pagina)
        return { ...prev, paginas }
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Cria o login de uma unidade ou de mais alguém do financeiro (admin) direto por aqui, sem abrir o Supabase.
            Acesso "Admin" vê tudo, exceto o que ficar de fora das páginas marcadas abaixo — "Administração" nunca é
            liberável por aqui, é exclusiva do dono do sistema.
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Trocar email/senha ou excluir um usuário que já existe é direto no dashboard do Supabase
              (Authentication → Users) — isso exige uma chave que não dá pra guardar com segurança sem servidor. Se
              o login criado não conseguir entrar de primeira, confira em Supabase → Authentication → Providers →
              Email se "Confirm email" está desativado.
            </p>
          </div>
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-300/50 bg-red-50 p-3 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>Passo obrigatório:</strong> depois de criar o(s) usuário(s) aqui, vá no SQL Editor do Supabase e
              rode <code className="rounded bg-black/10 px-1 py-0.5 dark:bg-white/10">SELECT sync_auth_app_metadata();</code> —
              sem isso, o login é criado mas fica sem nenhum acesso liberado. Só precisa rodar uma vez, mesmo criando
              vários usuários seguidos — pode deixar todos criados e rodar só no final.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-w-2xl space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="usuario-email">Email</Label>
              <Input
                id="usuario-email"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="pessoa@empresa.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="usuario-senha">Senha</Label>
              <Input
                id="usuario-senha"
                type="password"
                value={form.senha}
                onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Acesso</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as 'admin' | 'unidade' }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidade">Unidade</SelectItem>
                    <SelectItem value="admin">Admin (financeiro)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.role === 'unidade' && (
                <div className="space-y-1.5">
                  <Label>Unidade</Label>
                  <Select value={form.unidade} onValueChange={v => setForm(f => ({ ...f, unidade: v, negocio: '' }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unidades.map(u => (
                        <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {precisaNegocio && (
                <div className="col-span-2 space-y-1.5">
                  <Label>Gerente de qual negócio?</Label>
                  <Select value={form.negocio} onValueChange={v => setForm(f => ({ ...f, negocio: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoesNegocio.map(o => (
                        <SelectItem key={o.valor} value={o.valor}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Essa unidade tem 2 gerentes — cada um só vai ver a própria liderança no Painel Geral da RV.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Páginas liberadas</Label>
              {form.role === 'unidade' && (
                <p className="text-xs text-muted-foreground">
                  A maioria das unidades só precisa de "Painel Geral" — Metas e Importação exigem acesso Admin pra
                  valer, mesmo se marcadas aqui.
                </p>
              )}
              <div className="rounded-lg border p-4">
                <PaginasCheckboxGrid prefixo="novo" selecionadas={paginasNovoUsuario} onToggle={toggleNovoUsuario} />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button onClick={handleCriar} disabled={salvando} className="gap-2">
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Criar usuário
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Matriz de permissões</CardTitle>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Quem já foi criado por aqui e o que cada um pode acessar. Editar muda na hora, sem precisar salvar.
          </p>
        </CardHeader>
        <CardContent>
          {carregandoMatriz ? (
            <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : matriz.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhum usuário criado por aqui ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-40 text-center">Páginas liberadas</TableHead>
                  <TableHead className="w-32 text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matriz.map(u => (
                  <TableRow key={u.userId}>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell className="text-center text-sm tabular-nums text-muted-foreground">{u.paginas.size}</TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setEditando(u)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editando !== null} onOpenChange={v => { if (!v) setEditando(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Permissões de {editando?.email}</DialogTitle>
          </DialogHeader>
          {editando && (
            <PaginasCheckboxGrid prefixo="editar" selecionadas={editando.paginas} onToggle={toggleEditando} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
