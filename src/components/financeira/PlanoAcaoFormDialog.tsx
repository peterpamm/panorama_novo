import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { SDG_INDICADORES_GERENTES } from '@/lib/sdg-indicadores'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import type { PlanoAcao, PlanoAcaoTag, SdgIndicador, Unidade } from '@/types'

const SEM_TAG = '__sem_tag__'
/** Sentinela do seletor "Categoria" — não é uma tag de verdade, dispara o 2º seletor (qual indicador) abaixo. */
const SDG_GERENTES = '__sdg_gerentes__'
const FORM_INICIAL = { unidade: '', titulo: '', descricao: '', responsavel: '', prazo: '' }

interface PlanoAcaoFormDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  editando: PlanoAcao | null
  /** Editar um plano já existente continua exclusivo do admin (o botão de editar nem aparece pra quem não é) — só CRIAR foi liberado geral. */
  isAdmin: boolean
  /** Unidade de quem está logado — trava o campo Unidade ao criar (não-admin só cria pra própria unidade, ver migration_091). */
  minhaUnidade: string | null
  unidades: Unidade[]
  /** Catálogo padrão (só as ativas, sem a tag "Corporativo" pra quem não é dono) — ver Plano de Ação > Cadastro. */
  tags: PlanoAcaoTag[]
  onSalvo: () => void
  /** Chamado quando uma tag "SDG Gerentes" nova é criada na hora (ver `resolverTagFinal`) — recarrega o catálogo de tags no pai, senão a próxima ação pro mesmo indicador criaria uma tag duplicada. */
  onTagCriada?: () => void
}

/**
 * Criar ação é liberado a qualquer usuário logado (cada unidade só pra ela
 * mesma — o campo Unidade vem travado nesse caso); editar um plano já
 * existente continua exclusivo do admin, já que quem abre esse dialog em
 * modo edição só chega lá pelo botão de lápis (admin-only, ver
 * PlanoAcaoDetalhe).
 *
 * O campo "Categoria" junta tag normal + "SDG Gerentes" (que abre um 2º
 * seletor "Qual indicador") — por baixo continua sendo uma tag só
 * (`planos_acao.tag`, igual sempre foi), só que pras 8 tags "SDG Gerentes ·
 * X" (ver `SDG_INDICADORES_GERENTES`) o usuário nunca precisa procurar elas
 * na lista nem saber que existem: escolhe a categoria "SDG Gerentes" + o
 * indicador, e a tag certa é encontrada (ou criada na hora, se ainda não
 * existir) em `resolverTagFinal`.
 */
