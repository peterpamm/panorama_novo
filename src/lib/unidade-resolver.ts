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

const PREFIXOS_BI_CONHECIDOS = ['CDD ', 'CDL ', 'CDR ', 'CD ']

/** Remove um prefixo de BI conhecido (CDD/CDL/CDR/CD) do início do nome, se tiver — senão devolve o texto original. */
function semPrefixoBiConhecido(nome: string): string {
  const alvo = nome.toUpperCase()
  for (const prefixo of PREFIXOS_BI_CONHECIDOS) {
    if (alvo.startsWith(prefixo)) return nome.slice(prefixo.length)
  }
  return nome
}

/**
 * Resolve um nome vindo de arquivo externo pra uma unidade, mais tolerante
 * que `resolverUnidade`: tenta exato primeiro (apelido/nome/código/GInfo);
 * se não bater, tira um prefixo de BI conhecido (CDD/CDL/CDR/CD, ex: "CDD
 * ARACAJU") e tenta de novo; se ainda não bater, confere se o nome da
 * unidade está contido no que sobrou (ou vice-versa) — cobre variações com
 * palavra extra no meio que o apelido cadastrado não tem. Usado em
 * importações cujo texto de unidade não é 100% previsível (ex: relatos de
 * segurança, "CDD ARACAJU").
 */
export function resolverUnidadeFlexivel(nome: string, unidades: Unidade[]): Unidade | undefined {
  const direto = resolverUnidade(nome, unidades)
  if (direto) return direto

  const semPrefixo = semPrefixoBiConhecido(nome)
  if (semPrefixo === nome) return undefined

  const exato = resolverUnidade(semPrefixo, unidades)
  if (exato) return exato

  const alvo = normalizarNomeUnidade(semPrefixo)
  return unidades.find(un => {
    const nomeNorm = normalizarNomeUnidade(un.nome)
    return nomeNorm !== '' && (alvo.includes(nomeNorm) || nomeNorm.includes(alvo))
  })
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
