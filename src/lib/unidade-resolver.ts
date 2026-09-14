import type { Unidade } from '@/types'

/** Normaliza um nome de unidade pra comparação: maiúsculas, sem acentos, espaços colapsados. */
export function normalizarNomeUnidade(nome: string): string {
  return nome
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

/**
 * Encontra a unidade que corresponde a um nome vindo de arquivo externo
 * (BI da Ambev etc), testando código, nome, nome do GInfo e a lista de
 * apelidos cadastrada na Administração — tudo normalizado.
 */
export function resolverUnidade(nome: string, unidades: Unidade[]): Unidade | undefined {
  const alvo = normalizarNomeUnidade(nome)
  if (alvo === '') return undefined
  return unidades.find(u =>
    normalizarNomeUnidade(u.codigo) === alvo
    || normalizarNomeUnidade(u.nome) === alvo
    || (u.nome_ginfo !== null && normalizarNomeUnidade(u.nome_ginfo) === alvo)
    || (u.apelidos ?? []).some(a => normalizarNomeUnidade(a) === alvo),
  )
}

/**
 * Negócio sugerido pelo prefixo do nome vindo de arquivo externo — CDL
 * (rota) e CDR (armazém/empurrada) são operações separadas da mesma unidade
 * (ex: CDL CAMAÇARI e CDR BAHIA, ambas Camaçari). Mesma convenção usada em
 * MetaGente (BI de Gente); CONS quando a unidade não abre por negócio.
 *
 * Algumas linhas de algumas planilhas (ex: DEV PDV/DEV HL na Import_RR -
 * Arm&DU.xlsx) vêm com um código numérico antes do prefixo (ex: "346 - CDL
 * AS Camaçari", enquanto ON TIME/JORNADA da mesma planilha vêm só "CDL AS
 * Camaçari") — sem descartar esse código, `startsWith('CDL')` nunca batia e
 * a linha caía em CONS (unidade que não existe pra Camaçari fora do
 * Financeiro), sumindo silenciosamente da tela mesmo com a unidade resolvida
 * certa via apelido. Descarta qualquer "NÚMERO - " (ou só "NÚMERO ") no
 * início antes de checar o prefixo.
 */
export function negocioPorPrefixo(nome: string): string {
  const alvo = normalizarNomeUnidade(nome).replace(/^\d+\s*-?\s*/, '')
  if (alvo.startsWith('CDL')) return 'ROTA'
  if (alvo.startsWith('CDR')) return 'ARM'
  return 'CONS'
}
