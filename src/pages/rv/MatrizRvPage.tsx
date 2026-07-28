import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Download, Loader2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import { Toaster } from '@/components/ui/toaster'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard, tableCardActionClass } from '@/components/ui/table-card'
import { cn } from '@/lib/utils'
import { useUnidades } from '@/hooks/useUnidades'
import { useRvApuracao, MESES_NOMES, fmtValor } from '@/hooks/useRvApuracao'
import { RV_GENTE_DRE, RV_FINANCEIRO_DRE, RV_FROTA_DRE, RV_SEGURANCA_DRE } from '@/lib/constants'
import { ehSetorRh, ehSetorFinanceiro, ehSetorFrota, ehSetorSeguranca, ehSetorDistribuicao, ehSetorArmazem } from '@/lib/rv-gente'
import { resolverUnidade } from '@/lib/unidade-resolver'

interface LinhaMatriz {
  unidade: string
  negocio: string
  setor: string
  funcao: string
  nome: string
  valor: number
}

function exportarExcel(linhas: LinhaMatriz[], mes: string, ano: string) {
  const dados = linhas.map(l => ({
    Unidade: l.unidade,
    'Negócio': l.negocio,
    Setor: l.setor,
    'Função': l.funcao,
    Nome: l.nome,
    'Valor (R$)': Number(l.valor.toFixed(2)),
  }))
  const planilha = XLSX.utils.json_to_sheet(dados)
  const livro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(livro, planilha, 'Matriz RV')
  XLSX.writeFile(livro, `matriz_rv_${mes.padStart(2, '0')}_${ano}.xlsx`)
}

/**
 * Matriz da RV — /remuneracao-variavel/matriz. Uma linha por liderança de
 * todos os setores, valor final a receber no mês — pra exportar/conferir tudo
 * de uma vez, sem entrar setor por setor. Reaproveita `useRvApuracao` (mesma
 * lógica de cálculo das páginas por setor e do Painel Geral), sem
 * `filtrarUnidade` — traz todas as unidades.
 */
