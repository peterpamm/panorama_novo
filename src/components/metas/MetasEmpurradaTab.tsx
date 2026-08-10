import { IndisponibilidadeAvariaEmpurradaCard } from '@/components/metas/IndisponibilidadeAvariaEmpurradaCard'
import { PesosImportadosEmpurradaCard } from '@/components/metas/PesosImportadosEmpurradaCard'

/**
 * Metas de Empurrada — 5 indicadores, todos com meta/peso únicos (uma
 * unidade só, Estância): Indisponibilidade e Avaria de Transporte (mesmo
 * dado do Painel de Perdas — Indisponibilidade e Vales — mas com meta
 * direta em R$, não % da Meta de Perdas anual) e GTY/TMV/Tempo de Rendição
 * (só peso, resultado/meta já importados na Reunião Resultados).
 */
export function MetasEmpurradaTab() {
  return (
    <div className="space-y-6">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Indisponibilidade e Avaria de Transporte vêm do Painel de Perdas (mesmo dado de Indisponibilidade e Vales),
        com meta direta em R$ — não % da Meta de Perdas anual como em Distribuição/Financeiro. GTY, TMV e Tempo de
        Rendição já vêm importados na Reunião Resultados — aqui só o peso de cada um.
      </p>

      <IndisponibilidadeAvariaEmpurradaCard />
      <PesosImportadosEmpurradaCard />
    </div>
  )
}
