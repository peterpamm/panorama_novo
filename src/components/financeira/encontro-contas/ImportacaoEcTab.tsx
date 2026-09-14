import { useMemo, useState } from 'react'
import { ListTree, Loader2, Plus, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { parseEncontroContasFile, type ParsedEncontroContasRow } from '@/lib/encontro-contas-parser'
import { MODELO_ENCONTRO_CONTAS } from '@/lib/modelos-importacao'
import { BotaoModeloPlanilha } from '@/components/importacao/BotaoModeloPlanilha'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { hojeIso } from '@/lib/encontro-contas'
import { parseNumeroPtBr } from '@/lib/utils'
import { MotivosCadastroDialog } from './MotivosCadastroDialog'
import type { EncontroContas, EncontroContasMotivo, Unidade } from '@/types'

const BATCH_SIZE = 500

interface ImportacaoEcTabProps {
  ecsExistentes: EncontroContas[]
  unidades: Unidade[]
  motivos: EncontroContasMotivo[]
  isAdmin: boolean
  onImportado: () => void
  onMotivosAtualizados: () => void
}

/**
 * Importação (Etapa 4 do plano): planilha Data/Descrição/Valor — a Unidade
 * não vem daqui (é atribuída depois em Tratativas, um EC pode virar N
 * linhas de unidades diferentes via "Desmembrar"). Todo EC importado entra
 * como `pendente`. Avisa (não bloqueia) quando o número do chamado já
 * existe no banco, pra não reimportar a mesma planilha sem querer. O
 * cadastro de Motivos (admin) mora aqui — mais perto do fluxo de "cheguei
 * uma planilha nova" do que da tela de Tratativas.
 */
export function ImportacaoEcTab({ ecsExistentes, unidades, motivos, isAdmin, onImportado, onMotivosAtualizados }: ImportacaoEcTabProps) {
  const { user, role } = useAuth()
  const { toast } = useToast()

  const [file, setFile] = useState<File | null>(null)
  const [linhas, setLinhas] = useState<ParsedEncontroContasRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)
  const [motivosDialogAberto, setMotivosDialogAberto] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseEncontroContasFile(f)
      setLinhas(resultado.linhas)
      setErrosParse(resultado.erros)
    } catch (err) {
      setLinhas([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  const chamadosExistentes = useMemo(() => new Set(ecsExistentes.map(e => e.numero_chamado)), [ecsExistentes])
  const possiveisDuplicatas = useMemo(
    () => Array.from(new Set(linhas.filter(l => chamadosExistentes.has(l.numeroChamado)).map(l => l.numeroChamado))).sort(),
    [linhas, chamadosExistentes],
  )

  async function handleImportar() {
    const registros = linhas.map(l => ({
      data: l.data,
      descricao_original: l.descricaoOriginal,
      numero_chamado: l.numeroChamado,
      solicitante: l.solicitante,
      valor: l.valor,
      status: 'pendente',
      tem_evidencia: true, // já entra flegado — a maioria tem evidência anexada no chamado do Drive; admin desmarca na exceção
      criado_por_email: user?.email ?? null,
      criado_por_role: role,
    }))
    if (registros.length === 0) return

    setImportando(true)
    try {
      for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from('encontro_contas').insert(batch)
        if (error) throw new Error(error.message)
      }
      toast({ title: `${registros.length} EC(s) importado(s)`, description: 'Todos entraram como Pendente — atribua a unidade em Tratativas.' })
      setFile(null)
      setLinhas([])
      setErrosParse([])
      onImportado()
    } catch (err) {
      toast({ title: 'Erro ao importar', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  // ── EC avulso (admin lança 1 na mão, sem precisar reimportar a planilha inteira) ──
  const AVULSO_INICIAL = { data: hojeIso(), numeroChamado: '', solicitante: '', valor: '', unidade: '__sem__' }
  const [avulsoAberto, setAvulsoAberto] = useState(false)
  const [avulso, setAvulso] = useState(AVULSO_INICIAL)
  const [salvandoAvulso, setSalvandoAvulso] = useState(false)

  function abrirAvulso() {
    setAvulso(AVULSO_INICIAL)
    setAvulsoAberto(true)
  }

  async function handleSalvarAvulso() {
    const valor = parseNumeroPtBr(avulso.valor.replace(/R\$\s*/gi, ''))
    if (!avulso.data || !avulso.numeroChamado.trim() || !avulso.solicitante.trim() || valor <= 0) {
      toast({ title: 'Preencha data, chamado, solicitante e um valor válido', variant: 'destructive' })
      return
    }
    setSalvandoAvulso(true)
    const { error } = await supabase.from('encontro_contas').insert({
      data: avulso.data,
      descricao_original: `EC - ${avulso.numeroChamado.trim()} - ${avulso.solicitante.trim()}`,
      numero_chamado: avulso.numeroChamado.trim(),
      solicitante: avulso.solicitante.trim(),
      valor,
      unidade: avulso.unidade === '__sem__' ? null : avulso.unidade,
      status: 'pendente',
      tem_evidencia: true,
      criado_por_email: user?.email ?? null,
      criado_por_role: role,
    })
    setSalvandoAvulso(false)
    if (error) {
      toast({ title: 'Erro ao incluir EC', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'EC incluído', description: avulso.unidade === '__sem__' ? 'Atribua a unidade em Tratativas.' : undefined })
    setAvulsoAberto(false)
    onImportado()
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">Importação de ECs</h2>
        {isAdmin && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={abrirAvulso}>
              <Plus className="h-4 w-4" />
              EC avulso
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setMotivosDialogAberto(true)}>
              <ListTree className="h-4 w-4" />
              Motivos
            </Button>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Planilha com as colunas Data, Descrição e Valor — a Descrição precisa seguir o padrão
        "EC - &lt;chamado&gt; - &lt;nome de quem abriu&gt;" (ex: "EC - R14602322 - Vinicius Etges Silveira"). Todo EC
        importado entra como Pendente, sem unidade — atribua depois na aba Tratativas (um EC de mais de uma unidade
        pode ser desmembrado lá).
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <FilePickerButton label="Planilha (.xlsx/.csv)" accept=".xlsx,.xls,.csv" file={file} onFile={handleFile} />
        <BotaoModeloPlanilha nomeArquivo="modelo_encontro_contas" abas={MODELO_ENCONTRO_CONTAS} />
      </div>

      {errosParse.length > 0 && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <p className="mb-1 font-semibold">{errosParse.length} problema(s) no arquivo:</p>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto">
            {errosParse.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {possiveisDuplicatas.length > 0 && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <p className="mb-1 font-semibold">
            {possiveisDuplicatas.length} chamado(s) já existem no banco — confira se essa planilha já não foi importada antes de continuar:
          </p>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono">
            {possiveisDuplicatas.map(c => <li key={c}>{c}</li>)}
          </ul>
        </div>
      )}

      {file && (
        <div className="flex items-center gap-3">
          <Button onClick={handleImportar} disabled={linhas.length === 0 || importando} className="gap-2">
            {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar {linhas.length} EC(s)
          </Button>
          <Button variant="outline" onClick={() => { setFile(null); setLinhas([]); setErrosParse([]) }} disabled={importando}>
            Cancelar
          </Button>
        </div>
      )}

      <MotivosCadastroDialog open={motivosDialogAberto} onOpenChange={setMotivosDialogAberto} motivos={motivos} onAtualizado={onMotivosAtualizados} />

      {/* ── Dialog de EC avulso ── */}
      <Dialog open={avulsoAberto} onOpenChange={v => { if (!v) setAvulsoAberto(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Incluir EC avulso</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Pra lançar 1 EC que surgiu depois da planilha, sem precisar reimportar tudo de novo.
          </p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ec-avulso-data">Data</Label>
                <Input id="ec-avulso-data" type="date" value={avulso.data} onChange={e => setAvulso(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ec-avulso-chamado">Nº do chamado</Label>
                <Input
                  id="ec-avulso-chamado"
                  value={avulso.numeroChamado}
                  onChange={e => setAvulso(f => ({ ...f, numeroChamado: e.target.value }))}
                  placeholder="R14602322"
                />
              </div>
            </div>
            {avulso.numeroChamado.trim() !== '' && chamadosExistentes.has(avulso.numeroChamado.trim()) && (
              <p className="text-xs text-amber-700 dark:text-amber-400">Já existe um EC com esse número de chamado no banco.</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ec-avulso-solicitante">Quem abriu</Label>
              <Input
                id="ec-avulso-solicitante"
                value={avulso.solicitante}
                onChange={e => setAvulso(f => ({ ...f, solicitante: e.target.value }))}
                placeholder="Nome de quem abriu o chamado"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ec-avulso-valor">Valor</Label>
                <Input id="ec-avulso-valor" value={avulso.valor} onChange={e => setAvulso(f => ({ ...f, valor: e.target.value }))} placeholder="1.234,56" />
              </div>
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Select value={avulso.unidade} onValueChange={v => setAvulso(f => ({ ...f, unidade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__sem__">Definir depois</SelectItem>
                    {unidades.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvulsoAberto(false)} disabled={salvandoAvulso}>Cancelar</Button>
            <Button onClick={handleSalvarAvulso} disabled={salvandoAvulso} className="gap-2">
              {salvandoAvulso && <Loader2 className="h-4 w-4 animate-spin" />}
              Incluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