export function MatrizRvPage() {
  const { unidades } = useUnidades()

  const [verAno, setVerAno] = useState('')
  const [verMes, setVerMes] = useState(String(new Date().getMonth() + 1))

  const gente = useRvApuracao({
    setorLabel: 'RH', ehDoSetor: ehSetorRh, indicadoresDre: RV_GENTE_DRE, tabelaPesos: 'rv_gente_pesos_dre', incluirIndicadoresBi: true,
    anoForcado: verAno || undefined, mesForcado: verMes || undefined,
  })
  const financeiro = useRvApuracao({
    setorLabel: 'FINANCEIRO', ehDoSetor: ehSetorFinanceiro, indicadoresDre: RV_FINANCEIRO_DRE, tabelaPesos: 'rv_financeiro_pesos_dre', valesPerdasTabela: 'rv_vales_financeiro_meta',
    anoForcado: verAno || undefined, mesForcado: verMes || undefined,
  })
  const frota = useRvApuracao({
    setorLabel: 'FROTA', ehDoSetor: ehSetorFrota, indicadoresDre: RV_FROTA_DRE, tabelaPesos: 'rv_frota_pesos_dre', incluirDescontoCivf: true, incluirDescontoStressTest: true,
    anoForcado: verAno || undefined, mesForcado: verMes || undefined,
  })
  const seguranca = useRvApuracao({
    setorLabel: 'SEGURANÇA', ehDoSetor: ehSetorSeguranca, indicadoresDre: RV_SEGURANCA_DRE, tabelaPesos: 'rv_seguranca_pesos_dre',
    incluirDtoT2: true, incluirDtoT1: true, incluirGsd: true, incluirLogon: true, incluirExcessoVelocidade: true, incluirFai: true, incluirTri: true,
    anoForcado: verAno || undefined, mesForcado: verMes || undefined,
  })
  const distribuicao = useRvApuracao({
    setorLabel: 'DISTRIBUIÇÃO', ehDoSetor: ehSetorDistribuicao,
    incluirIndisponibilidade: true, incluirPacoteGenteDu: true, valesPerdasTabela: 'rv_vales_distribuicao_meta', incluirLogonDu: true, incluirDevolucao: true, incluirPresenteismoDu: true,
    anoForcado: verAno || undefined, mesForcado: verMes || undefined,
  })
  const armazem = useRvApuracao({
    setorLabel: 'ARMAZÉM', ehDoSetor: ehSetorArmazem,
    incluirArmazemEfc: true, incluirArmazemTmaT2: true, incluirArmazemPresenteismoAlT2: true, incluirArmazemRefugo: true,
    incluirArmazemTmaT1: true, incluirArmazemDisponibilidadeGenteT1: true, incluirArmazemPresenteismoAlT1: true, incluirArmazemQuebras: true,
    anoForcado: verAno || undefined, mesForcado: verMes || undefined,
  })

  const setores = useMemo(() => [
    { label: 'RH', ...gente },
    { label: 'FINANCEIRO', ...financeiro },
    { label: 'FROTA', ...frota },
    { label: 'SEGURANÇA', ...seguranca },
    { label: 'DISTRIBUIÇÃO', ...distribuicao },
    { label: 'ARMAZÉM', ...armazem },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [gente, financeiro, frota, seguranca, distribuicao, armazem])

  const anosDisponiveis = useMemo(
    () => Array.from(new Set(setores.flatMap(s => s.anosDisponiveis))).sort((a, b) => b - a),
    [setores],
  )
  useEffect(() => {
    if (!verAno && anosDisponiveis.length > 0) setVerAno(String(anosDisponiveis[0]))
  }, [anosDisponiveis, verAno])

  const carregando = setores.some(s => s.carregandoTudo)

  const linhas = useMemo<LinhaMatriz[]>(() => {
    return setores
      .flatMap(s => s.linhas.map(l => {
        const unidade = resolverUnidade(l.pessoa.operacao, unidades)
        return {
          unidade: unidade?.nome ?? l.pessoa.operacao,
          negocio: l.pessoa.negocio || '—',
          setor: s.label,
          funcao: l.pessoa.funcao || '—',
          nome: l.pessoa.nome,
          valor: l.aReceber,
        }
      }))
      .sort((a, b) => a.unidade.localeCompare(b.unidade) || a.nome.localeCompare(b.nome))
  }, [setores, unidades])

  const mesLabel = MESES_NOMES[Number(verMes) - 1] ?? ''

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/remuneracao-variavel"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Remuneração Variável
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <h2 className="text-base font-semibold text-foreground">Matriz</h2>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Ano</Label>
          <Select value={verAno} onValueChange={setVerAno}>
            <SelectTrigger className={cn('w-28', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {anosDisponiveis.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Mês</Label>
          <Select value={verMes} onValueChange={setVerMes}>
            <SelectTrigger className={cn('w-40', selectGlamour)}><SelectValue /></SelectTrigger>
            <SelectContent>
              {MESES_NOMES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TableCard
        titulo="Matriz de RV"
        subtitulo={carregando ? 'Carregando...' : `${mesLabel} ${verAno} · ${linhas.length} liderança(s) nos 6 setores`}
        acoes={
          <Button
            variant="outline"
            size="sm"
            className={cn('gap-2', tableCardActionClass)}
            onClick={() => exportarExcel(linhas, verMes, verAno)}
            disabled={carregando || linhas.length === 0}
          >
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
        }
      >
        {carregando ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : linhas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma liderança encontrada pra esse mês.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Negócio</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Valor (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.map((l, i) => (
                <TableRow key={`${l.setor}|${l.nome}|${i}`} className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
                  <TableCell className="text-sm font-medium">{l.unidade}</TableCell>
                  <TableCell className={cn(
                    'text-sm',
                    l.negocio === '—' || l.negocio === 'CONS' ? 'text-muted-foreground' : 'font-semibold text-blue-600 dark:text-blue-400',
                  )}>
                    {l.negocio}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.setor}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.funcao}</TableCell>
                  <TableCell className="text-sm">{l.nome}</TableCell>
                  <TableCell className={cn(
                    'text-right text-sm font-semibold tabular-nums',
                    l.valor > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                  )}>
                    {fmtValor(l.valor)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>

      <Toaster />
    </div>
  )
}
