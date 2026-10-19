import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useUnidades } from '@/hooks/useUnidades'
import { useSdgJustificativas } from '@/hooks/useSdgJustificativas'
import { SDG_INDICADORES } from '@/lib/sdg-indicadores'
import { comprimirImagem } from '@/lib/comprimir-imagem'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { SdgIndicador, SdgJustificativa } from '@/types'

const ANO_ATUAL = new Date().getFullYear()
const ANOS_OPCOES = [ANO_ATUAL + 1, ANO_ATUAL, ANO_ATUAL - 1]
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

interface Rascunho { pontos_positivos: string; pontos_negativos: string }

interface CardIndicadorProps {
  id: SdgIndicador
  label: string
  rascunho: Rascunho
  salvando: boolean
  enviandoPrint: boolean
  printPath: string | null
  onChange: (r: Rascunho) => void
  onSalvar: () => void
  onEnviarPrint: (file: File) => void
  onRemoverPrint: () => void
}

/** Um card de indicador — isolado num componente próprio pra poder buscar a signed URL do print (se tiver) com seu próprio hook, sem violar regra de hooks dentro de .map(). */
function CardIndicador({ id, label, rascunho, salvando, enviandoPrint, printPath, onChange, onSalvar, onEnviarPrint, onRemoverPrint }: CardIndicadorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [printUrl, setPrintUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!printPath) { setPrintUrl(null); return }
    let ativo = true
    supabase.storage.from('sdg-prints').createSignedUrl(printPath, 3600)
      .then(({ data }) => { if (ativo) setPrintUrl(data?.signedUrl ?? null) })
    return () => { ativo = false }
  }, [printPath])

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{label}</h3>
        <Button size="sm" onClick={onSalvar} disabled={salvando} className="gap-2">
          {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Salvar
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Print (opcional — JPEG ou PNG)</Label>
        {printUrl ? (
          <div className="relative inline-block">
            <img src={printUrl} alt="Print anexado" className="max-h-40 rounded-lg border" />
            <button
              onClick={onRemoverPrint}
              disabled={enviandoPrint}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 disabled:opacity-50"
              aria-label="Remover print"
              title="Remover print"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={enviandoPrint}
            className="flex h-24 w-40 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-muted-foreground/30 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/60 hover:text-foreground disabled:opacity-50"
          >
            {enviandoPrint ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            {enviandoPrint ? 'Enviando...' : 'Anexar print'}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) onEnviarPrint(file)
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-emerald-600 dark:text-emerald-400">Pontos Positivos</Label>
          <Textarea
            value={rascunho.pontos_positivos}
            onChange={e => onChange({ ...rascunho, pontos_positivos: e.target.value })}
            placeholder="Um ponto por linha..."
            className="min-h-[100px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-red-600 dark:text-red-400">Principais Impactos</Label>
          <Textarea
            value={rascunho.pontos_negativos}
            onChange={e => onChange({ ...rascunho, pontos_negativos: e.target.value })}
            placeholder="Um ponto por linha..."
            className="min-h-[100px]"
          />
        </div>
      </div>
    </Card>
  )
}

interface CardAssuntosGeraisProps {
  texto: string
  salvando: boolean
  onChange: (texto: string) => void
  onSalvar: () => void
}

/** Card do slide final "Assuntos Gerais" — texto livre, sem Pontos Positivos/Impactos nem print (diferente dos indicadores normais). */
function CardAssuntosGerais({ texto, salvando, onChange, onSalvar }: CardAssuntosGeraisProps) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Assuntos Gerais</h3>
        <Button size="sm" onClick={onSalvar} disabled={salvando} className="gap-2">
          {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Salvar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Assuntos que precisam de ajuda, ou outros assuntos importantes sobre o setor — aparece por último no modo
        apresentação, bem centralizado.
      </p>
      <Textarea
        value={texto}
        onChange={e => onChange(e.target.value)}
        placeholder="Um assunto por linha..."
        className="min-h-[140px]"
      />
    </Card>
  )
}

/**
 * Justificativa do SDG (Pontos Positivos/Principais Impactos + print opcional
 * por indicador × mês) — escrita aqui pela própria unidade (ou pelo admin em
 * nome dela) antes da reunião, e só exibida (read-only) no modo apresentação
 * (`/sdg-financeiro`).
 */
