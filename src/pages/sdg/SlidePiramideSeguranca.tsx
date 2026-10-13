import { agruparPorClassificacao, agruparPorMes, contarSif, eventosGraves, ordenarPorSeveridade } from '@/lib/piramide-seguranca'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TableCard } from '@/components/ui/table-card'
import { cn } from '@/lib/utils'
import type { RelatoSeguranca } from '@/types'

const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** "2026-08-31" → "31/08/2026". */
function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

interface Props {
  /** Relatos do ANO inteiro da unidade — a grade de meses mostra Jan até `mes`, não só o mês selecionado. */
  relatos: RelatoSeguranca[]
  ano: number
  mes: number
}

/**
 * Cor de cada fileira da pirâmide por palavra-chave da classificação — cobre
 * as classificações já vistas nos dados reais (Incidente, Ato Inseguro,
 * Condição Insegura, Abordagem Positiva) e os termos padrão de segurança que
 * ainda não apareceram mas podem aparecer (Fatal, LTI/MDI/MTI/FAI, Quase
 * Acidente). Qualquer coisa fora dessas palavras-chave cai no cinza — nunca
 * esconde uma classificação nova, só não sabe qual cor "oficial" dar a ela.
 */
function corClassificacao(classificacao: string): string {
  const c = classificacao.toUpperCase()
  if (c.includes('FATAL')) return 'border-red-700 text-red-700 dark:border-red-400 dark:text-red-400'
  if (c.includes('LTI') || c.includes('MDI') || c.includes('MTI') || c.includes('FAI') || c.includes('ACIDENTE')) {
    return 'border-orange-500 text-orange-600 dark:border-orange-400 dark:text-orange-400'
  }
  if (c.includes('INCIDENTE') || c.includes('QUASE')) return 'border-amber-500 text-amber-700 dark:border-amber-400 dark:text-amber-400'
  if (c.includes('ATO INSEGURO') || (c.includes('CONDI') && c.includes('INSEGURA'))) return 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
  if (c.includes('ABORDAGEM POSITIVA') || c.includes('COMPORTAMENTO')) return 'border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
  return 'border-slate-400 text-slate-600 dark:border-slate-500 dark:text-slate-400'
}

const LARGURA_MIN = 40
const LARGURA_MAX = 100
const ALTURA_LINHA = 'h-11'

