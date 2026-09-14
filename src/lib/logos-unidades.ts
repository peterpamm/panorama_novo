import { normalizarNomeUnidade, resolverUnidade } from '@/lib/unidade-resolver'
import { CAMACARI_CDL_ID, CAMACARI_CDR_ID } from '@/lib/ranking-calculations'
import type { Unidade } from '@/types'

/**
 * Logos das unidades (só as que o usuário já forneceu — `C:\Users\LOG20\
 * Pictures\logos_unidades\logos_unidades`) — usadas no espaço reservado pra
 * logo do Modo Pódio (`RankingTabelas.tsx`). Arquivos redimensionados
 * (máx. 320px) e servidos estáticos de `public/logos-unidades/`.
 *
 * `nomeOriginal` é o texto do arquivo original (sem extensão) — mesmo
 * convenção de apelido de BI que `resolverUnidade` já usa em toda importação
 * do app (ex: "CDL CAMAÇARI"/"CDR BAHIA" já são apelidos cadastrados de
 * Camaçari). Não guardamos aqui um `codigo` fixo de propósito — a
 * correspondência é resolvida em tempo real contra a lista de unidades
 * (`mapaLogosPorUnidade`), então se um apelido mudar ou uma unidade nova
 * precisar do mesmo logo, basta ajustar o cadastro em Administração, sem
 * mexer em código.
 */
export interface LogoUnidade {
  arquivo: string
  nomeOriginal: string
}

export const LOGOS_UNIDADES: LogoUnidade[] = [
  { arquivo: '/logos-unidades/cd-aracaju.png', nomeOriginal: 'CD ARACAJU' },
  { arquivo: '/logos-unidades/cd-cascavel.png', nomeOriginal: 'CD CASCAVEL' },
  { arquivo: '/logos-unidades/cd-diadema.png', nomeOriginal: 'CD DIADEMA' },
  { arquivo: '/logos-unidades/cd-foz-do-iguacu.png', nomeOriginal: 'CD FOZ DO IGUAÇU' },
  { arquivo: '/logos-unidades/cd-francisco-beltrao.png', nomeOriginal: 'CD FRANCISCO BELTRÃO' },
  { arquivo: '/logos-unidades/cd-litoral.png', nomeOriginal: 'CD LITORAL' },
  { arquivo: '/logos-unidades/cd-londrina.png', nomeOriginal: 'CD LONDRINA' },
  { arquivo: '/logos-unidades/cd-petropolis.png', nomeOriginal: 'CD PETRÓPOLIS' },
  { arquivo: '/logos-unidades/cd-salvador.png', nomeOriginal: 'CD SALVADOR' },
  { arquivo: '/logos-unidades/cd-sao-cristovao.png', nomeOriginal: 'CD SÃO CRISTOVÃO' },
  { arquivo: '/logos-unidades/cdl-camacari.png', nomeOriginal: 'CDL CAMAÇARI' },
  { arquivo: '/logos-unidades/cdr-bahia.png', nomeOriginal: 'CDR BAHIA' },
  { arquivo: '/logos-unidades/estancia.png', nomeOriginal: 'ESTANCIA' },
  { arquivo: '/logos-unidades/ponta-grossa.png', nomeOriginal: 'PONTA GROSSA' },
  { arquivo: '/logos-unidades/vidros-pr.png', nomeOriginal: 'VIDROS PR' },
]

/** Estados brasileiros (UF) — sufixo comum em nome de arquivo (ex: "VIDROS PR") que não existe no cadastro da unidade. */
const SUFIXOS_UF = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']
const PREFIXOS_BI = ['CD ', 'CDL ', 'CDR ']

/** Remove o prefixo de BI (CD/CDL/CDR) do início, se tiver — senão devolve o texto original. */
function semPrefixoBi(nome: string): string {
  const alvo = nome.toUpperCase()
  for (const prefixo of PREFIXOS_BI) {
    if (alvo.startsWith(prefixo)) return nome.slice(prefixo.length)
  }
  return nome
}

/**
 * Resolve um logo pra uma unidade tentando, em ordem: (1) o texto original
 * do arquivo, exato — cobre quando já existe um apelido idêntico cadastrado
 * (ex: "CDR BAHIA"); (2) sem um sufixo de UF no final (ex: "VIDROS PR" →
 * "VIDROS"); (3) sem um prefixo de BI no início (ex: "CD ARACAJU" →
 * "ARACAJU"); (4) prefixo de BI removido, contido no nome da unidade (ou o
 * nome da unidade contido nele) — pega variações com palavra extra no meio
 * que o nome do arquivo não tem (ex: apelido real "CDL AS Camaçari" bate com
 * o arquivo "CDL CAMAÇARI" porque "CAMAÇARI" está contido nos dois depois de
 * tirar o "CDL "). Se nada bater, a unidade fica sem logo (cai no
 * placeholder da inicial) — não adivinha além disso pra não grudar o logo
 * errado.
 */
export function resolverLogoUnidade(logo: LogoUnidade, unidades: Unidade[]): Unidade | undefined {
  const directo = resolverUnidade(logo.nomeOriginal, unidades)
  if (directo) return directo

  const semUf = SUFIXOS_UF.reduce<string | null>((acc, uf) => {
    if (acc) return acc
    const norm = normalizarNomeUnidade(logo.nomeOriginal)
    return norm.endsWith(` ${uf}`) ? norm.slice(0, -(uf.length + 1)) : null
  }, null)
  if (semUf) {
    const u = resolverUnidade(semUf, unidades)
    if (u) return u
  }

  const semPrefixo = semPrefixoBi(logo.nomeOriginal)
  if (semPrefixo !== logo.nomeOriginal) {
    const u = resolverUnidade(semPrefixo, unidades)
    if (u) return u

    const alvo = normalizarNomeUnidade(semPrefixo)
    const porConteudo = unidades.find(un => {
      const nomeNorm = normalizarNomeUnidade(un.nome)
      return nomeNorm !== '' && (alvo.includes(nomeNorm) || nomeNorm.includes(alvo))
    })
    if (porConteudo) return porConteudo
  }

  return undefined
}

/** Mapa codigo da unidade → URL do logo, pronto pra usar no Modo Pódio. */
export function mapaLogosPorUnidade(unidades: Unidade[]): Map<string, string> {
  const mapa = new Map<string, string>()
  for (const logo of LOGOS_UNIDADES) {
    const unidade = resolverLogoUnidade(logo, unidades)
    if (unidade && !mapa.has(unidade.codigo)) mapa.set(unidade.codigo, logo.arquivo)
  }

  // RankingPage.tsx sintetiza 2 pseudo-unidades pro split CDL/CDR de
  // Camaçari na visão CONS (`CAMACARI_CDL_ID`/`CAMACARI_CDR_ID`,
  // ranking-calculations.ts) — não são linha real de `unidades`, então nunca
  // passam pela resolução acima por mais apelido que a unidade real tenha.
  // Mapeadas direto aqui pros mesmos 2 arquivos (Rota/CDL e Armazém/CDR).
  const cdl = LOGOS_UNIDADES.find(l => l.nomeOriginal === 'CDL CAMAÇARI')
  const cdr = LOGOS_UNIDADES.find(l => l.nomeOriginal === 'CDR BAHIA')
  if (cdl) mapa.set(CAMACARI_CDL_ID, cdl.arquivo)
  if (cdr) mapa.set(CAMACARI_CDR_ID, cdr.arquivo)

  return mapa
}
