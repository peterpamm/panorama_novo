import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CONTAS_ORCAMENTO_USADAS } from '@/lib/constants'
import { fetchOrcamentoPaginado } from '@/lib/orcamento-fetch'
import type { OrcamentoLinha } from '@/types'

/**
 * Todo o orçamento (todas unidades/negócios/anos), restrito às contas
 * realmente usadas por algum pacote do Farol/RV (`CONTAS_ORCAMENTO_USADAS` —
 * evita puxar as ~155 contas de cada aba quando só umas 17 importam pra
 * `buscarMetaOrcamento`). Mesma ideia de `useMetasTodasUnidades`/
 * `useDreLongoTodasUnidades` (cache global, sem filtro de unidade) — usado
 * por telas que comparam AVR × meta do Orçamento pra todas as
 * lideranças/unidades de uma vez (RV).
 */
export function useOrcamentoTodasUnidades() {
  const [orcamentos, setOrcamentos] = useState<OrcamentoLinha[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    fetchOrcamentoPaginado((from, to) =>
      supabase.from('orcamentos').select('*').in('conta_codigo', CONTAS_ORCAMENTO_USADAS).range(from, to),
    )
      .then(rows => { if (ativo) setOrcamentos(rows) })
      .catch(() => { if (ativo) setOrcamentos([]) })
      .finally(() => { if (ativo) setLoading(false) })
    return () => { ativo = false }
  }, [])

  return { orcamentos, loading }
}
