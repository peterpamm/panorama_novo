import { useRef, useState } from 'react'
import { toBlob, toPng } from 'html-to-image'

/**
 * Captura o elemento referenciado como PNG (2x) e copia pro clipboard —
 * inclui tudo que estiver dentro do ref (ex: o TableCard inteiro com o header
 * de título). Elementos com `data-no-print` ficam de fora (botões etc).
 * Se o navegador não permitir clipboard de imagem, baixa o arquivo.
 */
export function useCopiarComoImagem(nomeArquivo = 'card') {
  const ref = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'idle' | 'copiando' | 'copiado'>('idle')

  async function copiar() {
    if (!ref.current || status === 'copiando') return
    setStatus('copiando')

    // A página rola dentro do <main> do AppShell (não a janela) — se o card
    // estiver parcialmente fora da área visível (tabela comprida, precisou
    // de scroll pra ver o final), o html-to-image mede/recorta errado e a
    // imagem sai cortada pela metade. Zera o scroll antes de capturar (e
    // devolve depois) pra sempre capturar o elemento inteiro.
    const scrollContainer = ref.current.closest('main')
    const scrollTopAnterior = scrollContainer?.scrollTop ?? 0
    scrollContainer?.scrollTo({ top: 0 })
    // Duplo rAF: um só às vezes dispara antes do layout terminar de acomodar
    // uma mudança recente no conteúdo (ex: uma linha nova numa tabela) —
    // o scrollHeight lido logo em seguida saía menor que o real e cortava a
    // última linha da captura.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))

    const isDark = document.documentElement.classList.contains('dark')
    const opcoes = {
      pixelRatio: 2,
      backgroundColor: isDark ? '#111827' : '#eef2f7',
      filter: (node: HTMLElement) => !('noPrint' in (node.dataset ?? {})),
      // Força a captura no tamanho total do conteúdo (scrollWidth/Height),
      // não só na área visível — mesma razão do reset de scroll acima. +2px
      // de folga na altura porque scrollHeight pode arredondar pra baixo por
      // sub-pixel e cortar a última linha (ex: linha de Total de uma tabela).
      width: ref.current.scrollWidth,
      height: ref.current.scrollHeight + 2,
    }
    try {
      const blob = await toBlob(ref.current, opcoes)
      if (!blob) throw new Error('captura vazia')
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setStatus('copiado')
    } catch {
      // Clipboard de imagem indisponível (ex: Firefox) — baixa o PNG.
      try {
        const dataUrl = await toPng(ref.current, opcoes)
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = `${nomeArquivo.replace(/\s+/g, '_').toLowerCase()}.png`
        a.click()
        setStatus('copiado')
      } catch {
        setStatus('idle')
        scrollContainer?.scrollTo({ top: scrollTopAnterior })
        return
      }
    }
    scrollContainer?.scrollTo({ top: scrollTopAnterior })
    setTimeout(() => setStatus('idle'), 2000)
  }

  return { ref, status, copiar }
}
