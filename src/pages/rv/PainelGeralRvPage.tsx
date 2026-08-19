import { forwardRef, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Camera, Check, ChevronLeft, Loader2 } from 'lucide-react'
import { Toaster } from '@/components/ui/toaster'
import { PillToggle } from '@/components/ui/pill-toggle'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectGlamour } from '@/components/ui/field-styles'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard, tableCardActionClass } from '@/components/ui/table-card'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { useUnidades } from '@/hooks/useUnidades'
import { useCopiarComoImagem } from '@/hooks/useCopiarComoImagem'
import { useFinanceiroDreAjustes } from '@/hooks/useFinanceiroDreAjustes'
import { useRvApuracao, MESES_NOMES, fmtPeso, fmtValor, type LinhaApuracao } from '@/hooks/useRvApuracao'
import { RV_GENTE_DRE, RV_FINANCEIRO_DRE, RV_FROTA_DRE, RV_SEGURANCA_DRE } from '@/lib/constants'
import { ehSetorRh, ehSetorFinanceiro, ehSetorFrota, ehSetorSeguranca, ehSetorDistribuicao, ehSetorArmazem, ehSetorEmpurrada } from '@/lib/rv-gente'

type AbaPainelGeral = 'setor' | 'lideranca' | 'indicador'

const ABAS = [
  { value: 'setor', label: 'Por Setor' },
  { value: 'lideranca', label: 'Por Liderança' },
  { value: 'indicador', label: 'Por Indicador' },
] as const

interface LinhaComSetor extends LinhaApuracao {
  setorNome?: string
}

