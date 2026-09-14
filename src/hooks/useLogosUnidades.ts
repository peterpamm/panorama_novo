import { useMemo } from 'react'
import { useUnidades } from '@/hooks/useUnidades'
import { mapaLogosPorUnidade } from '@/lib/logos-unidades'

/** Mapa codigo da unidade → URL do logo (`public/logos-unidades/`), pronto pro espaço de logo do Modo Pódio (`RankingTabelas.tsx`). Unidade sem logo cadastrado simplesmente não aparece no mapa. */
export function useLogosUnidades(): Map<string, string> {
  const { unidades } = useUnidades()
  return useMemo(() => mapaLogosPorUnidade(unidades), [unidades])
}
