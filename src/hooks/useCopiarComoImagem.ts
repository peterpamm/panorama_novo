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
    const isDark = document.documentElement.classList.contains('dark')
    const opcoes = {
      pixelRatio: 2,
      backgroundColor: isDark ? '#111827' : '#eef2f7',
      filter: (node: HTMLElement) => !('noPrint' in (node.dataset ?? {})),
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
        return
      }
    }
    setTimeout(() => setStatus('idle'), 2000)
  }

  return { ref, status, copiar }
}