export function PlanoAcaoFormDialog({ open, onOpenChange, editando, isAdmin, minhaUnidade, unidades, tags, onSalvo, onTagCriada }: PlanoAcaoFormDialogProps) {
  const { user, role } = useAuth()
  const { toast } = useToast()
  const [form, setForm] = useState(FORM_INICIAL)
  const [categoriaTag, setCategoriaTag] = useState<string>(SEM_TAG)
  const [indicadorGerentes, setIndicadorGerentes] = useState<SdgIndicador | ''>('')
  const [salvando, setSalvando] = useState(false)

  // Tags "SDG Gerentes" ficam fora da lista normal do seletor de Categoria —
  // só aparecem via o 2º seletor (por indicador), não misturadas com Custos/
  // Processo/etc.
  const tagsNormais = useMemo(() => tags.filter(t => !t.sdg_indicador?.startsWith('gerentes-')), [tags])

  useEffect(() => {
    if (!open) return
    if (editando) {
      const tagAtual = tags.find(t => t.nome === editando.tag)
      const ehGerentes = tagAtual?.sdg_indicador?.startsWith('gerentes-') ?? false
      setForm({
        unidade: editando.unidade,
        titulo: editando.titulo,
        descricao: editando.descricao,
        responsavel: editando.responsavel,
        prazo: editando.prazo,
      })
      setCategoriaTag(ehGerentes ? SDG_GERENTES : (editando.tag || SEM_TAG))
      setIndicadorGerentes(ehGerentes ? (tagAtual!.sdg_indicador as SdgIndicador) : '')
    } else {
      setForm({ ...FORM_INICIAL, unidade: isAdmin ? '' : (minhaUnidade ?? '') })
      setCategoriaTag(SEM_TAG)
      setIndicadorGerentes('')
    }
  }, [open, editando, isAdmin, minhaUnidade, tags])

  /** Resolve a Categoria/indicador escolhidos pro nome de tag de verdade a gravar em `planos_acao.tag` — cria a tag "SDG Gerentes · X" na hora, na primeira vez que alguém usa aquele indicador. */
  async function resolverTagFinal(): Promise<string> {
    if (categoriaTag === SEM_TAG) return ''
    if (categoriaTag !== SDG_GERENTES) return categoriaTag
    const existente = tags.find(t => t.sdg_indicador === indicadorGerentes)
    if (existente) return existente.nome
    const label = SDG_INDICADORES_GERENTES.find(i => i.id === indicadorGerentes)?.label ?? String(indicadorGerentes)
    const { data, error } = await supabase.from('planos_acao_tags')
      .insert({ nome: label, ativo: true, ordem: 0, sdg_indicador: indicadorGerentes })
      .select()
      .single()
    if (error) throw new Error(error.message)
    onTagCriada?.()
    return (data as PlanoAcaoTag).nome
  }

  async function handleSalvar() {
    const titulo = form.titulo.trim()
    if (!form.unidade || !titulo || !form.prazo) {
      toast({ title: 'Preencha unidade, título e prazo', variant: 'destructive' })
      return
    }
    if (categoriaTag === SDG_GERENTES && !indicadorGerentes) {
      toast({ title: 'Selecione qual indicador do SDG Gerentes', variant: 'destructive' })
      return
    }
    setSalvando(true)
    let tagFinal: string
    try {
      tagFinal = await resolverTagFinal()
    } catch (err) {
      setSalvando(false)
      toast({ title: 'Erro ao vincular tag', description: String(err), variant: 'destructive' })
      return
    }
    const payload = {
      unidade: form.unidade,
      titulo,
      descricao: form.descricao.trim(),
      responsavel: form.responsavel.trim(),
      tag: tagFinal,
      prazo: form.prazo,
    }
    const { error } = editando
      ? await supabase.from('planos_acao').update(payload).eq('id', editando.id)
      : await supabase.from('planos_acao').insert({
          ...payload,
          status: 'pendente',
          criado_por_email: user?.email ?? null,
          criado_por_role: role,
        })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar ação', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: editando ? 'Ação atualizada' : 'Ação criada' })
    onOpenChange(false)
    onSalvo()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar ação' : 'Nova ação'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={form.unidade} onValueChange={v => setForm(f => ({ ...f, unidade: v }))} disabled={!isAdmin}>
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
            <div className="space-y-1.5">
              <Label htmlFor="plano-prazo">Prazo</Label>
              <Input id="plano-prazo" type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plano-titulo">Título</Label>
            <Input id="plano-titulo" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Corrigir divergência de estoque no fechamento" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plano-descricao">Descrição</Label>
            <Textarea id="plano-descricao" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Detalhes da ação (opcional)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plano-responsavel">Responsável</Label>
              <Input
                id="plano-responsavel"
                value={form.responsavel}
                onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))}
                placeholder="Nome de quem toca a ação"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoriaTag} onValueChange={v => { setCategoriaTag(v); if (v !== SDG_GERENTES) setIndicadorGerentes('') }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_TAG}>Sem tag</SelectItem>
                  <SelectItem value={SDG_GERENTES}>SDG Gerentes...</SelectItem>
                  {tagsNormais.map(t => (
                    <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {categoriaTag === SDG_GERENTES && (
            <div className="space-y-1.5">
              <Label>Qual indicador do SDG Gerentes</Label>
              <Select value={indicadorGerentes} onValueChange={v => setIndicadorGerentes(v as SdgIndicador)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {SDG_INDICADORES_GERENTES.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.label.replace('SDG Gerentes · ', '')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
