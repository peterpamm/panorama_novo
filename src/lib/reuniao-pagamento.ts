import { resolverUnidade, normalizarNomeUnidade } from '@/lib/unidade-resolver'
import { unidadesParticipaveis } from '@/lib/reuniao-resultados'
import type { ReuniaoPagamentoLideranca, ReuniaoSetor, SetorPagamento, Unidade } from '@/types'

/**
 * Ponta Grossa e Estância — as únicas duas unidades cuja operação é
 * "Empurrada" (sem Distribuição/DU tradicional), mesma régua de
 * `disponibilidadesDaUnidade` em farol-gerentes.ts. Usado só pra restringir
 * a Filial disponível no cadastro quando o setor escolhido é 'empurrada' —
 * o vencedor do mês continua vindo do ranking de 'distribuicao' pra
 * qualquer unidade, essa lista não entra em nenhum cálculo de apuração.
 */
function ehUnidadeEmpurrada(nome: string): boolean {
  const norm = normalizarNomeUnidade(nome)
  return norm.includes('PONTA GROSSA') || norm.includes('ESTANCIA')
}

/**
 * Combinações de Filial válidas pra um setor do cadastro de pagamento —
 * `unidadesParticipaveis` já resolve os 6 setores reais; 'empurrada' é o
 * mesmo `unidadesParticipaveis(unidades, 'distribuicao')`, só que restrito a
 * Ponta Grossa/Estância (o resultado sai do ranking de 'distribuicao' pra
 * elas, mas o rótulo de cadastro é outro — ver `setorCompativel`).
 */
export function filiaisDoSetorPagamento(unidades: Unidade[], setor: SetorPagamento) {
  if (setor === 'empurrada') {
    return unidadesParticipaveis(unidades, 'distribuicao').filter(p => ehUnidadeEmpurrada(p.nome))
  }
  return unidadesParticipaveis(unidades, setor)
}

/**
 * Resolve o texto de FILIAL (planilha de cadastro de lideranças) pra
 * unidade+negócio, sempre dentro das combinações válidas daquele setor
 * (`filiaisDoSetorPagamento` — a mesma régua da apuração: só Camaçari fora
 * do Financeiro abre em ROTA/ARM, Ponta Grossa nunca abre aqui). Duas
 * tentativas, nessa ordem:
 *
 * 1. O texto bate exatamente com um rótulo participável do setor (ex:
 *    "Camaçari · Rota") — cobre o caso split.
 * 2. Cai pra `resolverUnidade` simples (código/nome/apelido) e usa CONS —
 *    cobre a grande maioria das linhas, e também "Camaçari" sem sufixo (viraria
 *    ambíguo entre Rota/Armazém, então SÓ funciona se o texto já vier com o
 *    sufixo certo — sem sufixo, Camaçari fica sem resolver e a linha vira erro
 *    pra revisão manual, nunca um chute de qual dos dois gerentes é). Setor
 *    'empurrada' pula essa segunda tentativa: só aceita as duas unidades de
 *    `ehUnidadeEmpurrada`, nunca cai pra uma terceira unidade qualquer.
 *
 * Não tenta separar sufixo tipo "PG - Empurrada" — Ponta Grossa nunca abre
 * por negócio na Reunião Resultados, então esse texto deveria ter sido
 * escrito só como "Ponta Grossa" (ou o apelido "PG"); se não bater, é erro
 * pra corrigir na planilha ou cadastrar à mão, nunca um chute.
 */
export function resolverFilialSetor(
  filialTexto: string, setor: SetorPagamento, unidades: Unidade[],
): { unidade: string; negocio: string } | null {
  const alvo = normalizarNomeUnidade(filialTexto)

  const participavel = filiaisDoSetorPagamento(unidades, setor)
    .find(p => normalizarNomeUnidade(p.nome) === alvo)
  if (participavel) return { unidade: participavel.unidade, negocio: participavel.negocio }

  if (setor === 'empurrada') return null

  // Camaçari sem sufixo Rota/Armazém no texto é ambíguo — não faz parte das
  // opções participáveis (que só tem os rótulos COM sufixo pra esse setor),
  // então cai aqui e precisa resolver pela base... mas resolverUnidade pode
  // achar "Camaçari" mesmo assim (nome puro da unidade). Bloqueia esse caso
  // explicitamente: setor != financeiro e a unidade resolvida é Camaçari
  // exige o sufixo, não um consolidado que não existe pra ela.
  const base = resolverUnidade(filialTexto, unidades)
  if (!base) return null
  const ehCamacariSplit = setor !== 'financeiro' && unidadesParticipaveis(unidades, setor)
    .some(p => p.unidade === base.codigo && p.negocio !== 'CONS')
  if (ehCamacariSplit) return null

  return { unidade: base.codigo, negocio: 'CONS' }
}

