export const TIPO_PARA_NEGOCIO: Record<string, string> = {
  CONSOLIDADO: 'CONS',
  ROTA: 'ROTA',
  ARMAZEM: 'ARM',
  EMPURRADA: 'EMP',
}

export interface DreFilenameInfo {
  unidadeSlug: string
  tipo: keyof typeof TIPO_PARA_NEGOCIO
  negocio: string
  mes: number
  ano: number
}

const PADRAO_NOME = /^DRE_(.+)_(CONSOLIDADO|ROTA|ARMAZEM|EMPURRADA)_(\d{2})_(\d{4})\.xlsx$/i

/**
 * Lê unidade/negócio/mês/ano direto do nome do arquivo baixado pela
 * automação Download_DRE (ex: "DRE_FOZ_DO_IGUACU_CONSOLIDADO_05_2026.xlsx"),
 * sem depender da estrutura de pastas em que o arquivo está — funciona
 * independente de qual pasta o usuário selecionar na importação em massa.
 * Retorna null se o nome não casar o padrão (arquivo ignorado pelo importador).
 */
export function parseDreFilename(nome: string): DreFilenameInfo | null {
  const match = nome.match(PADRAO_NOME)
  if (!match) return null

  const [, unidadeSlug, tipoRaw, mesStr, anoStr] = match
  const tipo = tipoRaw.toUpperCase() as keyof typeof TIPO_PARA_NEGOCIO

  return {
    unidadeSlug: unidadeSlug.toUpperCase(),
    tipo,
    negocio: TIPO_PARA_NEGOCIO[tipo],
    mes: Number(mesStr),
    ano: Number(anoStr),
  }
}

/** Sugestão de nome de exibição a partir do slug do GInfo, ex: "FOZ_DO_IGUACU" -> "Foz Do Iguacu" (editável pelo admin ao cadastrar). */
export function slugParaNomeSugerido(slug: string): string {
  return slug
    .split('_')
    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase())
    .join(' ')
}
