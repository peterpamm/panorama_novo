import { useState } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useUnidades } from '@/hooks/useUnidades'
import { useNegocios } from '@/hooks/useNegocios'
import { parseDreXlsx, type ParseDreResult } from '@/lib/dre-xlsx-parser'
import { FileDropzone } from '@/components/importacao/FileDropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'

type Stage = 'idle' | 'preview' | 'importing' | 'done'

const BATCH_SIZE = 200
const BLOCO_LABEL: Record<string, string> = {
  jan: 'Janeiro', fev: 'Fevereiro', mar: 'Março', abr: 'Abril', mai: 'Maio', jun: 'Junho',
  jul: 'Julho', ago: 'Agosto', set: 'Setembro', out: 'Outubro', nov: 'Novembro', dez: 'Dezembro',
  total: 'Total (acumulado)',
}

export function ImportacaoDrePage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { unidades } = useUnidades()
  const { negocios } = useNegocios()

  const [stage, setStage] = useState<Stage>('idle')
  const [selUnidade, setSelUnidade] = useState('')
  const [selNegocio, setSelNegocio] = useState('')
  const [selAno, setSelAno] = useState(String(new Date().getFullYear()))
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParseDreResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [resumo, setResumo] = useState<{ contas: number } | null>(null)

  const formCompleto = Boolean(selUnidade && selNegocio && selAno && file)

  async function handleAnalisar() {
    if (!file) return
    try {
      const result = await parseDreXlsx(file)
      if (result.linhas.length === 0) {
        toast({ title: 'Nenhuma conta encontrada', description: 'Verifique se o arquivo é o relatório DRE do GInfo.', variant: 'destructive' })
        return
      }
      setParsed(result)
      setStage('preview')
    } catch (err) {
      toast({ title: 'Erro ao ler arquivo', description: String(err), variant: 'destructive' })
    }
  }

  async function handleImportar() {
    if (!parsed || !user) return
    setStage('importing')
    setProgress(0)
    try {
      const ano = Number(selAno)

      const { data: imp, error: impErr } = await supabase
        .from('importacoes')
        .insert({
          usuario_id: user.id,
          arquivo_nome: parsed.fileName,
          unidade: selUnidade,
          negocio: selNegocio,
          ano,
          total_linhas: parsed.linhas.length,
          meses_no_arquivo: parsed.blocosDetectados.filter(b => b !== 'total').length,
        })
        .select('id')
        .single()
      if (impErr) throw new Error(impErr.message)

      const linhas = parsed.linhas.map(l => ({
        unidade: selUnidade,
        negocio: selNegocio,
        ano,
        conta_codigo: l.conta_codigo,
        ...l.campos,
        importacao_id: imp.id,
      }))

      for (let i = 0; i < linhas.length; i += BATCH_SIZE) {
        const batch = linhas.slice(i, i + BATCH_SIZE)
        const { error } = await supabase
          .from('dre_lancamentos')
          .upsert(batch, { onConflict: 'unidade,negocio,ano,conta_codigo' })
        if (error) throw new Error(error.message)
        setProgress(Math.round(((i + batch.length) / linhas.length) * 100))
      }

      setResumo({ contas: linhas.length })
      setStage('done')
    } catch (err) {
      toast({ title: 'Erro na importação', description: String(err), variant: 'destructive' })
      setStage('preview')
    }
  }

  function handleReset() {
    setStage('idle')
    setFile(null)
    setParsed(null)
    setResumo(null)
    setProgress(0)
  }

  if (stage === 'done' && resumo) {
    return (
      <div className="max-w-md space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <CardTitle>Importação concluída</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {selUnidade} • {selNegocio} • {selAno}
            </p>
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <div className="text-3xl font-bold text-green-700">{resumo.contas}</div>
              <div className="text-sm text-green-600">contas importadas/atualizadas</div>
            </div>
            <Button onClick={handleReset} variant="outline" className="w-full">Nova importação</Button>
          </CardContent>
        </Card>
        <Toaster />
      </div>
    )
  }

  if (stage === 'importing') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Importando... {progress}%</p>
        <div className="w-64 rounded-full bg-muted h-2">
          <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    )
  }

  if (stage === 'preview' && parsed) {
    return (
      <div className="max-w-md space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Arquivo</span>
              <span className="font-medium">{parsed.fileName}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Destino</span>
              <span className="font-medium">{selUnidade} • {selNegocio} • {selAno}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Contas encontradas</span>
              <span className="font-semibold">{parsed.linhas.length}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Blocos detectados: </span>
              <span className="font-medium">{parsed.blocosDetectados.map(b => BLOCO_LABEL[b] ?? b).join(', ')}</span>
            </div>
          </CardContent>
        </Card>
        <div className="flex gap-3">
          <Button onClick={handleImportar}>Confirmar importação</Button>
          <Button variant="outline" onClick={() => setStage('idle')}>Cancelar</Button>
        </div>
        <Toaster />
      </div>
    )
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Unidade</Label>
          <Select value={selUnidade} onValueChange={setSelUnidade}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {unidades.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Negócio</Label>
          <Select value={selNegocio} onValueChange={setSelNegocio}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {negocios.map(n => <SelectItem key={n.codigo} value={n.codigo}>{n.nome} ({n.codigo})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Input type="number" value={selAno} onChange={e => setSelAno(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Relatório DRE (.xlsx exportado do GInfo)</h2>
        <FileDropzone
          label="Exportação anual da DRE, com os meses já acumulados"
          file={file}
          onFile={setFile}
        />
      </div>

      <Button onClick={handleAnalisar} disabled={!formCompleto}>Analisar arquivo</Button>
      <Toaster />
    </div>
  )
}