function CardEstatistica({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-3 text-center dark:bg-slate-900/40">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">{label}</p>
      <p className={cn('text-2xl font-black', destaque && valor > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white')}>
        {valor.toLocaleString('pt-BR')}
      </p>
    </div>
  )
}

/**
 * Slide "Pirâmide de Segurança" do SDG Gerentes — relatos importados
 * (`relatos_seguranca`, migration 115) agrupados por CLASSIFICAÇÃO. Layout
 * inspirado numa referência que o usuário trouxe: a pirâmide (só os rótulos,
 * estreita no topo/grave, larga na base/comum) fica de um lado, e do outro
 * uma grade com uma coluna por mês (Jan até o mês selecionado) — cada célula
 * alinhada com a fileira da pirâmide correspondente mostra o total daquele
 * mês pra aquela classificação, com o total do mês embaixo. A pirâmide
 * SEMPRE mostra as 9 fileiras padrão (`ordenarPorSeveridade`), mesmo
 * zeradas — a forma não muda mês a mês, só os números dentro; uma
 * classificação fora dessas 9 (nova, ainda não catalogada) entra a mais,
 * depois delas, sem nunca desaparecer.
 */
export function SlidePiramideSeguranca({ relatos, ano, mes }: Props) {
  const relatosAteMes = relatos.filter(r => r.mes <= mes)
  const relatosDoMes = relatos.filter(r => r.mes === mes)
  const camadas = ordenarPorSeveridade(agruparPorClassificacao(relatosAteMes))
  const meses = agruparPorMes(relatosAteMes, 1, mes)
  const totalPeriodo = relatosAteMes.length
  const totalMesSelecionado = relatosDoMes.length
  const sifMesSelecionado = contarSif(relatosDoMes)
  const sifAcumulado = contarSif(relatosAteMes)
  const eventos = eventosGraves(relatos, mes)

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex flex-col gap-5 p-6">
        <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-slate-400">Segurança — {ano}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">Pirâmide de Segurança</p>
            <p className="text-sm text-muted-foreground">Distribuição dos relatos por classificação e evolução mensal</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CardEstatistica label="Acumulado Ano" valor={totalPeriodo} />
            <CardEstatistica label={`Total ${MES_ABREV[mes - 1]}`} valor={totalMesSelecionado} />
            <CardEstatistica label={`SIF ${MES_ABREV[mes - 1]}`} valor={sifMesSelecionado} destaque />
            <CardEstatistica label="SIF Acumulado" valor={sifAcumulado} destaque />
          </div>
        </div>

        <div className="rounded-2xl bg-white shadow dark:bg-slate-800/60 p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            {/* Pirâmide — só os rótulos, sempre as 9 fileiras padrão. O
                rótulo "Classificação" entra como a PRIMEIRA linha do mesmo
                flex column (mesma altura h-8 e mesmo gap-1.5 das fileiras
                de baixo) — precisa ser exatamente a mesma estrutura da
                grade de meses do lado (cabeçalho + linhas, tudo com o mesmo
                gap uniforme), senão qualquer diferença de margem entre os
                dois lados desalinha a pirâmide da grade. */}
            <div>
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex h-8 w-full items-center text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">
                  Classificação
                </div>
                {camadas.map((camada, i) => {
                  const largura = camadas.length === 1
                    ? LARGURA_MAX
                    : LARGURA_MIN + (i / (camadas.length - 1)) * (LARGURA_MAX - LARGURA_MIN)
                  return (
                    <div
                      key={camada.classificacao}
                      className={cn(
                        ALTURA_LINHA,
                        'flex items-center justify-center rounded-lg border-2 px-3 text-center',
                        corClassificacao(camada.classificacao),
                      )}
                      style={{ width: `${largura}%` }}
                    >
                      <span className="truncate text-sm font-bold uppercase tracking-wide">{camada.classificacao}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Grade de meses — uma coluna por mês, alinhada com as fileiras da pirâmide */}
            <div className="overflow-x-auto">
              <div className="inline-grid min-w-full gap-1.5" style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(56px, 1fr))` }}>
                {meses.map(colMes => (
                  <div
                    key={colMes.mes}
                    className={cn(
                      'flex h-8 items-center justify-center text-xs font-bold uppercase tracking-wide',
                      colMes.mes === mes ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500',
                    )}
                  >
                    {MES_ABREV[colMes.mes - 1]}
                  </div>
                ))}
                {camadas.map(camada => (
                  meses.map(colMes => {
                    const valor = colMes.porClassificacao.get(camada.classificacao) ?? 0
                    return (
                      <div
                        key={`${camada.classificacao}|${colMes.mes}`}
                        className={cn(
                          ALTURA_LINHA,
                          'flex items-center justify-center rounded-lg border tabular-nums text-base font-bold',
                          valor === 0
                            ? 'border-gray-200 text-gray-300 dark:border-slate-700 dark:text-slate-600'
                            : 'border-gray-200 text-gray-900 dark:border-slate-700 dark:text-white',
                        )}
                      >
                        {valor}
                      </div>
                    )
                  })
                ))}
                {meses.map(colMes => (
                  <div key={`total-${colMes.mes}`} className="mt-2 flex flex-col items-center gap-0.5 border-t border-gray-200 pt-2 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-slate-500">Total</span>
                    <span className="text-base font-black tabular-nums text-gray-900 dark:text-white">{colMes.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {eventos.length > 0 && (
          <TableCard
            titulo="Eventos graves do mês"
            subtitulo={`${MES_ABREV[mes - 1]}/${ano} — Fatal (sempre) ou Incidente/LTI/MDI/FAI/MTI marcados como SIF Percusor/Potencial`}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Ocorrência</TableHead>
                  <TableHead>Classificação</TableHead>
                  <TableHead>Detalhamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventos.map(evento => (
                  <TableRow key={evento.relato_id}>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatarDataBr(evento.data_ocorrencia)}</TableCell>
                    <TableCell>
                      <span className={cn('rounded-lg border-2 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide', corClassificacao(evento.classificacao))}>
                        {evento.classificacao}
                      </span>
                      {/* FATAL entra na tabela mesmo sem SIF (ver `eventosGraves`) — só mostra o badge quando a linha de fato tem um sif_tipo (mostra o tipo exato em vez de um "SIF" genérico). */}
                      {evento.sif_tipo && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700 dark:bg-red-950/40 dark:text-red-400">
                          {evento.sif_tipo}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{evento.detalhamento || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        )}
      </div>
    </div>
  )
}
