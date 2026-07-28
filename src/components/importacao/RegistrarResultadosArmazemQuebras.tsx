import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard, tableCardActionClass } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { cn, parseNumeroPtBr } from '@/lib/utils'
import type { ResultadoArmazemQuebras } from '@/types'

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const ANOS = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

/**
 * Quebras não vem de nenhuma planilha (nem T2 nem T1) — cadastro totalmente
 * manual, direto na tela: uma célula editável (R$) por unidade×mês, pra
 * todas as unidades cadastradas (inclusive Estância e CDR Bahia, do T1).
 */
export function RegistrarResultadosArmazemQuebras() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const [valores, setValores] = useState<Record<string, string>>({})
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const { data, error } = await supabase.from('resultados_armazem_quebras').select('*').eq('ano', Number(ano))
      if (!error) {
        const v: Record<string, string> = {}
        for (const r of (data as ResultadoArmazemQuebras[]) ?? []) {
          v[`${r.unidade}|${r.mes}`] = Number(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        }
        setValores(v)
      }
      setCarregando(false)
    }
    carregar()
  }, [ano])

  const unidadesOrdenadas = useMemo(() => [...unidades].sort((a, b) => a.nome.localeCompare(b.nome)), [unidades])

  async function handleSalvar(unidadeCodigo: string, mes: number) {
    const chave = `${unidadeCodigo}|${mes}`
    const valor = parseNumeroPtBr(valores[chave] ?? '')
    setSalvando(chave)
    const { error } = await supabase
      .from('resultados_armazem_quebras')
      .upsert({ unidade: unidadeCodigo, ano: Number(ano), mes, valor }, { onConflict: 'unidade,ano,mes' })
    setSalvando(null)
    if (error) {
      toast({ title: 'Erro ao salvar Quebras', description: error.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">Quebras — cadastro manual</h2>
      <p className="text-sm text-muted-foreground">
        Quebras não vem de nenhuma planilha — digite o valor (R$) de cada unidade/mês direto na tabela abaixo. Cobre
        todas as unidades, inclusive Estância e CDR Bahia (T1).
      </p>

      <TableCard
        titulo="Quebras (R$) por unidade e mês"
        subtitulo={carregando ? 'Carregando...' : `${ano} · cadastro manual`}
        acoes={
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className={cn('h-8 w-20 text-xs', tableCardActionClass)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      >
        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : unidadesOrdenadas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma unidade cadastrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                {MESES_ABREV.map(m => <TableHead key={m} className="text-center">{m}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {unidadesOrdenadas.map(u => (
                <TableRow key={u.codigo} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="py-1.5 text-sm font-medium">{u.nome}</TableCell>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => {
                    const chave = `${u.codigo}|${mes}`
                    return (
                      <TableCell key={mes} className="p-1 text-center">
                        <Input
                          value={valores[chave] ?? ''}
                          onChange={e => setValores(prev => ({ ...prev, [chave]: e.target.value }))}
                          onBlur={() => handleSalvar(u.codigo, mes)}
                          placeholder="—"
                          className="mx-auto h-8 w-20 text-center text-xs tabular-nums"
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {salvando && <p className="px-4 pb-3 text-xs text-muted-foreground">Salvando...</p>}
      </TableCard>
    </div>
  )
}
