import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUnidades } from '@/hooks/useUnidades'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'
import type { Unidade } from '@/types'

interface LinhaUnidadeProps {
  unidade: Unidade
  unidades: Unidade[]
  onAtualizado: () => void
}

function LinhaUnidade({ unidade, unidades, onAtualizado }: LinhaUnidadeProps) {
  const { toast } = useToast()
  const [nome, setNome] = useState(unidade.nome)
  const [dataEntrada, setDataEntrada] = useState(unidade.data_entrada ?? '')
  const [destino, setDestino] = useState('')
  const [processando, setProcessando] = useState(false)

  async function handleSalvarNome() {
    if (nome === unidade.nome || !nome.trim()) return
    const { error } = await supabase.from('unidades').update({ nome }).eq('codigo', unidade.codigo)
    if (error) { toast({ title: 'Erro ao salvar nome', description: error.message, variant: 'destructive' }); return }
    onAtualizado()
  }

  async function handleSalvarDataEntrada() {
    if (dataEntrada === (unidade.data_entrada ?? '')) return
    const { error } = await supabase.from('unidades').update({ data_entrada: dataEntrada || null }).eq('codigo', unidade.codigo)
    if (error) { toast({ title: 'Erro ao salvar data de entrada', description: error.message, variant: 'destructive' }); return }
    onAtualizado()
  }

  async function handleExcluir() {
    setProcessando(true)
    const { count } = await supabase.from('dre_lancamentos').select('*', { count: 'exact', head: true }).eq('unidade', unidade.codigo)
    if (count && count > 0) {
      toast({
        title: 'Essa unidade tem dados importados',
        description: `${count} lançamento(s) — use "Mesclar com" pra mover os dados pra outra unidade antes de excluir.`,
        variant: 'destructive',
      })
      setProcessando(false)
      return
    }
    if (!window.confirm(`Excluir a unidade "${unidade.nome}" (${unidade.codigo})? Essa ação não pode ser desfeita.`)) {
      setProcessando(false)
      return
    }
    const { error } = await supabase.from('unidades').delete().eq('codigo', unidade.codigo)
    setProcessando(false)
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return }
    toast({ title: `Unidade "${unidade.nome}" excluída` })
    onAtualizado()
  }

  async function handleMesclar() {
    const unidadeDestino = unidades.find(u => u.codigo === destino)
    if (!unidadeDestino) return
    const confirmado = window.confirm(
      `Mover todos os lançamentos de "${unidade.nome}" (${unidade.codigo}) pra "${unidadeDestino.nome}" (${unidadeDestino.codigo}) e remover "${unidade.nome}"?\n\nOnde houver conflito (mesmo negócio/ano/conta nas duas), o dado de "${unidadeDestino.nome}" é o que fica. Essa ação não pode ser desfeita.`,
    )
    if (!confirmado) return
    setProcessando(true)
    const { error } = await supabase.rpc('renomear_unidade_codigo', { p_antigo: unidade.codigo, p_novo: destino })
    setProcessando(false)
    if (error) { toast({ title: 'Erro ao mesclar', description: error.message, variant: 'destructive' }); return }
    toast({ title: `"${unidade.nome}" mesclada em "${unidadeDestino.nome}"` })
    onAtualizado()
  }

  return (
    <TableRow>
      <TableCell>
        <Input
          value={nome}
          onChange={e => setNome(e.target.value)}
          onBlur={handleSalvarNome}
          className="h-8 max-w-[200px]"
        />
      </TableCell>
      <TableCell className="font-mono text-xs">{unidade.codigo}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{unidade.nome_ginfo ?? '—'}</TableCell>
      <TableCell>
        <Input
          type="date"
          value={dataEntrada}
          onChange={e => setDataEntrada(e.target.value)}
          onBlur={handleSalvarDataEntrada}
          className="h-8 w-36"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Select value={destino} onValueChange={setDestino}>
            <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Mesclar com..." /></SelectTrigger>
            <SelectContent>
              {unidades.filter(u => u.codigo !== unidade.codigo).map(u => (
                <SelectItem key={u.codigo} value={u.codigo}>{u.nome} ({u.codigo})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={!destino || processando} onClick={handleMesclar}>Mesclar</Button>
        </div>
      </TableCell>
      <TableCell>
        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={processando} onClick={handleExcluir}>
          Excluir
        </Button>
      </TableCell>
    </TableRow>
  )
}

export function AdministracaoPage() {
  const { unidades, loading, recarregar } = useUnidades()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Unidades</CardTitle>
          <p className="text-sm text-muted-foreground">
            Unidades sem nenhum lançamento podem ser excluídas direto. Unidades duplicadas (ex: uma renomeada e outra antiga que ficou sem uso)
            podem ser mescladas — os lançamentos da unidade da esquerda são movidos pra unidade escolhida em "Mesclar com" e a duplicada é removida.
            "Data de entrada" é opcional — só preencha pra unidades que começaram a operar no meio de algum ano com dado no banco (ex: 2025-07);
            isso ajusta a meta de Redução de Custos pra usar a média do período em que já operava no lugar dos meses em que ainda não existia.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome no GInfo</TableHead>
                  <TableHead>Data de entrada</TableHead>
                  <TableHead>Mesclar duplicada</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {unidades.map(u => (
                  <LinhaUnidade key={u.codigo} unidade={u} unidades={unidades} onAtualizado={recarregar} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Toaster />
    </div>
  )
}