export interface VencedorSetorMes {
  setor: ReuniaoSetor
  unidade: string
  negocio: string
  nomeUnidade: string
}

export interface PagamentoLinha {
  nome: string
  numeroExtratta: string
  setor: SetorPagamento
  unidade: string
  negocio: string
  nomeUnidade: string
  valor: number
}

/** Ordem de exibição no relatório — mesma ordem usada em todo o app (SETORES_LABEL, ReuniaoResultadosPage). São os 6 setores com ranking próprio — 'empurrada' nunca aparece aqui, só no cadastro (ver `ORDEM_SETORES_CADASTRO`). */
export const ORDEM_SETORES: ReuniaoSetor[] = ['financeiro', 'gente', 'frota', 'seguranca', 'distribuicao', 'armazem']

/** Mesma ordem, com 'empurrada' logo depois de 'distribuicao' — pro seletor de Setor do cadastro manual, que precisa oferecer os 7 rótulos. */
export const ORDEM_SETORES_CADASTRO: SetorPagamento[] = ['financeiro', 'gente', 'frota', 'seguranca', 'distribuicao', 'empurrada', 'armazem']

/** Rótulo de exibição de cada setor — mesmos nomes usados no hub da Reunião Resultados, + Empurrada (Ponta Grossa/Estância). */
export const SETOR_LABEL: Record<SetorPagamento, string> = {
  financeiro: 'Financeiro', gente: 'Gente', frota: 'Frota',
  seguranca: 'Segurança', distribuicao: 'Distribuição', armazem: 'Armazém',
  empurrada: 'Empurrada',
}

/**
 * Se uma liderança cadastrada com `setorLideranca` deve receber o prêmio de
 * um vencedor do setor `setorVencedor` — igual na maioria dos casos, mas
 * 'empurrada' (cadastro) é sempre um alias de 'distribuicao' (ranking): quem
 * cadastrou a liderança de Ponta Grossa/Estância como "Empurrada" recebe
 * quando essa unidade vence o ranking de Distribuição, mesmo o rótulo sendo
 * outro.
 */
export function setorCompativel(setorLideranca: SetorPagamento, setorVencedor: ReuniaoSetor): boolean {
  if (setorLideranca === setorVencedor) return true
  return setorLideranca === 'empurrada' && setorVencedor === 'distribuicao'
}

/**
 * Divide o prêmio entre as lideranças cadastradas pra cada unidade×negócio
 * vencedora — 1 pessoa leva o prêmio inteiro; 2+ pessoas dividem em partes
 * iguais (arredondado a centavos; com 3+ pessoas a soma pode variar 1 centavo
 * do prêmio cheio, sem ajuste de resto — não vale a complexidade pra um caso
 * raro). Vencedor sem NENHUMA liderança cadastrada pra aquele setor/unidade
 * simplesmente não gera linha — quem chama deve avisar esse caso separado
 * (ver `vencedoresSemLideranca`), pra não pagar errado nem enterrar o alerta.
 */
export function calcularPagamentos(
  vencedores: VencedorSetorMes[],
  liderancas: ReuniaoPagamentoLideranca[],
  valorPremio: number,
): PagamentoLinha[] {
  const linhas: PagamentoLinha[] = []
  for (const v of vencedores) {
    const pessoas = liderancas.filter(l => l.unidade === v.unidade && l.negocio === v.negocio && setorCompativel(l.setor, v.setor))
    if (pessoas.length === 0) continue
    const valorCada = Math.round((valorPremio / pessoas.length) * 100) / 100
    for (const p of pessoas) {
      linhas.push({
        // Mostra o rótulo com que a liderança foi cadastrada (pode ser
        // 'empurrada'), não o setor bruto do ranking — é o que faz sentido
        // pra quem vai receber o relatório.
        nome: p.nome, numeroExtratta: p.numero_extratta, setor: p.setor,
        unidade: v.unidade, negocio: v.negocio, nomeUnidade: v.nomeUnidade, valor: valorCada,
      })
    }
  }
  return linhas.sort((a, b) => ORDEM_SETORES_CADASTRO.indexOf(a.setor) - ORDEM_SETORES_CADASTRO.indexOf(b.setor))
}

/** Vencedores do mês sem NENHUMA liderança cadastrada pro setor/unidade — ficam de fora do relatório e precisam de alerta explícito (dinheiro que ninguém vai receber por falta de cadastro). */
export function vencedoresSemLideranca(vencedores: VencedorSetorMes[], liderancas: ReuniaoPagamentoLideranca[]): VencedorSetorMes[] {
  return vencedores.filter(v => !liderancas.some(l => l.unidade === v.unidade && l.negocio === v.negocio && setorCompativel(l.setor, v.setor)))
}
