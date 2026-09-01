import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { parseNumeroPtBr } from '@/lib/utils'

type Tabela = 'rv_frota_ad_checklist_meta' | 'rv_frota_ad_milimetragem_meta' | 'rv_frota_indisp_manutencao_meta' | 'rv_frota_disp_empilhadeira_meta'

interface IndicadorFrotaT1 {
  id: string
  nome: string
  tabela: Tabela
  /** 'pct' guarda/mostra a meta como % (meta_pct); 'valor' guarda em R$ (meta_valor). */
  formato: 'pct' | 'valor'
  unidades: string
}

// Custos Gerais (DRE 113) não entra aqui — resultado/meta vêm automático do
// DRE/Orçamento, igual Manutenção/Pneus/Diesel; o peso é cadastrado junto
// com eles em "Peso dos indicadores do DRE" (ver MetasFrotaTab.tsx).
const INDICADORES: IndicadorFrotaT1[] = [
  { id: 'ad_checklist', nome: 'Ad. Check List', tabela: 'rv_frota_ad_checklist_meta', formato: 'pct', unidades: 'Estância, Ponta Grossa e CDR Bahia' },
  { id: 'ad_milimetragem', nome: 'Ad. Milimetragem', tabela: 'rv_frota_ad_milimetragem_meta', formato: 'pct', unidades: 'Estância, Ponta Grossa e CDR Bahia' },
  { id: 'indisp_manutencao', nome: 'Indisponibilidade Manutenção', tabela: 'rv_frota_indisp_manutencao_meta', formato: 'pct', unidades: 'Estância e Ponta Grossa' },
  { id: 'disp_empilhadeira', nome: 'Disponibilidade Empilhadeira', tabela: 'rv_frota_disp_empilhadeira_meta', formato: 'pct', unidades: 'CDR Bahia' },
]

/**
 * Cadastro de meta e peso dos 4 indicadores importados da RV de Frota,
 * específicos das lideranças T1 — Estância, Ponta Grossa e/ou CDR Bahia
 * conforme o indicador (ver `OPERACOES_FROTA_T1`, rv-frota-t1.ts). Meta e
 * peso são únicos por indicador (migration 108) — a mesma meta vale pra
 * todas as unidades que participam dele, não varia unidade a unidade.
 * Resultado vem da planilha de resultado (RV de Frota &gt; Importação, mesma aba
 * RESULTADO do Desconto CIVF/Stress Test). Custos Gerais (DRE 113) não entra
 * aqui — é AVR automático vs meta do Orçamento; o peso mora junto de
 * Manutenção/Pneus/Diesel em "Peso dos indicadores do DRE" (MetasFrotaTab.tsx).
 */
export function FrotaT1MetaCard() {
  const { toast } = useToast()
  const [valores, setValores] = useState<Record<string, { meta: string; peso: string }>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => {
    Promise.all(INDICADORES.map(ind => supabase.from(ind.tabela).select('*').maybeSingle())).then(resultados => {
      const v: Record<string, { meta: string; peso: string }> = {}
      resultados.forEach((res, i) => {
        if (res.error || !res.data) return
        const ind = INDICADORES[i]
        const row = res.data as Record<string, number>
        const meta = ind.formato === 'pct' ? row.meta_pct : row.meta_valor
        v[ind.id] = { meta: Number(meta).toLocaleString('pt-BR'), peso: Number(row.peso).toLocaleString('pt-BR') }
      })
      setValores(v)
    })
  }, [])

  async function handleSalvar(ind: IndicadorFrotaT1) {
    const atual = valores[ind.id] ?? { meta: '', peso: '' }
    const colunaMeta = ind.formato === 'pct' ? 'meta_pct' : 'meta_valor'
    setSalvando(ind.id)
    const { error } = await supabase
      .from(ind.tabela)
      .upsert({ id: true, [colunaMeta]: parseNumeroPtBr(atual.meta), peso: parseNumeroPtBr(atual.peso) }, { onConflict: 'id' })
    setSalvando(null)
    if (error) {
      toast({ title: `Erro ao salvar meta de ${ind.nome}`, description: error.message, variant: 'destructive' })
      return
    }
    toast({ title: `Meta de ${ind.nome} salva` })
  }

  return (
    <TableCard
      titulo="Frota T1 — Estância, Ponta Grossa e CDR Bahia"
      subtitulo="Meta e peso únicos por indicador — resultado importado em RV de Frota &gt; Importação."
      className="max-w-2xl"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Indicador</TableHead>
            <TableHead>Unidades</TableHead>
            <TableHead className="w-28 text-center">Meta</TableHead>
            <TableHead className="w-28 text-center">Peso (%)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {INDICADORES.map(ind => (
            <TableRow key={ind.id} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
              <TableCell className="text-sm font-medium">{ind.nome}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{ind.unidades}</TableCell>
              <TableCell className="text-center">
                <Input
                  value={valores[ind.id]?.meta ?? ''}
                  onChange={e => setValores(prev => ({ ...prev, [ind.id]: { meta: e.target.value, peso: prev[ind.id]?.peso ?? '' } }))}
                  onBlur={() => handleSalvar(ind)}
                  placeholder={ind.formato === 'pct' ? 'Ex: 90' : 'Ex: 0,00'}
                  className="mx-auto h-8 w-24 text-center tabular-nums"
                />
              </TableCell>
              <TableCell className="text-center">
                <Input
                  value={valores[ind.id]?.peso ?? ''}
                  onChange={e => setValores(prev => ({ ...prev, [ind.id]: { meta: prev[ind.id]?.meta ?? '', peso: e.target.value } }))}
                  onBlur={() => handleSalvar(ind)}
                  placeholder="Ex: 10"
                  className="mx-auto h-8 w-20 text-center tabular-nums"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {salvando && <p className="px-4 pb-3 text-xs text-muted-foreground">Salvando...</p>}
    </TableCard>
  )
}
