import { FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { baixarModeloCsv, baixarModeloXlsx, type AbaModelo } from '@/lib/modelo-planilha'

interface BotaoModeloPlanilhaProps {
  /** Nome do arquivo baixado, sem extensão (ex: "modelo_metas_armazem"). */
  nomeArquivo: string
  abas: AbaModelo[]
  label?: string
  /** 'xlsx' (default) ou 'csv' — use 'csv' pras telas que importam .csv (ex: Indisponibilidade/Devolução), só a 1ª aba é usada nesse caso (csv não tem conceito de aba). */
  formato?: 'xlsx' | 'csv'
}

/**
 * Botão "Modelo da planilha" das telas de importação — baixa um exemplo
 * montado na hora (ver `modelo-planilha.ts`), com o cabeçalho exato que o
 * parser espera e uma ou duas linhas preenchidas. Fica ao lado do seletor de
 * arquivo pra tirar a dúvida na hora, sem sair da tela.
 */
export function BotaoModeloPlanilha({ nomeArquivo, abas, label = 'Modelo da planilha', formato = 'xlsx' }: BotaoModeloPlanilhaProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-2 text-muted-foreground hover:text-foreground"
      onClick={() => formato === 'csv' ? baixarModeloCsv(nomeArquivo, abas[0]) : baixarModeloXlsx(nomeArquivo, abas)}
    >
      <FileSpreadsheet className="h-4 w-4" />
      {label}
    </Button>
  )
}
