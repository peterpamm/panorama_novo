import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { baixarModeloXlsx, type AbaModelo } from '@/lib/modelo-planilha'

interface BotaoModeloPlanilhaProps {
  /** Nome do arquivo baixado, sem extensão (ex: "modelo_metas_armazem"). */
  nomeArquivo: string
  abas: AbaModelo[]
  label?: string
}

/**
 * Botão "Modelo da planilha" das telas de importação — baixa um .xlsx de
 * exemplo montado na hora (ver `modelo-planilha.ts`), com o cabeçalho exato
 * que o parser espera e uma ou duas linhas preenchidas. Fica ao lado do
 * seletor de arquivo pra tirar a dúvida na hora, sem sair da tela.
 */
export function BotaoModeloPlanilha({ nomeArquivo, abas, label = 'Modelo da planilha' }: BotaoModeloPlanilhaProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-2 text-muted-foreground hover:text-foreground"
      onClick={() => baixarModeloXlsx(nomeArquivo, abas)}
    >
      <FileSpreadsheet className="h-4 w-4" />
      {label}
    </Button>
  )
}
