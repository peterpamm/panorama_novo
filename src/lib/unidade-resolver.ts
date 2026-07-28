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
 */
export function negocioPorPrefixo(nome: string): string {
  const alvo = normalizarNomeUnidade(nome)
  if (alvo.startsWith('CDL')) return 'ROTA'
  if (alvo.startsWith('CDR')) return 'ARM'
  return 'CONS'
}
