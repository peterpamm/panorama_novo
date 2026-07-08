import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { slugParaNomeSugerido } from '@/lib/dre-filename-parser'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { Unidade } from '@/types'

interface LinhaResolverProps {
  slug: string
  unidades: Unidade[]
  onResolvido: (unidade: Unidade, codigoAntigo?: string) => void
}

function LinhaResolver({ slug, unidades, onResolvido }: LinhaResolverProps) {
  const { toast } = useToast()
  const [modo, setModo] = useState<'vincular' | 'nova'>(unidades.length > 0 ? 'vincular' : 'nova')
  const [codigoExistente, setCodigoExistente] = useState('')
  const [renomear, setRenomear] = useState(true)
  const [nome, setNome] = useState(slugParaNomeSugerido(slug))
  const [codigoNovo, setCodigoNovo] = useState(slug)
  const [salvando, setSalvando] = useState(false)

  const unidadeSelecionada = unidades.find(u => u.codigo === codigoExistente)

  async function handleResolver() {
    setSalvando(true)
    try {
      if (modo === 'vincular') {
        if (!unidadeSelecionada) {
          toast({ title: 'Selecione uma unidade', variant: 'destructive' })
          return
        }
        if (renomear && unidadeSelecionada.codigo !== slug) {
          const { error } = await supabase.rpc('renomear_unidade_codigo', { p_antigo: unidadeSelecionada.codigo, p_novo: slug })
          if (error) throw new Error(error.message)
          onResolvido({ ...unidadeSelecionada, codigo: slug }, unidadeSelecionada.codigo)
        } else {
          const { error } = await supabase.from('unidades').update({ nome_ginfo: slug }).eq('codigo', unidadeSelecionada.codigo)
          if (error) throw new Error(error.message)
          onResolvido({ ...unidadeSelecionada, nome_ginfo: slug })
        }
      } else {
        const { data, error } = await supabase
          .from('unidades')
          .insert({ codigo: codigoNovo, nome, nome_ginfo: slug })
          .select('*')
          .single()
        if (error) throw new Error(error.message)
        onResolvido(data as Unidade)
      }
      toast({ title: `Unidade "${slug}" reconhecida` })
    } catch (err) {
      toast({ title: 'Erro ao resolver unidade', description: String(err), variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-semibold text-foreground">Unidade não reconhecida: <span className="font-mono">{slug}</span></p>

        <RadioGroup className="flex gap-6" value={modo} onValueChange={v => setModo(v as 'vincular' | 'nova')}>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="vincular" id={`vincular-${slug}`} disabled={unidades.length === 0} />
            <Label htmlFor={`vincular-${slug}`} className="font-normal">Vincular a uma unidade existente</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="nova" id={`nova-${slug}`} />
            <Label htmlFor={`nova-${slug}`} className="font-normal">Cadastrar nova unidade</Label>
          </div>
        </RadioGroup>

        {modo === 'vincular' ? (
          <div className="space-y-2">
            <Select value={codigoExistente} onValueChange={setCodigoExistente}>
              <SelectTrigger className="max-w-sm"><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
              <SelectContent>
                {unidades.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome} ({u.codigo})</SelectItem>)}
              </SelectContent>
            </Select>
            {unidadeSelecionada && unidadeSelecionada.codigo !== slug && (
              <div className="flex items-center gap-2">
                <Checkbox id={`renomear-${slug}`} checked={renomear} onCheckedChange={c => setRenomear(c === true)} />
                <Label htmlFor={`renomear-${slug}`} className="text-sm font-normal">
                  Renomear código desta unidade pra <span className="font-mono">{slug}</span> (padroniza com o GInfo)
                </Label>
              </div>
            )}
          </div>
        ) : (
          <div className="grid max-w-sm grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Código</Label>
              <Input value={codigoNovo} onChange={e => setCodigoNovo(e.target.value.toUpperCase())} />
            </div>
          </div>
        )}

        <Button size="sm" onClick={handleResolver} disabled={salvando || (modo === 'vincular' && !codigoExistente)}>
          {salvando ? 'Salvando...' : 'Resolver'}
        </Button>
      </CardContent>
    </Card>
  )
}

interface ResolverUnidadesPanelProps {
  slugs: string[]
  unidades: Unidade[]
  onResolvido: (unidade: Unidade, codigoAntigo?: string) => void
}

/** Pra cada slug de unidade não reconhecido no nome dos arquivos, deixa vincular a uma unidade já existente (com opção de renomear o código) ou cadastrar uma nova. */
export function ResolverUnidadesPanel({ slugs, unidades, onResolvido }: ResolverUnidadesPanelProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {slugs.length} unidade{slugs.length === 1 ? '' : 's'} no nome dos arquivos ainda não {slugs.length === 1 ? 'está mapeada' : 'estão mapeadas'}. Resolva cada uma pra continuar.
      </p>
      {slugs.map(slug => (
        <LinhaResolver key={slug} slug={slug} unidades={unidades} onResolvido={onResolvido} />
      ))}
    </div>
  )
}
