import { useEffect, useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { parseTermometroFile, type ParsedTermometroRow } from '@/lib/reuniao-termometro-parser'
import { negocioParaImportacao } from '@/lib/reuniao-resultados'
import { negocioPorPrefixo, resolverUnidade } from '@/lib/unidade-resolver'
import { FilePickerButton } from '@/components/importacao/FilePickerButton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { ReuniaoIndicador, ReuniaoSetor, Unidade } from '@/types'

const BATCH_SIZE = 500
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const ANOS_IMPORT = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

interface ImportacaoTermometroTabProps {
  setor: ReuniaoSetor
}

/**
 * Importa a pontuação mensal do Termômetro (fonte='termometro') — planilha
 * simples (Unidade + a pontuação, cabeçalho da 2ª coluna é o nome do mês, ver
 * `reuniao-termometro-parser.ts`), um mês/ano por arquivo, escolhido abaixo
 * (histórico fica guardado por mês em `reuniao_resultados_mensais`, mesma
 * tabela do lançamento manual — só que preenchida em lote em vez de célula a
 * célula). Precisa existir um indicador `fonte='termometro'` cadastrado
 * pro setor/ano antes de importar.
 */
export function ImportacaoTermometroTab({ setor }: ImportacaoTermometroTabProps) {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [anoImport, setAnoImport] = useState(String(new Date().getFullYear()))
  const [mesImport, setMesImport] = useState(String(new Date().getMonth() + 1))
  const [indicador, setIndicador] = useState<ReuniaoIndicador | null>(null)
  const [carregandoIndicador, setCarregandoIndicador] = useState(true)

  const [file, setFile] = useState<File | null>(null)
  const [linhas, setLinhas] = useState<ParsedTermometroRow[]>([])
  const [errosParse, setErrosParse] = useState<string[]>([])
  const [importando, setImportando] = useState(false)

  useEffect(() => {
    async function buscarIndicador() {
      setCarregandoIndicador(true)
      const { data } = await supabase
        .from('reuniao_resultados_indicadores')
        .select('*')
        .eq('setor', setor)
        .eq('ano', Number(anoImport))
        .eq('fonte', 'termometro')
        .eq('ativo', true)
        .maybeSingle()
      setIndicador((data as ReuniaoIndicador | null) ?? null)
      setCarregandoIndicador(false)
    }
    buscarIndicador()
  }, [setor, anoImport])

  async function handleFile(f: File) {
    setFile(f)
    try {
      const resultado = await parseTermometroFile(f)
      setLinhas(resultado.linhas)
      setErrosParse(resultado.erros)
    } catch (err) {
      setLinhas([])
      setErrosParse([`Erro ao ler o arquivo: ${String(err)}`])
    }
  }

  const resolucao = useMemo(() => {
    const resolvidas: { linha: ParsedTermometroRow; unidade: Unidade; negocio: string }[] = []
    const naoReconhecidas = new Set<string>()
    for (const linha of linhas) {
      const unidade = resolverUnidade(linha.unidade, unidades)
      if (unidade) {
        const negocio = negocioParaImportacao(unidade, negocioPorPrefixo(linha.unidade), setor)
        resolvidas.push({ linha, unidade, negocio })
      } else {
        naoReconhecidas.add(linha.unidade)
      }
    }
    return { resolvidas, naoReconhecidas: Array.from(naoReconhecidas).sort() }
  }, [linhas, unidades, setor])

  async function handleImportar() {
    if (!indicador) return
    const mes = Number(mesImport)
    const registros = resolucao.resolvidas.map(({ linha, unidade, negocio }) => ({
      indicador_id: indicador.id, unidade: unidade.codigo, negocio, mes, resultado: linha.valor,
    }))
    if (registros.length === 0) return

    setImportando(true)
    try {
      for (let i = 0; i < registros.length; i += BATCH_SIZE) {
        const batch = registros.slice(i, i + BATCH_SIZE)
        const { error } = await supabase.from('reuniao_resultados_mensais').upsert(batch, { onConflict: 'indicador_id,unidade,negocio,mes' })
        if (error) throw new Error(error.message)
      }
      toast({
        title: `${registros.length} pontuação(ões) do Termômetro importada(s)`,
        description: `${MESES_NOMES[mes - 1]}/${anoImport}.`,
      })
      setFile(null)
      setLinhas([])
      setErrosParse([])
    } catch (err) {
      toast({ title: 'Erro ao importar pontuação do Termômetro', description: String(err), variant: 'destructive' })
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="max-w-xl space-y-3">
      <h2 className="text-base font-semibold">Termômetro — pontuação mensal</h2>
      <p className="text-sm text-muted-foreground">
        Suba a planilha (Excel ou CSV) com as colunas <span className="font-mono text-xs">Unidade</span> e a pontuação
        do mês (o nome da 2ª coluna não importa — é lida pela posição, não pelo texto do cabeçalho). Cada arquivo é a
        pontuação de um único mês/ano, escolhido abaixo — fica guardado por mês, pra manter o histórico.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Select value={anoImport} onValueChange={setAnoImport}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS_IMPORT.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mês</Label>
          <Select value={mesImport} onValueChange={setMesImport}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <FilePickerButton label="Planilha (.xlsx ou .csv)" accept=".xlsx,.xls,.csv,.txt" file={file} onFile={handleFile} />
      </div>

      {carregandoIndicador ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verificando indicador cadastrado...
        </div>
      ) : !indicador ? (
        <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          Nenhum indicador com fonte "Termômetro" cadastrado pra {anoImport} — cadastre em Cadastro antes de importar.
        </div>
      ) : (
        <>
          {errosParse.length > 0 && (
            <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-3 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
              <p className="mb-1 font-semibold">{errosParse.length} problema(s) no arquivo:</p>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto">
                {errosParse.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {resolucao.naoReconhecidas.length > 0 && (
            <div className="rounded-lg border border-red-300/50 bg-red-50 p-3 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              <p className="mb-1 font-semibold">
                {resolucao.naoReconhecidas.length} unidade(s) não reconhecida(s) — cadastre como apelido na Administração e suba de novo:
              </p>
              <ul className="max-h-32 space-y-0.5 overflow-y-auto font-mono">
                {resolucao.naoReconhecidas.map(o => <li key={o}>{o}</li>)}
              </ul>
            </div>
          )}

          {file && (
            <div className="flex items-center gap-3">
              <Button onClick={handleImportar} disabled={resolucao.resolvidas.length === 0 || importando} className="gap-2">
                {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Importar {resolucao.resolvidas.length} pontuação(ões)
              </Button>
              <Button variant="outline" onClick={() => { setFile(null); setLinhas([]); setErrosParse([]) }} disabled={importando}>
                Cancelar
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
