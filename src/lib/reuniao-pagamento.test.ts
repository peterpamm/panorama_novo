import { describe, expect, it } from 'vitest'
import { calcularPagamentos, filiaisDoSetorPagamento, resolverFilialSetor, setorCompativel, vencedoresSemLideranca, type VencedorSetorMes } from './reuniao-pagamento'
import type { ReuniaoPagamentoLideranca, Unidade } from '@/types'

function unidade(codigo: string, nome: string, apelidos: string[] = []): Unidade {
  return { id: codigo, codigo, nome, nome_ginfo: null, data_entrada: null, apelidos }
}

const UNIDADES: Unidade[] = [
  unidade('DIADEMA', 'Diadema'),
  unidade('CAMACARI', 'Camaçari'),
  unidade('PG', 'Ponta Grossa', ['PG']),
  unidade('ESTANCIA', 'Estância'),
]

describe('resolverFilialSetor', () => {
  it('resolve unidade simples direto pelo nome, negócio CONS', () => {
    expect(resolverFilialSetor('DIADEMA', 'financeiro', UNIDADES)).toEqual({ unidade: 'DIADEMA', negocio: 'CONS' })
  })

  it('resolve Camaçari com sufixo Rota/Armazém, fora do Financeiro', () => {
    expect(resolverFilialSetor('Camaçari · Rota', 'gente', UNIDADES)).toEqual({ unidade: 'CAMACARI', negocio: 'ROTA' })
    expect(resolverFilialSetor('Camaçari · Armazém', 'gente', UNIDADES)).toEqual({ unidade: 'CAMACARI', negocio: 'ARM' })
  })

  it('Camaçari sem sufixo é ambíguo fora do Financeiro — não resolve (evita chutar qual gerente)', () => {
    expect(resolverFilialSetor('Camaçari', 'gente', UNIDADES)).toBeNull()
  })

  it('Camaçari sem sufixo resolve normal no Financeiro, que nunca abre por negócio', () => {
    expect(resolverFilialSetor('Camaçari', 'financeiro', UNIDADES)).toEqual({ unidade: 'CAMACARI', negocio: 'CONS' })
  })

  it('Ponta Grossa nunca abre por negócio — resolve pelo apelido puro, CONS', () => {
    expect(resolverFilialSetor('PG', 'gente', UNIDADES)).toEqual({ unidade: 'PG', negocio: 'CONS' })
  })

  it('Ponta Grossa com sufixo pessoal ("PG - Empurrada") não bate com nada — fica pra revisão manual, não chuta', () => {
    expect(resolverFilialSetor('PG - EMPURRADA', 'gente', UNIDADES)).toBeNull()
  })

  it('texto sem nenhuma correspondência devolve null', () => {
    expect(resolverFilialSetor('Filial Inexistente', 'financeiro', UNIDADES)).toBeNull()
  })

  it('setor "empurrada" resolve Ponta Grossa e Estância, negócio CONS', () => {
    expect(resolverFilialSetor('Ponta Grossa', 'empurrada', UNIDADES)).toEqual({ unidade: 'PG', negocio: 'CONS' })
    expect(resolverFilialSetor('Estância', 'empurrada', UNIDADES)).toEqual({ unidade: 'ESTANCIA', negocio: 'CONS' })
  })

  it('setor "empurrada" não resolve unidade fora de Ponta Grossa/Estância — nunca cai pra resolverUnidade genérico', () => {
    expect(resolverFilialSetor('DIADEMA', 'empurrada', UNIDADES)).toBeNull()
  })
})

describe('filiaisDoSetorPagamento', () => {
  it('"empurrada" restringe as opções a Ponta Grossa e Estância', () => {
    const opcoes = filiaisDoSetorPagamento(UNIDADES, 'empurrada')
    expect(opcoes.map(o => o.unidade).sort()).toEqual(['ESTANCIA', 'PG'])
  })

  it('setor real devolve as mesmas combinações de unidadesParticipaveis', () => {
    const opcoes = filiaisDoSetorPagamento(UNIDADES, 'financeiro')
    expect(opcoes.map(o => o.unidade).sort()).toEqual(['CAMACARI', 'DIADEMA', 'ESTANCIA', 'PG'])
  })
})

describe('setorCompativel', () => {
  it('mesmo setor é sempre compatível', () => {
    expect(setorCompativel('distribuicao', 'distribuicao')).toBe(true)
    expect(setorCompativel('financeiro', 'financeiro')).toBe(true)
  })

  it('"empurrada" (cadastro) é alias de "distribuicao" (ranking)', () => {
    expect(setorCompativel('empurrada', 'distribuicao')).toBe(true)
  })

  it('"empurrada" não é compatível com nenhum outro setor', () => {
    expect(setorCompativel('empurrada', 'gente')).toBe(false)
    expect(setorCompativel('empurrada', 'armazem')).toBe(false)
  })

  it('setores diferentes (sem ser o alias empurrada) não são compatíveis', () => {
    expect(setorCompativel('gente', 'distribuicao')).toBe(false)
  })
})

