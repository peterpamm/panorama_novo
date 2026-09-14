import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Data/hora da última importação de DRE — pro cabeçalho "última atualização"
 * do SDG Corporativo de Frota. Fonte: `importacoes.created_at` (mesma tabela
 * que `ImportacaoDrePage.tsx` grava a cada arquivo importado), a mais
 * recente entre todas as unidades. RLS de `importacoes` é `admin`-only — como
 * essa tela já é `adminOnly`, quem está vendo sempre consegue ler.
 *
 * Se por algum motivo não vier nada (RLS bloqueando, tabela vazia), cai no
 * horário em que os dados foram carregados nesta sessão (client-side) — nunca
 * fica sem mostrar nada.
 */
export function useUltimaImportacao() {
  const [ultima, setUltima] = useState<Date | null>(null)
  const [carregandoDoBanco, setCarregandoDoBanco] = useState(true)
  const [carregadoNestaSessao] = useState(() => new Date())

  useEffect(() => {
    let ativo = true
    supabase
      .from('importacoes')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!ativo) return
        setUltima(data ? new Date(data.created_at as string) : null)
        setCarregandoDoBanco(false)
      })
    return () => { ativo = false }
  }, [])

  return {
    data: ultima ?? carregadoNestaSessao,
    /** true = veio de `importacoes` de verdade; false = caiu no fallback client-side. */
    confirmada: ultima !== null,
    carregando: carregandoDoBanco,
  }
}
