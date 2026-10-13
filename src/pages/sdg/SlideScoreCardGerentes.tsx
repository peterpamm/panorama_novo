import { ExternalLink } from 'lucide-react'

const URL_PAINEL_SCORE_CARD = 'https://claude.ai/code/artifact/9f74faea-1121-4445-9e4f-f4dd2a00580f'
const URL_PAINEL_BNS = 'https://claude.ai/code/artifact/6e5f986a-3e70-4f80-b23f-b2f5a47970fc'

function CardLinkPainel({ titulo, url, textoBotao }: { titulo: string; url: string; textoBotao: string }) {
  return (
    <div className="w-full max-w-2xl rounded-2xl bg-white p-14 text-center shadow dark:bg-slate-800/60">
      <p className="mb-6 text-base font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">
        {titulo}
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-3 rounded-xl bg-[hsl(222,45%,20%)] px-10 py-5 text-lg font-semibold text-white transition-opacity hover:opacity-90 dark:bg-[hsl(224,28%,14%)]"
      >
        {textoBotao}
        <ExternalLink className="h-5 w-5" />
      </a>
    </div>
  )
}

/**
 * Slide "Score Card" do SDG Gerentes — tanto o Score Card quanto o BNS vivem
 * em painéis à parte (Artifacts de outro colega), sem integração de dados
 * com o panorama_novo (Artifact não expõe API pra outro sistema consultar de
 * fora). Enquanto isso, o slide é só um link de acesso rápido pra cada um —
 * se um dia os painéis forem unificados num projeto só, esses links viram o
 * resultado final vindo do banco, igual Scorecard já funciona hoje (ver
 * `scorecard-parser.ts`/`farol-gerentes.ts`).
 */
export function SlideScoreCardGerentes() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="flex flex-col items-center gap-6">
        <CardLinkPainel titulo="Score Card" url={URL_PAINEL_SCORE_CARD} textoBotao="Acessar Painel de Score Card" />
        <CardLinkPainel titulo="BNS" url={URL_PAINEL_BNS} textoBotao="Acessar Painel de BNS" />
      </div>
    </div>
  )
}
