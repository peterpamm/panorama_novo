import { useMemo, useState } from 'react'
import { ListTree, Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { parseEncontroContasFile, type ParsedEncontroContasRow } from '@/lib/encontro-contas-parser'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { MotivosCadastroDialog } from './MotivosCadastroDialog'
import type { EncontroContas, EncontroContasMotivo } from '@/types'

const BATCH_SIZE = 500

interface ImportacaoEcTabProps {
  ecsExistentes: EncontroContas[]
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
export function ImportacaoEcTab({ ecsExistentes, motivos, isAdmin, onImportado, onMotivosAtualizados }: ImportacaoEcTabProps) {
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

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold">Importação de ECs</h2>
        {isAdmin && (
          <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={() => setMotivosDialogAberto(true)}>
            <ListTree className="h-4 w-4" />
            Motivos
          </Button>
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
    </div>
  )
}
