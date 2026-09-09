-- Migration 110: cutover pra numeração nova do DRE (09/2026)
--
-- O GInfo inseriu a conta "GASTOS COM SALÁRIOS" logo após a antiga 034
-- ("GASTOS COM PESSOAL DIRETO"), deslocando +1 tudo que já era ≥ 035 — de
-- 282 pra 283 contas no total. Deslocamento uniforme, confirmado por
-- extração completa do catálogo novo (DRE_AMBEV_CONSOLIDADO_08_2026.xlsx)
-- comparada 1:1 com o catálogo antigo (sql/seed_contas.sql) — zero
-- divergência nos 001-034 (inalterados) e formula código_novo = código_antigo
-- + 1 confirmada em toda a faixa ≥ 035.
--
-- Duas partes:
--  1) Atualiza o catálogo `contas` (035-283) pra bater com a numeração nova
--     — sem isso a FK de dre_lancamentos.conta_codigo trava a reimportação
--     dos meses de 2026 (novo código 283 nem existe ainda) e descrições de
--     035 em diante ficam erradas (cada código ≥ 035 mudou de conta).
--     001-034 não entram aqui de propósito (idênticos, sem necessidade).
--  2) Renomeia o `codigo` (id do pacote) nas tabelas que usam esse id como
--     chave — rv_gente_pesos_dre / rv_financeiro_pesos_dre /
--     rv_frota_pesos_dre / rv_seguranca_pesos_dre (codigo = PRIMARY KEY) e
--     metas (codigo faz parte da UNIQUE) — senão pesos e metas já
--     cadastrados ficam "órfãos": o app passa a procurar pelo id novo
--     (já atualizado em src/lib/constants.ts) e não acha nada, peso/meta
--     some silenciosamente da tela. Ordem das renomeações é importante:
--     sempre da mais alta pra mais baixa dentro de cada cadeia adjacente
--     (ex: 159→160 antes de 158→159 antes de 157→158), pra nunca tentar
--     gravar um código que ainda está ocupado pela própria migração.
--
-- Rodar no SQL Editor do Supabase. Idempotente (upsert/renomeações são
-- no-op se já tiverem sido aplicadas).

-- ── 1) Catálogo `contas` — 035 (nova) a 283 (novo total) ──────────────────

