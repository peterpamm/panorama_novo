import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import type { ResultadoTri } from '@/types'

const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const ANOS = (() => {
  const atual = new Date().getFullYear()
  return [atual + 1, atual, atual - 1, atual - 2]
})()

/**
 * Registro manual do indicador TRI (acidente grave) — não tem planilha de
 * importação: acidente grave é raro (nenhum desde o ano passado), então
 * toda unidade/mês sem registro aqui já conta como zero na apuração. Isso
 * é só pra cadastrar a exceção quando acontece um de verdade.
 */
export function RegistrarTriCard() {
  const { toast } = useToast()
  const { unidades } = useUnidades()

  const [unidadeSel, setUnidadeSel] = useState('')
  const [ano, setAno] = useState(String(new Date().getFullYear()))
  const [mes, setMes] = useState(String(new Date().getMonth() + 1))
  const [quantidade, setQuantidade] = useState('1')
  const [salvando, setSalvando] = useState(false)
  const [registros, setRegistros] = useState<ResultadoTri[]>([])
  const [carregando, setCarregando] = useState(true)

  async function carregarRegistros() {
    setCarregando(true)
    const { data } = await supabase.from('resultados_tri').select('*').order('ano', { ascending: false }).order('mes', { ascending: false })
    setRegistros((data as ResultadoTri[]) ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregarRegistros() }, [])

  const nomesUnidades = new Map(unidades.map(u => [u.codigo, u.nome]))

  async function handleSalvar() {
    if (!unidadeSel) {
      toast({ title: 'Escolha a unidade', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const { error } = await supabase
      .from('resultados_tri')
      .upsert({ unidade: unidadeSel, ano: Number(ano), mes: Number(mes), valor: Number(quantidade) || 0 }, { onConflict: 'unidade,ano,mes' })
    setSalvando(false)
    if (error) {
      toast({ title: 'Erro ao registrar TRI', description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: 'TRI registrado' })
    setQuantidade('1')
    carregarRegistros()
  }

  async function handleRemover(id: string) {
    const { error } = await supabase.from('resultados_tri').delete().eq('id', id)
    if (error) {
      toast({ title: 'Erro ao remover registro', description: error.message, variant: 'destructive' })
      return
    }
    carregarRegistros()
  }

  return (
    <div className="max-w-xl space-y-3">
      <h2 className="text-base font-semibold">TRI — registro manual</h2>
      <p className="text-sm text-muted-foreground">
        Acidente grave é raro — não tem planilha pra isso. Toda unidade/mês sem registro aqui já conta como zero
        acidentes na apuração da RV. Só cadastre quando acontecer um de verdade.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Unidade</Label>
          <Select value={unidadeSel} onValueChange={setUnidadeSel}>
            <SelectTrigger className={cn('w-52', selectGlamour)}><SelectValue placeholder="Escolha..." /></SelectTrigger>
            <SelectContent>
              {unidades.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Ano</Label>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Mês</Label>
          <Select value={mes} onValueChange={setMes}>
            <SelectTrigger className={cn('w-40', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Quantidade</Label>
          <Input
            value={quantidade}
            onChange={e => setQuantidade(e.target.value)}
            className="h-10 w-20 text-center tabular-nums"
          />
        </div>
        <Button onClick={handleSalvar} disabled={salvando}>Registrar</Button>
      </div>

      {!carregando && registros.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unidade</TableHead>
              <TableHead>Ano</TableHead>
              <TableHead>Mês</TableHead>
              <TableHead className="text-center">Quantidade</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map(r => (
              <TableRow key={r.id} className="border-gray-200/30 dark:border-gray-700/30">
                <TableCell className="text-sm font-medium">{nomesUnidades.get(r.unidade) ?? r.unidade}</TableCell>
                <TableCell className="text-sm">{r.ano}</TableCell>
                <TableCell className="text-sm">{MESES_NOMES[r.mes - 1]}</TableCell>
                <TableCell className="text-center text-sm font-semibold tabular-nums">{r.valor}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => r.id && handleRemover(r.id)} title="Remover registro">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
