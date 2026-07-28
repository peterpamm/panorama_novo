import { normalizarNomeUnidade } from '@/lib/unidade-resolver'

/**
 * Direção do indicador de gente vs meta: presenteísmo/absenteísmo quanto MENOR
 * melhor; os demais (disponibilidade etc) quanto MAIOR melhor.
 */
export function menorMelhor(indicador: string): boolean {
  const norm = indicador.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return norm.includes('PRESENTE') || norm.includes('ABSENTE')
}

/**
 * Unidades cuja RV olha os negócios do DRE separados (uma linha por negócio,
 * ex: ROTA e ARM) — as demais usam o consolidado (CONS). Casa por nome/código
 * normalizado pra não depender do código exato cadastrado.
 */
export function unidadeSplitNegocio(codigo: string, nome: string): boolean {
  const norm = `${codigo} ${nome}`.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return norm.includes('PONTA GROSSA') || norm.includes('CAMACARI') || norm.includes('CAMACAR')
}

function tokensSetor(setor: string): string[] {
  return setor.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Z]+/)
}

/**
 * Setor de gente: aceita "RH" ou "GENTE" (casado por palavra inteira, sem
 * acentos — "GENTE E GESTÃO" entra, "GERENTE" não).
 */
export function ehSetorRh(setor: string): boolean {
  const tokens = tokensSetor(setor)
  return tokens.includes('RH') || tokens.includes('GENTE')
}

/** Setor financeiro: aceita "FINANCEIRO" ou "FIN" (palavra inteira, sem acentos). */
export function ehSetorFinanceiro(setor: string): boolean {
  const tokens = tokensSetor(setor)
  return tokens.includes('FINANCEIRO') || tokens.includes('FIN')
}

/** Setor de frota: aceita "FROTA" (palavra inteira, sem acentos). */
export function ehSetorFrota(setor: string): boolean {
  return tokensSetor(setor).includes('FROTA')
}

/** Setor de segurança: aceita "SEGURANÇA"/"SEGURANCA" ou "SEG" (palavra inteira, sem acentos). */
export function ehSetorSeguranca(setor: string): boolean {
  const tokens = tokensSetor(setor)
  return tokens.includes('SEGURANCA') || tokens.includes('SEG')
}

/** Setor de distribuição: aceita "DISTRIBUIÇÃO"/"DISTRIBUICAO" ou "DISTRIB" (palavra inteira, sem acentos). */
export function ehSetorDistribuicao(setor: string): boolean {
  const tokens = tokensSetor(setor)
  return tokens.includes('DISTRIBUICAO') || tokens.includes('DISTRIB')
}

/** Setor de armazém: aceita "ARMAZÉM"/"ARMAZEM" ou "ARM" (palavra inteira, sem acentos). */
export function ehSetorArmazem(setor: string): boolean {
  const tokens = tokensSetor(setor)
  return tokens.includes('ARMAZEM') || tokens.includes('ARM')
}

/**
 * Compara o negócio de uma meta/indicador com o negócio da liderança:
 * vazio/CONS de qualquer lado casa com tudo (gerente único responde por todos
 * os negócios da unidade); senão casa normalizado, aceitando abreviação por
 * prefixo (ARM ↔ ARMAZEM).
 */
export function negocioCompativel(negocioMeta: string, negocioPessoa: string): boolean {
  const a = normalizarNomeUnidade(negocioMeta) || 'CONS'
  const b = normalizarNomeUnidade(negocioPessoa) || 'CONS'
  if (a === 'CONS' || b === 'CONS') return true
  return a === b || a.startsWith(b) || b.startsWith(a)
}

/**
 * Escolhe qual negócio do DRE usar pra apurar os indicadores de DRE de uma
 * liderança: unidades com split (PG/Camaçari) usam o negócio da pessoa quando
 * existe DRE separado importado (ARM ↔ ARMAZEM por prefixo); as demais, CONS.
 */
export function negocioDreDaPessoa(
  codigoUnidade: string,
  nomeUnidade: string,
  negocioPessoa: string,
  negociosDre: string[],
): string {
  if (!unidadeSplitNegocio(codigoUnidade, nomeUnidade)) return 'CONS'
  const p = normalizarNomeUnidade(negocioPessoa)
  if (p === '' || p === 'CONS') return 'CONS'
  const match = negociosDre.find(n => {
    if (n === 'CONS') return false
    const nn = normalizarNomeUnidade(n)
    return nn === p || p.startsWith(nn) || nn.startsWith(p)
  })
  return match ?? 'CONS'
}
