import { useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { parseLimpaPautaFile, type ParsedLimpaPautaRow } from '@/lib/limpa-pauta-parser'
import { resolverUnidadeFlexivel } from '@/lib/unidade-resolver'
import { MODELO_LIMPA_PAUTA } from '@/lib/modelos-importacao'
import { BotaoModeloPlanilha } from '@/components/importacao/BotaoModeloPlanilha'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { Unidade } from '@/types'

const BATCH_SIZE = 500
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const ANOS_IMPORT = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

interface ImportacaoLimpaPautaTabProps {
  unidades: Unidade[]
  onImportado: () => void
}

/**
 * Importação do Limpa Pauta — planilha exportada do Freightech (usa
 * Segmentos/Unidades/Descrição/Status/Valor solicitado/Categoria; a
 * exportação completa vem com várias outras colunas — Obs. GOD, Solicitante
 * etc — que ficam de fora de propósito, ver `limpa-pauta-parser.ts`).
 * "Descrição" vira a Observação do registro. A planilha não traz
 * competência (Ano/Mês) — é escolhida aqui, um Ano/Mês por arquivo (mesmo
 * padrão do Termômetro, `ImportacaoTermometroTab`). O nome da unidade é
 * resolvido com `resolverUnidadeFlexivel` antes de importar — linhas cuja
 * unidade não bate com nenhuma cadastrada ficam de fora e aparecem na lista
 * de avisos (o admin cadastra um apelido em Administração > Unidades e
 * reimporta). Deduplicação por `id_freightech` (coluna "Id" da exportação
 * completa, UNIQUE no banco): reimportar a mesma planilha não duplica — as
 * linhas cujo Id já existe são ignoradas (upsert com `ignoreDuplicates`,
 * nunca sobrescreve o que já tinha, inclusive as aprovações internas já
 * preenchidas). Planilhas sem a coluna Id continuam sem dedup (sempre
 * entram como novas), já que não existe chave pra comparar.
 */
export function ImportacaoLimpaPautaTab({ unidades, onImportado }: ImportacaoLimpaPautaTabProps) {
  const { user, role } = useAuth()
  const { toast } = useToast()

  const [anoImport, setAnoImport] = useState(String(new Date().getFullYear()))
  const [mesImport, setMesImport] = useState(String(new Date().getMonth() + 1))

  const [file, setFile] = useState<File | null>(null)
  const [linhas, setLinhas] = useState<ParsedLimpaPautaRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseLimpaPautaFile(f)
      setLinhas(resultado.linhas)
      setErrosParse(resultado.erros)
    } catch (err) {
      setLinhas([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  function codigoConhecido(nome: string): string | undefined {
    return resolverUnidadeFlexivel(nome, unidades)?.codigo
  }

  const validas = useMemo(
    () => linhas
      .map(l => ({ ...l, unidade: codigoConhecido(l.unidadeNomeExtraido) }))
      .filter((l): l is ParsedLimpaPautaRow & { unidade: string } => l.unidade !== undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linhas, unidades],
  )

  const desconhecidas = useMemo(
    () => Array.from(new Set(linhas.filter(l => !codigoConhecido(l.unidadeNomeExtraido)).map(l => l.unidadeNomeOriginal))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [linhas, unidades],
  )

  async function handleImportar() {
    const registros = validas.map(l => ({
      ano: Number(anoImport),
      mes: Number(mesImport),
      unidade: l.unidade,
      unidade_planilha: l.unidadeNomeOriginal,
      id_freightech: l.idFreightech,
      segmento: l.segmento,
      categoria: l.categoria,
      status_freightech: l.status,
      valor_solicitado: l.valor,
      observacao: l.descricao,
      criado_por_email: user?.email ?? null,
      criado_por_role: role,
    }))
    if (registros.length === 0) return

    setImportando(true)
    try {
      let inseridos = 0
      for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE)
        // ignoreDuplicates: linha cujo id_freightech já existe é ignorada
        // (nunca atualizada) — reimportar a mesma planilha não duplica nem
        // sobrescreve aprovações já preenchidas. Sem id_freightech (null),
        // nunca colide, então sempre entra como linha nova.
        const { data, error } = await supabase
          .from('limpa_pauta')
          .upsert(batch, { onConflict: 'id_freightech', ignoreDuplicates: true })
          .select('id')
        if (error) throw new Error(error.message)
        inseridos += data?.length ?? 0
      }
      const duplicadas = registros.length - inseridos
      toast({
        title: `${inseridos} linha(s) importada(s)`,
        description: `Competência ${MESES_NOMES[Number(mesImport) - 1]}/${anoImport}.`
          + (duplicadas > 0 ? ` ${duplicadas} já existia(m) (ignorada(s)).` : ''),
      })
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
      <h2 className="text-base font-semibold">Importação do Limpa Pauta</h2>
      <p className="text-sm text-muted-foreground">
        Planilha exportada do Freightech com as colunas Segmentos, Unidades, Status, Valor solicitado e Categoria
        (Descrição e Id são opcionais — Id evita duplicar linha ao reimportar a mesma planilha).
        A competência (Ano/Mês) não vem na planilha — escolha abaixo antes de importar.
      </p>

      <div className="grid max-w-xs grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Mês</Label>
          <Select value={mesImport} onValueChange={setMesImport}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Select value={anoImport} onValueChange={setAnoImport}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS_IMPORT.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <FilePickerButton label="Planilha (.xlsx/.csv)" accept=".xlsx,.xls,.csv" file={file} onFile={handleFile} />
        <BotaoModeloPlanilha nomeArquivo="modelo_limpa_pauta" abas={MODELO_LIMPA_PAUTA} />
      </div>

      {errosParse.length > 0 && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <p className="mb-1 font-semibold">{errosParse.length} problema(s) no arquivo:</p>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto">
            {errosParse.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {desconhecidas.length > 0 && (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <p className="mb-1 font-semibold">
            {desconhecidas.length} unidade(s) da planilha não foram reconhecidas e ficaram de fora da importação:
          </p>
          <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono">
            {desconhecidas.map(u => <li key={u}>{u}</li>)}
          </ul>
        </div>
      )}

      {file && (
        <div className="flex items-center gap-3">
          <Button onClick={handleImportar} disabled={validas.length === 0 || importando} className="gap-2">
            {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Importar {validas.length} linha(s)
          </Button>
          <Button variant="outline" onClick={() => { setFile(null); setLinhas([]); setErrosParse([]) }} disabled={importando}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  )
}