INSERT INTO contas (codigo, descricao, ordem) VALUES
  ('035', 'GASTOS COM SALÁRIOS', 35),
  ('036', 'SALÁRIOS E ORDENADOS', 36),
  ('037', 'PENSÃO ALIMENTICIA', 37),
  ('038', 'ENCARGOS', 38),
  ('039', 'INSS E PROVISÕES', 39),
  ('040', 'FGTS E PROVISOES', 40),
  ('041', 'FERIAS E PROVISOES', 41),
  ('042', 'DECIMO TERCEIRO SALARIO  E PROVISOES', 42),
  ('043', 'PROCESSOS TRABALHISTAS', 43),
  ('044', 'AVISO PRÉVIO', 44),
  ('045', 'CONTRIBUIÇÃO SINDICAL', 45),
  ('046', 'RESCISOES DIVERSAS', 46),
  ('047', 'OUTRAS DESP. C/ PESSOAL', 47),
  ('048', 'CUSTOS PROC. TRABALHISTAS', 48),
  ('049', 'FGTS S/ RESCISÕES', 49),
  ('050', 'RESSALVA DE RESCISÕES', 50),
  ('051', 'GASTOS COM VALES', 51),
  ('052', 'VALES FINANCEIROS', 52),
  ('053', 'VALES FISICOS', 53),
  ('054', 'PROCESSO CÍVEL', 54),
  ('055', 'VALES SINISTRO', 55),
  ('056', 'GASTOS COM BENEFICIOS', 56),
  ('057', 'VALE REFEIÇÃO', 57),
  ('058', 'VALE TRANSPORTE', 58),
  ('059', 'PLANO DE SAÚDE', 59),
  ('060', 'CESTA BÁSICA', 60),
  ('061', 'CAFÉ DA MANHA', 61),
  ('062', 'SEGURO DE VIDA', 62),
  ('063', 'PLR – PARTICIPAÇÃO NOS RESULTADOS', 63),
  ('064', 'PLANO ODONTOLÓGICO', 64),
  ('065', 'TAXAS ADM VT/VA', 65),
  ('066', 'CESTA BASICA - CARTÃO', 66),
  ('067', 'INCENTIVOS', 67),
  ('068', 'OUTRAS DESPESAS - GERAIS - BLOQ', 68),
  ('069', 'GASTOS CONTRATAÇÃO/DEMISSÃO', 69),
  ('070', 'PCMSO/PPRA', 70),
  ('071', 'EXAMES MÉDICOS', 71),
  ('072', 'DESPESAS RECRUTAMENTO E SELEÇÃO', 72),
  ('073', 'CURSOS E TREINAMENTOS', 73),
  ('074', 'GASTOS COM UNIFORMES E EPI´S', 74),
  ('075', 'EPI´S', 75),
  ('076', 'UNIFORMES', 76),
  ('077', 'HIGIENIZAÇÃO UNIFORMES', 77),
  ('078', 'KIT HIGIENICO', 78),
  ('079', 'SINISTROS E PEQUENOS ACIDENTES', 79),
  ('080', 'GASTOS COM PESSOAL DE APOIO', 80),
  ('081', 'GASTOS COM SALÁRIOS E ENCARGOS', 81),
  ('082', 'SALÁRIOS', 82),
  ('083', 'ENCARGOS', 83),
  ('084', 'INSS E PROVISÕES', 84),
  ('085', 'FGTS E PROVISÕES', 85),
  ('086', 'FÉRIAS E PROVISÕES', 86),
  ('087', 'DECIMO TERCEIRO SALÁRIO E PROVISÕES', 87),
  ('088', 'PROCESSOS TRABALHISTAS', 88),
  ('089', 'AVISO PRÉVIO', 89),
  ('090', 'FGTS S/ RESCISÕES', 90),
  ('091', 'GASTOS COM VALES', 91),
  ('092', 'VALES FINANCEIROS', 92),
  ('093', 'VALES FISICOS', 93),
  ('094', 'GASTOS COM BENEFÍCIOS', 94),
  ('095', 'VALE REFEIÇÃO', 95),
  ('096', 'VALE TRANSPORTE', 96),
  ('097', 'PLANO DE SAÚDE', 97),
  ('098', 'CESTA BÁSICA', 98),
  ('099', 'CAFÉ DA MANHÃ', 99),
  ('100', 'SEGURO DE VIDA', 100),
  ('101', 'PLR – PARTICIPAÇÃO NOS RESULTADOS', 101),
  ('102', 'PLANO ODONTOLÓGICO', 102),
  ('103', 'AUXILIO EDUCAÇÃO', 103),
  ('104', 'GASTOS CONTRATAÇÃO/ DEMISSÃO', 104),
  ('105', 'PCMSO/PPRA', 105),
  ('106', 'EXAMES MÉDICOS', 106),
  ('107', 'DESPESAS RECRUTAMENTO E SELEÇÃO', 107),
  ('108', 'GASTOS COM UNIFORMES E EPI´S', 108),
  ('109', 'EPI´S', 109),
  ('110', 'UNIFORMES', 110),
  ('111', 'HIGIENIZAÇÃO DE UNIFORMES', 111),
  ('112', 'KIT HIGIENICO', 112),
  ('113', 'SINISTROS E PEQUENOS ACIDENTES', 113),
  ('114', 'CUSTOS GERAIS COM FROTA', 114),
  ('115', 'CUSTOS VARIÁVEIS FROTA', 115),
  ('116', 'GASTO COM COMBUSTÍVEIS', 116),
  ('117', 'ÓLEO DIESEL', 117),
  ('118', 'GASTOS COM MANUTENÇÕES', 118),
  ('119', 'MANUTENÇÃO DE VEICULOS PROPRIOS', 119),
  ('120', 'MANUTENÇÃO SCANIA', 120),
  ('121', 'MANUTENCAO DE CARROCERIA CARRETA', 121),
  ('122', 'LUBRIFICANTES', 122),
  ('123', 'ACESSÓRIOS', 123),
  ('124', 'REBOQUE / GUINCHO', 124),
  ('125', 'AVARIAS E SINISTROS', 125),
  ('126', 'TACOGRAFOS', 126),
  ('127', 'ADESIVAGEM FROTA', 127),
  ('128', 'DESPESAS DIVERSAS FROTA', 128),
  ('129', 'FORRAÇÃO DE CARRETAS', 129),
  ('130', 'AFERIÇÃO TACOGRAFO E FUMAÇA', 130),
  ('131', 'DESCONTO IFOLLOW', 131),
  ('132', 'GASTOS COM PNEUS', 132),
  ('133', 'PNEUS', 133),
  ('134', 'RECAPAGENS', 134),
  ('135', 'BORRACHARIA', 135),
  ('136', 'OUTROS GASTOS COM FROTA', 136),
  ('137', 'PEDÁGIOS', 137),
  ('138', 'MULTAS DE TRÂNSITO', 138),
  ('139', 'LAVAÇÃO', 139),
  ('140', 'CUSTO FIXOS', 140),
  ('141', 'IPVA/DPVAT E LICENCIAMENTOS', 141),
  ('142', 'SEGURO DE FROTA', 142),
  ('143', 'RASTREAMENTO', 143),
  ('144', 'OUTROS CUSTOS OPERACIONAIS', 144),
  ('145', 'MANUTENÇÃO DE CARRINHOS', 145),
  ('146', 'MANUTENÇÃO DE RASTREADORES', 146),
  ('147', 'FRETES E ENCOMENDAS', 147),
  ('148', 'DESPESAS COM VIAGEM', 148),
  ('149', 'SINDICATO PATRONAL', 149),
  ('150', 'TAXAS E IMPOSTOS DIVERSOS', 150),
  ('151', 'OUTRAS DESPESAS OPERACIONAIS', 151),
  ('152', 'ALUGUEL DE EQUIPAMENTOS', 152),
  ('153', 'MATERIAL DE EXPEDIENTE', 153),
  ('154', 'IRRF - RETIDO NA FONTE', 154),
  ('155', 'TAXA MENSAL - SEM PARAR', 155),
  ('156', 'LUCRO OPERACIONAL VARIÁVEL', 156),
  ('157', '( = ) LUCRO OPERACIONAL', 157),
  ('158', '( - ) DESPESAS ADMINISTRATIVAS E FINANCEIRAS', 158),
  ('159', 'DESPESAS COM PESSOAL ADMINISTRATIVO', 159),
  ('160', 'SALÁRIOS E PRÓ-LABORE', 160),
  ('161', 'SALÁRIOS', 161),
  ('162', 'PRÓ-LABORE', 162),
  ('163', 'ENCARGOS', 163),
  ('164', 'INSS E PROVISÕES', 164),
  ('165', 'FGTS E PROVISÕES', 165),
  ('166', 'FÉRIAS E PROVISÕES', 166),
  ('167', 'DÉCIMO TERCEIRO SALÁRIO E PROVISÕES', 167),
  ('168', 'PROCESSOS TRABALHISTAS', 168),
  ('169', 'AVISO PRÉVIO', 169),
  ('170', 'CONTRIBUIÇÃO SINDICAL PATRONAL', 170),
  ('171', 'FGTS S/ RESCISÕES', 171),
  ('172', 'GASTOS COM BENEFÍCIOS', 172),
  ('173', 'VALE REFEIÇÃO', 173),
  ('174', 'VALE TRANSPORTE', 174),
  ('175', 'PLANO DE SAÚDE', 175),
  ('176', 'CESTA BÁSICA', 176),
  ('177', 'AUXILIO EDUCAÇÃO', 177),
  ('178', 'SEGURO DE VIDA', 178),
  ('179', 'ASSISTÊNCIA MÉDICA E SOCIAL', 179),
  ('180', 'PLANO ODONTOLÓGICO', 180),
  ('181', 'CURSOS E TREINAMENTOS', 181),
  ('182', 'PREVIDÊNCIA PRIVADA', 182),
  ('183', 'PLR – PARTICIPAÇÃO NOS RESULTADOS', 183),
  ('184', 'GASTOS CONTRATAÇÃO/DEMISSÃO', 184),
  ('185', 'PCMSO/PPRA', 185),
  ('186', 'EXAMES MÉDICOS', 186),
  ('187', 'DESPESAS RECRUTAMENTO E SELEÇÃO', 187),
  ('188', 'GASTOS COM UNIFORMES E EPI´S', 188),
  ('189', 'EPI´S', 189),
  ('190', 'UNIFORMES', 190),
  ('191', 'DESPESAS ADMINISTRATIVAS GERAIS', 191),
  ('192', 'HONORÁRIOS PROFISSIONAIS', 192),
  ('193', 'DESPESA DE VIAGENS E HOSPEDAGENS', 193),
  ('194', 'SISTEMAS DE INFORMÁTICA', 194),
  ('195', 'ALUGUÉIS E CONDOMÍNIOS', 195),
  ('196', 'ENERGIA ELÉTRICA', 196),
  ('197', 'ÁGUA E ESGOTO', 197),
  ('198', 'TELEFONE', 198),
  ('199', 'INTERNET', 199),
  ('200', 'BENS DE PEQUENO VALOR', 200),
  ('201', 'MATERIAIS DE EXPEDIENTE', 201),
  ('202', 'MATERIAL DE LIMPEZA', 202),
  ('203', 'CORREIOS', 203),
  ('204', 'CARTÓRIO', 204),
  ('205', 'OUTRAS DESPESAS ADMINISTRATIVAS', 205),
  ('206', 'MANUTENÇÃO E REPAROS ADMINISTRATIVOS', 206),
  ('207', 'IMPRESSOS GRÁFICOS', 207),
  ('208', 'DESPESA C/TAXAS E IMPOSTOS', 208),
  ('209', 'CONFRATERNIZAÇÃO E EVENTOS', 209),
  ('210', 'DESPESAS LEGAIS E JUDICIAIS', 210),
  ('211', 'SEGURANÇA E VIGILÂNCIA', 211),
  ('212', 'LANCHES, REFEIÇÕES', 212),
  ('213', 'DESPESAS COM IMPLANTAÇÃO', 213),
  ('214', 'BRINDES DIVERSOS', 214),
  ('215', 'DESPESA C/MERCADO', 215),
  ('216', 'ROYALTIES', 216),
  ('217', 'HONORÁRIOS COM CONSULTORIA DE OPERAÇÕES', 217),
  ('218', 'DESPESAS GERAIS FROTA LEVE', 218),
  ('219', 'MANUTENÇÃO FROTA LEVE', 219),
  ('220', 'COMBUSTÍVEL FROTA LEVE', 220),
  ('221', 'PNEUS FROTA LEVE', 221),
  ('222', 'ALUGUEL FROTA LEVE', 222),
  ('223', 'MULTAS FROTA LEVE', 223),
  ('224', 'IPVA FROTA LEVE', 224),
  ('225', 'SEGURO FROTA LEVE', 225),
  ('226', 'PEDAGIO FROTA LEVE', 226),
  ('227', 'LAVAÇÃO FROTA LEVE', 227),
  ('228', 'OUTRAS DESPESAS FROTA LEVE', 228),
  ('229', '( - ) ALOCAÇÕES MATRIZ', 229),
  ('230', '( - ) ALOCAÇÕES CORPORATIVO', 230),
  ('231', '( - ) ALOCAÇÕES COMERCIAL', 231),
  ('232', '( - ) ALOCAÇÕES BRASIL', 232),
  ('233', '( = ) EBITDA', 233),
  ('234', '( - ) CUSTO COM DEPRECIAÇÃO E TRIBUTÁRIOS', 234),
  ('235', 'DEPRECIAÇÃO VEÍCULOS', 235),
  ('236', 'DEPRECIAÇÃO MAQUINAS E EQUIPAMENTOS', 236),
  ('237', 'DEPRECIAÇÃO MOVEIS E UTENSÍLIOS', 237),
  ('238', 'ESTORNO ICMS', 238),
  ('239', 'ESTORNO DE ICMS IMOBILIZADO', 239),
  ('240', '( = ) EBIT', 240),
  ('241', '(  /- ) RECEITAS/DESPESAS FINANCEIRAS', 241),
  ('242', '( - ) DESPESAS FINANCEIRAS', 242),
  ('243', 'DESPESAS COM FINAMES', 243),
  ('244', 'JUROS DE FINAMES', 244),
  ('245', 'JUROS CDC  EMPILHADEIRAS', 245),
  ('246', 'DESPESAS FINANCEIRAS DIVERSAS', 246),
  ('247', 'JUROS COM  MÚTUOS E EMPRÉSTIMOS', 247),
  ('248', 'JUROS ADIANTAMENTO DE CLIENTE', 248),
  ('249', 'JUROS COM MUTUOS DE ACIONISTAS', 249),
  ('250', 'JUROS DE LIMITE BANCÁRIO', 250),
  ('251', 'DESPESAS BANCÁRIAS', 251),
  ('252', 'IOF S/ OPERAÇÕES FINANCEIRAS', 252),
  ('253', 'IOF S/ SEGUROS', 253),
  ('254', 'JUROS DE FORNECEDORES', 254),
  ('255', 'TAXA DE CONSÓRCIO', 255),
  ('256', 'REC. DE CRED. BAIXADOS COMO PERDA', 256),
  ('257', 'JUROS S/EMPRÉSTIMOS BANCÁRIOS', 257),
  ('258', 'JUROS CORREÇÃO SELIC', 258),
  ('259', 'OUTRAS DESPESAS', 259),
  ('260', 'MULTA E JUROS S/ IMPOSTOS', 260),
  ('261', 'DESPESA NÃO -DEDUTIVEL DE IR', 261),
  ('262', 'MULTA MINISTÉRIO DO TRABALHO', 262),
  ('263', '(   ) RECEITAS FINANCEIRAS', 263),
  ('264', 'RECEITAS FINANCEIRAS', 264),
  ('265', 'JUROS RECEBIDOS', 265),
  ('266', 'DESCONTOS OBTIDOS', 266),
  ('267', 'JUROS S/APLICAÇÕES FINANCEIRAS', 267),
  ('268', 'CORREÇÃO SELIC', 268),
  ('269', 'DEDUÇÕES SOBRE RECEITA FINANCEIRA', 269),
  ('270', '( - ) PIS SOBRE RECEITA FINANCEIRA', 270),
  ('271', '( - ) COFINS SOBRE RECEITA FINANCEIRA', 271),
  ('272', '( - ) ALOCAÇÕES FINANCEIRAS', 272),
  ('273', '( = ) RESULTADO DO EXERCÍCIO - LUCRO CONTÁBIL', 273),
  ('275', '( - ) PARCELA FINAME', 274),
  ('276', '( = ) LUCRO LIQUIDO DO EXERCÍCIO - GERAÇÃO DE CAIXA', 275),
  ('278', 'DEMONSTRATIVO FRETEIROS', 276),
  ('279', '( + ) RECEITA DE TRANSPORTES DE FRETEIROS', 277),
  ('280', '( - ) TRIBUTOS SOBRE TRANSPORTE DE FRETEIROS', 278),
  ('281', '( = ) RECEITA LIQUIDA DE FRETEIROS', 279),
  ('282', '( - ) REPASSE  PAGO A FRETEIROS', 280),
  ('283', '( = ) LUCRO COM FRETEIROS', 281)
