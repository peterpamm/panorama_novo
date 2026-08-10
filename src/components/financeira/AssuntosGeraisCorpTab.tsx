import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSdgJustificativas } from '@/hooks/useSdgJustificativas'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'

const ANO_ATUAL = new Date().getFullYear()
const ANOS_OPCOES = [ANO_ATUAL + 1, ANO_ATUAL, ANO_ATUAL - 1]
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

/**
 * Assuntos Gerais do SDG Corporativo — mesma tabela `sdg_justificativas` do
 * SDG Financeiro, só que com `unidade = 'AMBEV'` (sentinela do consolidado —
 * nunca usado como unidade de verdade em nenhuma tela do SDG Financeiro, que
 * sempre a exclui da lista de unidades). Aparece por último, bem
 * centralizado, no modo apresentação corporativo.
 */
export function AssuntosGeraisCorpTab() {
  const { toast } = useToast()
  const [ano, setAno] = useState(ANO_ATUAL)
  const [mes, setMes] = useState(new Date().getMonth() + 1)

  const { porIndicador, loading, recarregar } = useSdgJustificativas('AMBEV', ano, mes)

  const [texto, setTexto] = useState('')
  useEffect(() => {
    setTexto(porIndicador['assuntos-gerais']?.pontos_positivos ?? '')
  }, [porIndicador])

  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    setSalvando(true)
    const { error } = await supabase.from('sdg_justificativas').upsert(
      {
        unidade: 'AMBEV',
        ano,
        mes,
        indicador: 'assuntos-gerais',
        pontos_positivos: texto.trim(),
        pontos_negativos: '',
      },
      { onConflict: 'unidade,ano,mes,indicador' },
    )
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Assuntos Gerais salvos' })
    await recarregar()
  }

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Assuntos que precisam de ajuda, ou outros assuntos importantes pra diretoria — aparece por último, bem
        centralizado, no modo apresentação (SDG Corporativo).
      </p>

      <Card className="flex flex-wrap items-end gap-4 p-4">
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
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Assuntos Gerais</h3>
            <Button size="sm" onClick={salvar} disabled={salvando} className="gap-2">
              {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar
            </Button>
          </div>
          <Textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder="Um assunto por linha..."
            className="min-h-[160px]"
          />
        </Card>
      )}
    </div>
  )
}
