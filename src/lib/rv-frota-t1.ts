import { resolverUnidade } from '@/lib/unidade-resolver'
import type { Unidade } from '@/types'

/**
 * As 3 lideranças "T1" novas da RV de Frota — Estância e Ponta Grossa (rota/
 * empurrada, sem Distribuição tradicional) e CDR Bahia (armazém, o negócio
 * ARM de Camaçari — que tem dois gerentes, o outro é o CDL ROTA). "T1" aqui é
 * um agrupamento próprio da Frota, diferente do T1 de Armazém/DTO
 * (`OPERACOES_ARMAZEM_T1`/`OPERACOES_DTO_T1` — só Estância/CDR Bahia, sem
 * Ponta Grossa) — não reaproveitar aquelas listas aqui.
 */
export const OPERACOES_FROTA_MANUTENCAO = ['ESTÂNCIA', 'PONTA GROSSA']
export const OPERACOES_FROTA_EMPILHADEIRA = ['CDR BAHIA']
export const OPERACOES_FROTA_T1 = [...OPERACOES_FROTA_MANUTENCAO, ...OPERACOES_FROTA_EMPILHADEIRA]

/** Resolve uma lista de nomes de operação pras unidades cadastradas (via apelidos), sem duplicar quando dois nomes caem na mesma unidade. */
export function resolverUnidadesFrotaT1(nomes: string[], unidades: Unidade[]): Unidade[] {
  return nomes
    .map(op => resolverUnidade(op, unidades))
    .filter((u, i, arr): u is Unidade => u !== undefined && arr.findIndex(x => x?.codigo === u.codigo) === i)
}

/**
 * Negócio do DRE de uma unidade T1 de Frota — CDR Bahia é o lado ARM de
 * Camaçari (mesmo código de unidade do CDL Camaçari-Internalização, que é o
 * lado ROTA — ver migration_010), então o DRE dela só existe em negócio
 * 'ARM', nunca 'CONS'. Estância e Ponta Grossa não abrem por negócio — 'CONS'.
 * Só usado pro Custos Gerais (DRE 113); os outros 4 indicadores são resultado
 * importado, sem essa ambiguidade (o import já grava um resultado só pra CDR
 * Bahia, nunca pro CDL, mesmo padrão do DTO T1/FAI).
 */
export function negocioDreFrotaT1(unidadeCodigo: string, unidades: Unidade[]): string {
  const cdrBahia = resolverUnidade('CDR BAHIA', unidades)
  return cdrBahia?.codigo === unidadeCodigo ? 'ARM' : 'CONS'
}