describe('calcularPagamentos', () => {
  function lideranca(over: Partial<ReuniaoPagamentoLideranca>): ReuniaoPagamentoLideranca {
    return { unidade: 'DIADEMA', negocio: 'CONS', setor: 'financeiro', nome: 'Fulano', numero_extratta: '111', ...over }
  }
  function vencedor(over: Partial<VencedorSetorMes>): VencedorSetorMes {
    return { setor: 'financeiro', unidade: 'DIADEMA', negocio: 'CONS', nomeUnidade: 'Diadema', ...over }
  }

  it('1 liderança leva o prêmio inteiro', () => {
    const linhas = calcularPagamentos([vencedor({})], [lideranca({})], 200)
    expect(linhas).toEqual([{ nome: 'Fulano', numeroExtratta: '111', setor: 'financeiro', unidade: 'DIADEMA', negocio: 'CONS', nomeUnidade: 'Diadema', valor: 200 }])
  })

  it('2 lideranças dividem o prêmio em partes iguais', () => {
    const liderancas = [lideranca({ nome: 'A', numero_extratta: '1' }), lideranca({ nome: 'B', numero_extratta: '2' })]
    const linhas = calcularPagamentos([vencedor({})], liderancas, 200)
    expect(linhas.map(l => l.valor)).toEqual([100, 100])
  })

  it('3 lideranças dividem arredondando a centavos', () => {
    const liderancas = [lideranca({ nome: 'A' }), lideranca({ nome: 'B' }), lideranca({ nome: 'C' })]
    const linhas = calcularPagamentos([vencedor({})], liderancas, 200)
    expect(linhas.map(l => l.valor)).toEqual([66.67, 66.67, 66.67])
  })

  it('vencedor sem liderança cadastrada não gera linha nenhuma', () => {
    expect(calcularPagamentos([vencedor({})], [], 200)).toEqual([])
  })

  it('liderança de outro setor/unidade não entra na divisão', () => {
    const liderancas = [lideranca({ nome: 'A' }), lideranca({ nome: 'B', setor: 'gente' })]
    const linhas = calcularPagamentos([vencedor({})], liderancas, 200)
    expect(linhas).toHaveLength(1)
    expect(linhas[0].valor).toBe(200)
  })

  it('liderança cadastrada como "empurrada" recebe quando a unidade vence o ranking de "distribuicao", mostrando o rótulo "empurrada" no relatório', () => {
    const vencedorPG = vencedor({ setor: 'distribuicao', unidade: 'PG', nomeUnidade: 'Ponta Grossa' })
    const liderancaPG = lideranca({ unidade: 'PG', setor: 'empurrada', nome: 'Fulano' })
    const linhas = calcularPagamentos([vencedorPG], [liderancaPG], 200)
    expect(linhas).toEqual([{ nome: 'Fulano', numeroExtratta: '111', setor: 'empurrada', unidade: 'PG', negocio: 'CONS', nomeUnidade: 'Ponta Grossa', valor: 200 }])
  })

  it('ordena pela ordem padrão dos setores (financeiro, gente, frota, segurança, distribuição, armazém)', () => {
    const vencedores = [vencedor({ setor: 'armazem' }), vencedor({ setor: 'gente' }), vencedor({ setor: 'financeiro' })]
    const liderancas = [
      lideranca({ setor: 'armazem' }), lideranca({ setor: 'gente' }), lideranca({ setor: 'financeiro' }),
    ]
    const linhas = calcularPagamentos(vencedores, liderancas, 200)
    expect(linhas.map(l => l.setor)).toEqual(['financeiro', 'gente', 'armazem'])
  })
})

describe('vencedoresSemLideranca', () => {
  it('lista só os vencedores que não têm nenhuma liderança cadastrada', () => {
    const v1 = { setor: 'financeiro' as const, unidade: 'DIADEMA', negocio: 'CONS', nomeUnidade: 'Diadema' }
    const v2 = { setor: 'gente' as const, unidade: 'CAMACARI', negocio: 'ROTA', nomeUnidade: 'Camaçari · Rota' }
    const liderancas: ReuniaoPagamentoLideranca[] = [
      { unidade: 'DIADEMA', negocio: 'CONS', setor: 'financeiro', nome: 'Fulano', numero_extratta: '1' },
    ]
    expect(vencedoresSemLideranca([v1, v2], liderancas)).toEqual([v2])
  })
})