export function JustificativasSdgTab() {
  const { toast } = useToast()
  const { role, unidade: minhaUnidade } = useAuth()
  const isAdmin = role === 'admin'
  const { unidades } = useUnidades()
  const unidadesFiltro = useMemo(() => unidades.filter(u => u.codigo !== 'AMBEV'), [unidades])

  const [selUnidade, setSelUnidade] = useState('')
  const [ano, setAno] = useState(ANO_ATUAL)
  const [mes, setMes] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    if (selUnidade || unidadesFiltro.length === 0) return
    const inicial = isAdmin ? unidadesFiltro[0].codigo : minhaUnidade
    if (inicial) setSelUnidade(inicial)
  }, [unidadesFiltro, isAdmin, minhaUnidade, selUnidade])

  const { porIndicador, loading, recarregar } = useSdgJustificativas(selUnidade, ano, mes)

  const [rascunhos, setRascunhos] = useState<Partial<Record<SdgIndicador, Rascunho>>>({})
  useEffect(() => {
    const mapa: Partial<Record<SdgIndicador, Rascunho>> = {}
    for (const id of [...SDG_INDICADORES.map(i => i.id), 'assuntos-gerais' as const]) {
      const existente = porIndicador[id]
      mapa[id] = { pontos_positivos: existente?.pontos_positivos ?? '', pontos_negativos: existente?.pontos_negativos ?? '' }
    }
    setRascunhos(mapa)
  }, [porIndicador])

  const [salvando, setSalvando] = useState<SdgIndicador | null>(null)
  const [enviandoPrint, setEnviandoPrint] = useState<SdgIndicador | null>(null)

  async function salvar(indicador: SdgIndicador) {
    const rascunho = rascunhos[indicador]
    if (!rascunho || !selUnidade) return
    setSalvando(indicador)
    const { error } = await supabase.from('sdg_justificativas').upsert(
      {
        unidade: selUnidade,
        negocio: 'CONS',
        ano,
        mes,
        indicador,
        pontos_positivos: rascunho.pontos_positivos.trim(),
        pontos_negativos: rascunho.pontos_negativos.trim(),
      },
      { onConflict: 'unidade,negocio,ano,mes,indicador' },
    )
    setSalvando(null)
    if (error) {
      toast({ title: 'Erro ao salvar justificativa', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Justificativa salva' })
    await recarregar()
  }

  async function enviarPrint(indicador: SdgIndicador, file: File) {
    if (!selUnidade) return
    if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
      toast({ title: 'Formato inválido', description: 'Só aceita imagens JPEG ou PNG.', variant: 'destructive' })
      return
    }
    setEnviandoPrint(indicador)
    try {
      const comprimida = await comprimirImagem(file)
      const path = `${selUnidade}/${ano}-${mes}-${indicador}.jpg`
      const { error: erroUpload } = await supabase.storage
        .from('sdg-prints')
        .upload(path, comprimida, { upsert: true, contentType: 'image/jpeg' })
      if (erroUpload) throw erroUpload

      const rascunho = rascunhos[indicador] ?? { pontos_positivos: '', pontos_negativos: '' }
      const { error: erroUpsert } = await supabase.from('sdg_justificativas').upsert(
        {
          unidade: selUnidade,
          negocio: 'CONS',
          ano,
          mes,
          indicador,
          pontos_positivos: rascunho.pontos_positivos.trim(),
          pontos_negativos: rascunho.pontos_negativos.trim(),
          print_path: path,
        },
        { onConflict: 'unidade,negocio,ano,mes,indicador' },
      )
      if (erroUpsert) throw erroUpsert

      toast({ title: 'Print anexado' })
      await recarregar()
    } catch (err) {
      toast({ title: 'Erro ao anexar print', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setEnviandoPrint(null)
    }
  }

  async function removerPrint(indicador: SdgIndicador) {
    const atual: SdgJustificativa | undefined = porIndicador[indicador]
    if (!atual?.print_path) return
    setEnviandoPrint(indicador)
    try {
      await supabase.storage.from('sdg-prints').remove([atual.print_path])
      const { error } = await supabase.from('sdg_justificativas').update({ print_path: null }).eq('id', atual.id)
      if (error) throw error
      toast({ title: 'Print removido' })
      await recarregar()
    } catch (err) {
      toast({ title: 'Erro ao remover print', description: (err as Error).message, variant: 'destructive' })
    } finally {
      setEnviandoPrint(null)
    }
  }

  const nomeUnidadeSel = unidades.find(u => u.codigo === selUnidade)?.nome ?? selUnidade

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Pontos Positivos e Principais Impactos do mês, por indicador. Aparece só como leitura no modo apresentação
        (SDG Financeiro), junto das ações do Plano de Ação ligadas àquele indicador pela tag. Caso necessário anexe o
        print que irá aparecer no modo apresentação.
      </p>

      <Card className="flex flex-wrap items-end gap-4 p-4">
        {isAdmin && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Unidade</Label>
            <Select value={selUnidade} onValueChange={setSelUnidade}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                {unidadesFiltro.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {!isAdmin && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Unidade</Label>
            <p className="flex h-9 items-center text-sm font-medium text-foreground">{nomeUnidadeSel}</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS_OPCOES.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : (
        <div className="space-y-4">
          {SDG_INDICADORES.map(({ id, label }) => (
            <CardIndicador
              key={id}
              id={id}
              label={label}
              rascunho={rascunhos[id] ?? { pontos_positivos: '', pontos_negativos: '' }}
              salvando={salvando === id}
              enviandoPrint={enviandoPrint === id}
              printPath={porIndicador[id]?.print_path ?? null}
              onChange={r => setRascunhos(prev => ({ ...prev, [id]: r }))}
              onSalvar={() => salvar(id)}
              onEnviarPrint={file => enviarPrint(id, file)}
              onRemoverPrint={() => removerPrint(id)}
            />
          ))}
          <CardAssuntosGerais
            texto={rascunhos['assuntos-gerais']?.pontos_positivos ?? ''}
            salvando={salvando === 'assuntos-gerais'}
            onChange={texto => setRascunhos(prev => ({ ...prev, 'assuntos-gerais': { pontos_positivos: texto, pontos_negativos: '' } }))}
            onSalvar={() => salvar('assuntos-gerais')}
          />
        </div>
      )}
    </div>
  )
}
