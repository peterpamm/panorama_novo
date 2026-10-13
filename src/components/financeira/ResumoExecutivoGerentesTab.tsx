import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useUnidades } from '@/hooks/useUnidades'
import { useSdgJustificativas } from '@/hooks/useSdgJustificativas'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

const ANO_ATUAL = new Date().getFullYear()
const ANOS_OPCOES = [ANO_ATUAL + 1, ANO_ATUAL, ANO_ATUAL - 1]
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

type CampoBloco = 'pontos_positivos' | 'pontos_negativos' | 'pontos_atencao' | 'pontos_andamento'

const BLOCOS: { campo: CampoBloco; titulo: string; cor: string }[] = [
  { campo: 'pontos_positivos', titulo: 'Pontos Positivos', cor: 'bg-emerald-500' },
  { campo: 'pontos_negativos', titulo: 'Pontos Negativos', cor: 'bg-red-500' },
  { campo: 'pontos_atencao', titulo: 'Pontos de Atenção', cor: 'bg-orange-500' },
  { campo: 'pontos_andamento', titulo: 'Pontos em Andamento', cor: 'bg-blue-500' },
]

/**
 * Resumo Executivo do SDG dos Gerentes (/sdg-gerentes) — mesma linha de
 * `sdg_justificativas` × indicador 'assuntos-gerais-gerentes' de sempre
 * (migration 114), agora com 4 blocos em vez de 1 (migration 121 acrescenta
 * `pontos_atencao`/`pontos_andamento`). Era "Assuntos Gerais" — renomeado e
 * redesenhado a pedido do chefe do usuário depois de ver a apresentação
 * real. Por unidade, mesmo padrão de acesso de `JustificativasSdgTab.tsx`:
 * admin escolhe a unidade, usuário de unidade fica travado na própria (RLS
 * de `sdg_justificativas` já permite as duas). Um "Salvar" só, grava os 4
 * blocos juntos (mesmo upsert, 1 round-trip).
 */
export function ResumoExecutivoGerentesTab() {
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

  const [textos, setTextos] = useState<Record<CampoBloco, string>>({
    pontos_positivos: '', pontos_negativos: '', pontos_atencao: '', pontos_andamento: '',
  })
  useEffect(() => {
    const atual = porIndicador['assuntos-gerais-gerentes']
    setTextos({
      pontos_positivos: atual?.pontos_positivos ?? '',
      pontos_negativos: atual?.pontos_negativos ?? '',
      pontos_atencao: atual?.pontos_atencao ?? '',
      pontos_andamento: atual?.pontos_andamento ?? '',
    })
  }, [porIndicador])

  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!selUnidade) return
    setSalvando(true)
    const { error } = await supabase.from('sdg_justificativas').upsert(
      {
        unidade: selUnidade,
        ano,
        mes,
        indicador: 'assuntos-gerais-gerentes',
        pontos_positivos: textos.pontos_positivos.trim(),
        pontos_negativos: textos.pontos_negativos.trim(),
        pontos_atencao: textos.pontos_atencao.trim(),
        pontos_andamento: textos.pontos_andamento.trim(),
      },
      { onConflict: 'unidade,ano,mes,indicador' },
    )
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'Resumo Executivo salvo' })
    await recarregar()
  }

  const nomeUnidadeSel = unidades.find(u => u.codigo === selUnidade)?.nome ?? selUnidade

  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Pontos Positivos, Negativos, de Atenção e em Andamento — aparece como o primeiro slide depois da Abertura no
        modo apresentação (SDG dos Gerentes). Um ponto por linha em cada bloco.
      </p>

      <Card className="flex flex-wrap items-end gap-4 p-4">
        {isAdmin ? (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Unidade</Label>
            <Select value={selUnidade} onValueChange={setSelUnidade}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                {unidadesFiltro.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
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
        <Button size="sm" onClick={salvar} disabled={salvando || loading} className="gap-2">
          {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Salvar
        </Button>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {BLOCOS.map(b => (
            <Card key={b.campo} className="overflow-hidden">
              <div className={cn('px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white', b.cor)}>
                {b.titulo}
              </div>
              <Textarea
                value={textos[b.campo]}
                onChange={e => setTextos(prev => ({ ...prev, [b.campo]: e.target.value }))}
                placeholder="Um ponto por linha..."
                className="min-h-[140px] rounded-none border-0 focus-visible:ring-0"
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