/** Mesma tabela de apuração do RvApuracao (linhas já calculadas por useRvApuracao), reaproveitada aqui pra não duplicar a lógica de cálculo — só a apresentação. `setorNome` aparece como coluna extra no modo "Por Liderança". Aceita ref + `acoes` (ex: botão "Copiar imagem") — repassados direto pro TableCard. */
const TabelaApuracao = forwardRef<HTMLDivElement, {
  titulo: string
  subtitulo: string
  linhas: LinhaComSetor[]
  carregando: boolean
  semLiderancas: boolean
  totalBase: number
  totalReceber: number
  mostrarSetor?: boolean
  acoes?: React.ReactNode
}>(function TabelaApuracao({ titulo, subtitulo, linhas, carregando, semLiderancas, totalBase, totalReceber, mostrarSetor, acoes }, ref) {
  return (
    <TableCard ref={ref} titulo={titulo} subtitulo={subtitulo} acoes={acoes}>
      {carregando ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando apuração...
        </div>
      ) : linhas.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          {semLiderancas ? 'Nenhuma liderança dessa unidade nesse setor.' : 'Nenhuma liderança encontrada pra essa unidade.'}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {mostrarSetor && <TableHead>Setor</TableHead>}
              <TableHead>Nome</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Operação</TableHead>
              <TableHead>Negócio</TableHead>
              <TableHead>Indicadores do mês</TableHead>
              <TableHead className="text-center">% RV</TableHead>
              <TableHead className="text-right">RV (R$)</TableHead>
              <TableHead className="text-right">A receber (R$)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(l => (
              <TableRow
                key={`${l.setorNome ?? ''}|${l.pessoa.id ?? l.pessoa.nome}`}
                className="border-gray-200/30 dark:border-gray-700/30 hover:bg-gray-50/50 dark:hover:bg-gray-700/30"
              >
                {mostrarSetor && <TableCell className="text-xs text-muted-foreground">{l.setorNome}</TableCell>}
                <TableCell className="text-sm font-medium">{l.pessoa.nome}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{l.pessoa.funcao || '—'}</TableCell>
                <TableCell className="text-sm">{l.pessoa.operacao}</TableCell>
                <TableCell className={cn(
                  'text-sm',
                  !l.pessoa.negocio || l.pessoa.negocio === 'CONS'
                    ? 'text-muted-foreground'
                    : 'font-semibold text-blue-600 dark:text-blue-400',
                )}>
                  {l.pessoa.negocio || '—'}
                </TableCell>
                <TableCell>
                  {!l.unidadeOk ? (
                    <span
                      title="Nenhuma unidade cadastrada casa com essa operação — confira o nome/apelidos na Administração"
                      className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      operação não reconhecida
                    </span>
                  ) : l.itens.length === 0 ? (
                    <span className="text-xs text-muted-foreground">sem indicadores com peso</span>
                  ) : (
                    <div className="flex max-w-xl flex-wrap gap-1">
                      {l.itens.map(item => (
                        <span
                          key={item.chave}
                          title={item.detalhe}
                          className={cn(
                            'cursor-default rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                            item.status === 'bateu' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
                            item.status === 'perdeu' && 'bg-red-500/15 text-red-700 dark:text-red-400',
                            item.status === 'pendente' && 'bg-muted text-muted-foreground',
                          )}
                        >
                          {item.rotulo} · {fmtPeso(item.peso)}%
                        </span>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell
                  title={l.pctPossivel > 0 ? `de ${fmtPeso(l.pctPossivel)}% possível no mês` : undefined}
                  className={cn(
                    'text-center text-sm font-semibold tabular-nums',
                    l.pctConquistado > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                  )}
                >
                  {fmtPeso(l.pctConquistado)}%
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                  {fmtValor(l.pessoa.valor)}
                </TableCell>
                <TableCell className={cn(
                  'text-right text-sm font-semibold tabular-nums',
                  l.aReceber > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                )}>
                  {fmtValor(l.aReceber)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-gray-200/30 dark:border-gray-700/30 bg-muted/40 font-semibold hover:bg-muted/40">
              <TableCell colSpan={mostrarSetor ? 7 : 6} className="text-sm">Total</TableCell>
              <TableCell className="text-right text-sm tabular-nums">{fmtValor(totalBase)}</TableCell>
              <TableCell className="text-right text-sm tabular-nums text-emerald-600 dark:text-emerald-400">
                {fmtValor(totalReceber)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </TableCard>
  )
})

/**
 * Painel Geral da RV — /remuneracao-variavel/painel-geral. Uma unidade não
 * vê o resultado da outra, então as subpáginas por setor (Gente, Financeiro,
 * Frota, Segurança, Distribuição, Armazém) são corporativas (mostram todas
 * as lideranças). Esse painel é a visão do gerente de uma unidade: mesma
 * apuração (useRvApuracao, reaproveitado sem duplicar a lógica de cálculo),
 * só que filtrada pra uma unidade só, com um Ano/Mês compartilhado entre
 * todos os setores. Admin ganha um seletor pra pré-visualizar qualquer
 * unidade; usuário de unidade fica travado na própria.
 */
export function PainelGeralRvPage() {
  const { role, unidade: minhaUnidade, rvNegocio, souDono } = useAuth()
  const { unidades } = useUnidades()
  const [aba, setAba] = useState<AbaPainelGeral>('setor')
  // Ajuste manual TEMPORÁRIO de Multas/Vales do Financeiro (bug do DRE) —
  // aqui só pra manter o total batendo com a Apuração da RvFinanceiroPage,
  // sem UI de edição (edita lá, não aqui).
  const { ajustes: ajustesFinanceiro } = useFinanceiroDreAjustes(souDono)

  const unidadesDisponiveis = useMemo(
    () => role === 'admin'
      ? unidades.filter(u => u.codigo !== 'AMBEV')
      : unidades.filter(u => u.codigo === minhaUnidade),
    [role, minhaUnidade, unidades],
  )
  const [unidadeSel, setUnidadeSel] = useState('')
  useEffect(() => {
    if (unidadeSel || unidadesDisponiveis.length === 0) return
    setUnidadeSel(role === 'admin' ? unidadesDisponiveis[0].codigo : (minhaUnidade ?? unidadesDisponiveis[0].codigo))
  }, [unidadesDisponiveis, unidadeSel, role, minhaUnidade])

  const [verAno, setVerAno] = useState('')
  const [verMes, setVerMes] = useState(String(new Date().getMonth() + 1))

  const gente = useRvApuracao({
    setorLabel: 'RH', ehDoSetor: ehSetorRh, indicadoresDre: RV_GENTE_DRE, tabelaPesos: 'rv_gente_pesos_dre', incluirIndicadoresBi: true,
    filtrarUnidade: unidadeSel, filtrarNegocio: rvNegocio ?? undefined, anoForcado: verAno || undefined, mesForcado: verMes || undefined,
  })
  const financeiro = useRvApuracao({
    setorLabel: 'FINANCEIRO', ehDoSetor: ehSetorFinanceiro, indicadoresDre: RV_FINANCEIRO_DRE, tabelaPesos: 'rv_financeiro_pesos_dre', valesPerdasTabela: 'rv_vales_financeiro_meta',
    ajustesFinanceiro,
    filtrarUnidade: unidadeSel, filtrarNegocio: rvNegocio ?? undefined, anoForcado: verAno || undefined, mesForcado: verMes || undefined,
  })
  const frota = useRvApuracao({
    setorLabel: 'FROTA', ehDoSetor: ehSetorFrota, indicadoresDre: RV_FROTA_DRE, tabelaPesos: 'rv_frota_pesos_dre', incluirDescontoCivf: true, incluirDescontoStressTest: true,
    filtrarUnidade: unidadeSel, filtrarNegocio: rvNegocio ?? undefined, anoForcado: verAno || undefined, mesForcado: verMes || undefined,
  })
  const seguranca = useRvApuracao({
    setorLabel: 'SEGURANÇA', ehDoSetor: ehSetorSeguranca, indicadoresDre: RV_SEGURANCA_DRE, tabelaPesos: 'rv_seguranca_pesos_dre',
    incluirDtoT2: true, incluirDtoT1: true, incluirGsd: true, incluirLogon: true, incluirExcessoVelocidade: true, incluirFai: true, incluirTri: true,
    filtrarUnidade: unidadeSel, filtrarNegocio: rvNegocio ?? undefined, anoForcado: verAno || undefined, mesForcado: verMes || undefined,
  })
  const distribuicao = useRvApuracao({
    setorLabel: 'DISTRIBUIÇÃO', ehDoSetor: ehSetorDistribuicao,
    indisponibilidadeTabela: 'rv_indisponibilidade_meta', incluirPacoteGenteDu: true, valesPerdasTabela: 'rv_vales_distribuicao_meta', incluirLogonDu: true, incluirDevolucao: true, incluirPresenteismoDu: true,
    filtrarUnidade: unidadeSel, filtrarNegocio: rvNegocio ?? undefined, anoForcado: verAno || undefined, mesForcado: verMes || undefined,
  })
  const armazem = useRvApuracao({
    setorLabel: 'ARMAZÉM', ehDoSetor: ehSetorArmazem,
    incluirArmazemEfc: true, incluirArmazemTmaT2: true, incluirArmazemPresenteismoAlT2: true, incluirArmazemRefugo: true,
    incluirArmazemTmaT1: true, incluirArmazemDisponibilidadeGenteT1: true, incluirArmazemPresenteismoAlT1: true, incluirArmazemQuebras: true,
    filtrarUnidade: unidadeSel, filtrarNegocio: rvNegocio ?? undefined, anoForcado: verAno || undefined, mesForcado: verMes || undefined,
  })
  const empurrada = useRvApuracao({
    setorLabel: 'EMPURRADA', ehDoSetor: ehSetorEmpurrada,
    indisponibilidadeTabela: 'rv_empurrada_indisponibilidade_meta', incluirAvariaTransporte: true,
    incluirGty: true, incluirTmv: true, incluirTempoRendicao: true,
    filtrarUnidade: unidadeSel, filtrarNegocio: rvNegocio ?? undefined, anoForcado: verAno || undefined, mesForcado: verMes || undefined,
  })

  const setores = useMemo(() => [
    { label: 'RH', ...gente },
    { label: 'FINANCEIRO', ...financeiro },
    { label: 'FROTA', ...frota },
    { label: 'SEGURANÇA', ...seguranca },
    { label: 'DISTRIBUIÇÃO', ...distribuicao },
    { label: 'ARMAZÉM', ...armazem },
    { label: 'EMPURRADA', ...empurrada },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [gente, financeiro, frota, seguranca, distribuicao, armazem, empurrada])

  const anosDisponiveis = useMemo(
    () => Array.from(new Set(setores.flatMap(s => s.anosDisponiveis))).sort((a, b) => b - a),
    [setores],
  )
  useEffect(() => {
    if (!verAno && anosDisponiveis.length > 0) setVerAno(String(anosDisponiveis[0]))
  }, [anosDisponiveis, verAno])

  const carregandoGeral = setores.some(s => s.carregandoTudo)

  const todasLinhas = useMemo<LinhaComSetor[]>(
    () => setores.flatMap(s => s.linhas.map(l => ({ ...l, setorNome: s.label })))
      .sort((a, b) => a.pessoa.nome.localeCompare(b.pessoa.nome)),
    [setores],
  )
  const totalBaseGeral = todasLinhas.reduce((acc, l) => acc + l.pessoa.valor, 0)
  const totalReceberGeral = todasLinhas.reduce((acc, l) => acc + l.aReceber, 0)

  const nomeUnidadeSel = unidades.find(u => u.codigo === unidadeSel)?.nome ?? unidadeSel

  const { ref: refLideranca, status: statusLideranca, copiar: copiarLideranca } = useCopiarComoImagem(`rv_por_lideranca_${nomeUnidadeSel}`)

  // ── Por Indicador: uma liderança só, meta/resultado do mês — pra imprimir/enviar pro colaborador ──
  const [pessoaSel, setPessoaSel] = useState('')
  useEffect(() => { setPessoaSel('') }, [unidadeSel])
  const linhaPessoaSel = todasLinhas.find(l => (l.pessoa.id ?? l.pessoa.nome) === pessoaSel)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/remuneracao-variavel"
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Remuneração Variável
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <h2 className="text-base font-semibold text-foreground">Painel Geral</h2>
        </div>
        <PillToggle opcoes={ABAS} value={aba} onChange={setAba} />
      </div>

      <p className="max-w-2xl text-sm text-muted-foreground">
        Acompanhamento da RV de todas as lideranças de uma unidade só, reunindo os 7 setores num lugar — mesmos dados
        e mesma regra de cálculo das páginas de RV por setor, só filtrado pra essa unidade.
        {rvNegocio && ' Seu acesso é restrito às lideranças do seu negócio nessa unidade — não aparece a RV de outro gerente.'}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        {role === 'admin' && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Unidade</Label>
            <Select value={unidadeSel} onValueChange={setUnidadeSel}>
              <SelectTrigger className={cn('w-56', selectGlamour)}><SelectValue /></SelectTrigger>
              <SelectContent>
                {unidadesDisponiveis.map(u => <SelectItem key={u.codigo} value={u.codigo}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
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

      {!unidadeSel ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          {role === 'admin' ? 'Selecione uma unidade.' : 'Sua conta não tem uma unidade associada — fale com o admin.'}
        </p>
      ) : aba === 'setor' ? (
        <div className="space-y-6">
          {setores.map(s => (
            <TabelaApuracao
              key={s.label}
              titulo={`${s.label} — ${nomeUnidadeSel}`}
              subtitulo={s.carregandoTudo
                ? 'Carregando...'
                : `${MESES_NOMES[Number(verMes) - 1] ?? ''} ${verAno} · ${s.linhas.length} liderança(s)`}
              linhas={s.linhas}
              carregando={s.carregandoTudo}
              semLiderancas={s.liderancas.length > 0}
              totalBase={s.totalBase}
              totalReceber={s.totalReceber}
            />
          ))}
        </div>
      ) : aba === 'lideranca' ? (
        <TabelaApuracao
          ref={refLideranca}
          titulo={`Todas as lideranças — ${nomeUnidadeSel}`}
          subtitulo={carregandoGeral
            ? 'Carregando...'
            : `${MESES_NOMES[Number(verMes) - 1] ?? ''} ${verAno} · ${todasLinhas.length} liderança(s) nos 7 setores`}
          linhas={todasLinhas}
          carregando={carregandoGeral}
          semLiderancas
          totalBase={totalBaseGeral}
          totalReceber={totalReceberGeral}
          mostrarSetor
          acoes={
            <Button
              variant="outline" size="sm" className={cn('gap-2', tableCardActionClass)}
              onClick={copiarLideranca} disabled={statusLideranca === 'copiando' || carregandoGeral}
            >
              {statusLideranca === 'copiado' ? <Check className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {statusLideranca === 'copiado' ? 'Copiado!' : statusLideranca === 'copiando' ? 'Gerando...' : 'Copiar imagem'}
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Liderança</Label>
            <Select value={pessoaSel} onValueChange={setPessoaSel}>
              <SelectTrigger className={cn('w-72', selectGlamour)}><SelectValue placeholder="Escolha..." /></SelectTrigger>
              <SelectContent>
                {todasLinhas.map(l => (
                  <SelectItem key={l.pessoa.id ?? l.pessoa.nome} value={l.pessoa.id ?? l.pessoa.nome}>
                    {l.pessoa.nome} · {l.setorNome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {carregandoGeral ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : !linhaPessoaSel ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Selecione uma liderança pra ver o detalhamento.</p>
          ) : (
            <TableCard
              titulo={linhaPessoaSel.pessoa.nome}
              subtitulo={`${linhaPessoaSel.setorNome} · ${linhaPessoaSel.pessoa.funcao || '—'} · ${linhaPessoaSel.pessoa.operacao} · ${MESES_NOMES[Number(verMes) - 1] ?? ''} ${verAno}`}
            >
              <div className="grid grid-cols-2 divide-x divide-gray-200/30 border-b border-gray-200/30 dark:divide-gray-700/30 dark:border-gray-700/30">
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">% RV conquistado</p>
                  <p className={cn(
                    'mt-1 text-2xl font-bold tabular-nums',
                    linhaPessoaSel.pctConquistado > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                  )}>
                    {fmtPeso(linhaPessoaSel.pctConquistado)}%
                  </p>
                </div>
                <div className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">Valor a receber</p>
                  <p className={cn(
                    'mt-1 text-2xl font-bold tabular-nums',
                    linhaPessoaSel.aReceber > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                  )}>
                    {fmtValor(linhaPessoaSel.aReceber)}
                  </p>
                </div>
              </div>

              {linhaPessoaSel.itens.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Sem indicadores com peso pra essa liderança.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indicador</TableHead>
                      <TableHead className="text-center">Meta</TableHead>
                      <TableHead className="text-center">Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhaPessoaSel.itens.map(item => (
                      <TableRow key={item.chave} className="border-gray-200/30 dark:border-gray-700/30">
                        <TableCell className="text-sm font-medium">{item.rotulo}</TableCell>
                        <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                          {item.metaFmt ?? '—'}
                        </TableCell>
                        <TableCell
                          title={item.detalhe}
                          className={cn(
                            'text-center text-sm font-semibold tabular-nums',
                            item.status === 'bateu' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                            item.status === 'perdeu' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                            item.status === 'pendente' && 'text-muted-foreground',
                          )}
                        >
                          {item.resultadoFmt ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TableCard>
          )}
        </div>
      )}

      <Toaster />
    </div>
  )
}
