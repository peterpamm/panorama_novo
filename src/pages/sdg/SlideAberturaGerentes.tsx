const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

interface Props {
  unidade: string
  mes: number
  ano: number
  /** URL do logo da unidade (`mapaLogosPorUnidade`/`useLogosUnidades`) — sem logo cadastrado, o slide fica só com o texto (sem placeholder de inicial aqui, diferente do Modo Pódio). */
  logoUrl?: string | null
}

/**
 * Slide de abertura do SDG Gerentes — "SDG — <UNIDADE>", capa fixa (sempre
 * escura, não segue o toggle claro/escuro da apresentação, igual uma capa de
 * slide de verdade) com o mesmo par azul→roxo já usado no resto do app (item
 * ativo do sidebar, Modo Pódio etc.) em vez de inventar uma paleta nova.
 * Formas circulares sobrepostas só de propósito decorativo. Logo da unidade
 * grande do lado direito (mesmo estilo "sem moldura" do Modo Pódio) quando
 * cadastrado — dá destaque de marca à capa.
 */
export function SlideAberturaGerentes({ unidade, mes, ano, logoUrl }: Props) {
  return (
    <div className="relative flex h-full items-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-10 text-white sm:px-16">
      {/* Formas decorativas — cluster inferior esquerdo + eco superior direito */}
      <svg className="pointer-events-none absolute -bottom-24 -left-24 h-[420px] w-[420px] opacity-60" viewBox="0 0 400 400">
        <circle cx="140" cy="260" r="150" fill="#2563eb" fillOpacity="0.18" />
        <circle cx="220" cy="180" r="120" fill="#7c3aed" fillOpacity="0.16" />
        <circle cx="90" cy="150" r="90" fill="#38bdf8" fillOpacity="0.14" />
        <circle cx="260" cy="300" r="70" fill="#1e3a8a" fillOpacity="0.35" />
      </svg>
      <svg className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 opacity-40" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="100" fill="#7c3aed" fillOpacity="0.2" />
        <circle cx="60" cy="60" r="55" fill="#2563eb" fillOpacity="0.2" />
      </svg>

      <div className="relative z-10 flex w-full items-center justify-between gap-10">
        <div>
          <p className="mb-5 text-base font-semibold uppercase tracking-[0.35em] text-blue-300">SDG Gerentes</p>
          <h1 className="text-7xl font-black leading-[1.05] sm:text-8xl xl:text-9xl">
            <span className="block">SDG</span>
            <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{unidade.toUpperCase()}</span>
          </h1>
          <p className="mt-8 text-2xl font-medium text-slate-300 sm:text-3xl">{MESES_NOMES[mes - 1]} / {ano}</p>
        </div>
        {logoUrl && (
          <img src={logoUrl} alt={unidade} className="hidden h-72 w-auto shrink-0 object-contain drop-shadow-xl md:mr-20 md:block xl:h-96 xl:mr-32" />
        )}
      </div>
    </div>
  )
}