ON CONFLICT (codigo) DO UPDATE SET
  descricao = EXCLUDED.descricao,
  ordem     = EXCLUDED.ordem;

-- ── 2) Renomeia o id do pacote (codigo) nas tabelas de peso/meta ──────────
-- Ordem descendente dentro de cada cadeia adjacente pra nunca colidir.

-- rv_gente_pesos_dre (Pacote de Gente)
UPDATE rv_gente_pesos_dre SET codigo = '159' WHERE codigo = '158';

-- rv_financeiro_pesos_dre (Despesa Administrativa)
UPDATE rv_financeiro_pesos_dre SET codigo = '158' WHERE codigo = '157';

-- rv_frota_pesos_dre (Custos Gerais, Manutenção, Pneus, Diesel — disjuntos entre si)
UPDATE rv_frota_pesos_dre SET codigo = '114' WHERE codigo = '113';
UPDATE rv_frota_pesos_dre SET codigo = '118' WHERE codigo = '117';
UPDATE rv_frota_pesos_dre SET codigo = '132' WHERE codigo = '131';
UPDATE rv_frota_pesos_dre SET codigo = '116' WHERE codigo = '115';

-- rv_seguranca_pesos_dre (EPI's -> Uniformes, cadeia adjacente)
UPDATE rv_seguranca_pesos_dre SET codigo = '076' WHERE codigo = '075';
UPDATE rv_seguranca_pesos_dre SET codigo = '075' WHERE codigo = '074';

-- metas (todos os pacotes do Farol de Metas — cadeias 157→158→159→160,
-- 217→218→219 e 073→074→075→076 em ordem descendente; o resto é disjunto)
UPDATE metas SET codigo = '276' WHERE codigo = '275';
UPDATE metas SET codigo = '233' WHERE codigo = '232';
UPDATE metas SET codigo = '219' WHERE codigo = '218';
UPDATE metas SET codigo = '218' WHERE codigo = '217';
UPDATE metas SET codigo = '160' WHERE codigo = '159';
UPDATE metas SET codigo = '159' WHERE codigo = '158';
UPDATE metas SET codigo = '158' WHERE codigo = '157';
UPDATE metas SET codigo = '191' WHERE codigo = '190';
UPDATE metas SET codigo = '114' WHERE codigo = '113';
UPDATE metas SET codigo = '118' WHERE codigo = '117';
UPDATE metas SET codigo = '132' WHERE codigo = '131';
UPDATE metas SET codigo = '116' WHERE codigo = '115';
UPDATE metas SET codigo = '076' WHERE codigo = '075';
UPDATE metas SET codigo = '075' WHERE codigo = '074';
UPDATE metas SET codigo = '074' WHERE codigo = '073';

NOTIFY pgrst, 'reload schema';
