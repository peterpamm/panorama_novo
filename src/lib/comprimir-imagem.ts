/**
 * Recomprime uma imagem (jpeg/png) pro upload de prints do SDG — sempre
 * reexporta como JPEG, capando a maior dimensão em `maxDim` — evita que um
 * print em 4K/PNG sem compressão vire alguns MB por indicador × mês.
 */
export function comprimirImagem(file: File, maxDim = 1600, qualidade = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const escala = Math.min(1, maxDim / Math.max(img.width, img.height))
      const largura = Math.round(img.width * escala)
      const altura = Math.round(img.height * escala)
      const canvas = document.createElement('canvas')
      canvas.width = largura
      canvas.height = altura
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas não suportado nesse navegador.')); return }
      ctx.drawImage(img, 0, 0, largura, altura)
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Não consegui gerar a imagem comprimida.')),
        'image/jpeg',
        qualidade,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui ler essa imagem.')) }
    img.src = url
  })
}
