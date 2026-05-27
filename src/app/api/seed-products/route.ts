import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const PRODUCTS = [
  // ── PASTÉIS FRITOS (preço por cento ÷ 100) ────────────────────
  { name: 'Pastel de Carne',                                    category: 'Pastéis Fritos',           description: 'Carne',     unit: 'unidade', unit_price: 2.06, is_multiple_of_25: true },
  { name: 'Pastel de Frango',                                   category: 'Pastéis Fritos',           description: 'Frango',    unit: 'unidade', unit_price: 2.06, is_multiple_of_25: true },
  { name: 'Pastel Frango c/ Catupiry',                          category: 'Pastéis Fritos',           description: 'Frango',    unit: 'unidade', unit_price: 2.06, is_multiple_of_25: true },
  { name: 'Pastel de Palmito',                                  category: 'Pastéis Fritos',           description: 'Sem Carne', unit: 'unidade', unit_price: 2.06, is_multiple_of_25: true },
  { name: 'Pastel Queijo',                                      category: 'Pastéis Fritos',           description: 'Sem Carne', unit: 'unidade', unit_price: 2.06, is_multiple_of_25: true },
  { name: 'Pastel Napolitano',                                  category: 'Pastéis Fritos',           description: 'Sem Carne', unit: 'unidade', unit_price: 2.06, is_multiple_of_25: true },
  { name: 'Pastel Vegano (Palmito, Tomate e Manjericão)',       category: 'Pastéis Fritos',           description: 'Sem Carne', unit: 'unidade', unit_price: 2.06, is_multiple_of_25: true },
  { name: 'Pastel Camarão',                                     category: 'Pastéis Fritos',           description: 'Peixe',     unit: 'unidade', unit_price: 2.54, is_multiple_of_25: true },

  // ── PASTÉIS DOCES (preço por cento ÷ 100) ─────────────────────
  { name: 'Pastel de Banana',                                   category: 'Pastéis Doces',            description: 'Doce',      unit: 'unidade', unit_price: 1.80, is_multiple_of_25: true },
  { name: 'Pastel Goiabada c/ Catupiry',                        category: 'Pastéis Doces',            description: 'Doce',      unit: 'unidade', unit_price: 1.80, is_multiple_of_25: true },
  { name: 'Pastel de Chocolate',                                category: 'Pastéis Doces',            description: 'Doce',      unit: 'unidade', unit_price: 1.80, is_multiple_of_25: true },
  { name: 'Pastel Doce de Leite com Queijo',                    category: 'Pastéis Doces',            description: 'Doce',      unit: 'unidade', unit_price: 2.06, is_multiple_of_25: true },

  // ── PASTÉIS CROCANTES (preço por cento ÷ 100) ─────────────────
  { name: 'Pastel Crocante Carne com Azeitona',                 category: 'Pastéis Crocantes',        description: 'Carne',     unit: 'unidade', unit_price: 2.50, is_multiple_of_25: true },
  { name: 'Pastel Crocante Espinafre com Provolone',            category: 'Pastéis Crocantes',        description: 'Sem Carne', unit: 'unidade', unit_price: 2.50, is_multiple_of_25: true },
  { name: 'Pastel Crocante de Queijo',                          category: 'Pastéis Crocantes',        description: 'Sem Carne', unit: 'unidade', unit_price: 2.50, is_multiple_of_25: true },
  { name: 'Pastel Crocante Camarão c/ Catupiry',                category: 'Pastéis Crocantes',        description: 'Peixe',     unit: 'unidade', unit_price: 2.70, is_multiple_of_25: true },

  // ── SANDUÍCHES (preço por cento ÷ 100) ────────────────────────
  { name: 'Sanduíche de Frango (Árabe / Ciabata)',              category: 'Sanduíches',               description: 'Frango',    unit: 'unidade', unit_price: 1.94, is_multiple_of_25: true },
  { name: 'Sanduíche Tomate Seco, Mussarela de Búfala e Rúcula',category: 'Sanduíches',               description: 'Sem Carne', unit: 'unidade', unit_price: 3.28, is_multiple_of_25: true },
  { name: 'Sanduíche Presunto e Mussarela (Fatia)',             category: 'Sanduíches',               description: 'Sem Carne', unit: 'unidade', unit_price: 1.94, is_multiple_of_25: true },
  { name: 'Sanduíche Pasta Presunto',                           category: 'Sanduíches',               description: 'Sem Carne', unit: 'unidade', unit_price: 1.94, is_multiple_of_25: true },
  { name: 'Sanduíche Pasta de Atum',                            category: 'Sanduíches',               description: 'Peixe',     unit: 'unidade', unit_price: 1.94, is_multiple_of_25: true },
  { name: 'Sanduíche Pasta de Queijo',                          category: 'Sanduíches',               description: 'Sem Carne', unit: 'unidade', unit_price: 1.94, is_multiple_of_25: true },
  { name: 'Pão de Batata — Peito de Peru, Molho Tártaro e Provolone', category: 'Sanduíches',         description: 'Sem Carne', unit: 'unidade', unit_price: 2.86, is_multiple_of_25: true },
  { name: 'Pão de Batata — Peito de Peru, Molho Tártaro e Abacaxi',   category: 'Sanduíches',         description: 'Sem Carne', unit: 'unidade', unit_price: 2.86, is_multiple_of_25: true },
  { name: 'Pão de Batata — Frango, Cenoura, Azeitona e Maionese',     category: 'Sanduíches',         description: 'Frango',    unit: 'unidade', unit_price: 1.94, is_multiple_of_25: true },
  { name: 'Pão de Batata — Pasta Presunto',                    category: 'Sanduíches',               description: 'Sem Carne', unit: 'unidade', unit_price: 1.94, is_multiple_of_25: true },
  { name: 'Pão de Batata — Pasta Atum',                        category: 'Sanduíches',               description: 'Peixe',     unit: 'unidade', unit_price: 1.94, is_multiple_of_25: true },
  { name: 'Pão de Batata — Pasta Queijo',                      category: 'Sanduíches',               description: 'Sem Carne', unit: 'unidade', unit_price: 1.94, is_multiple_of_25: true },

  // ── FOLHADOS (preço por cento ÷ 100) ──────────────────────────
  { name: 'Folhado Abacaxi com Bacon',                          category: 'Folhados',                 description: 'Carne',     unit: 'unidade', unit_price: 1.96, is_multiple_of_25: true },
  { name: 'Folhado Queijo com Damasco',                         category: 'Folhados',                 description: 'Sem Carne', unit: 'unidade', unit_price: 2.36, is_multiple_of_25: true },

  // ── SALGADOS (preço por cento ÷ 100) ──────────────────────────
  { name: 'Barquete com Salpicão',                              category: 'Salgados',                 description: 'Frango',    unit: 'unidade', unit_price: 1.74, is_multiple_of_25: true },
  { name: 'Bolinho de Mandioca Carne de Sol com Catupiry',      category: 'Salgados',                 description: 'Carne',     unit: 'unidade', unit_price: 1.82, is_multiple_of_25: true },
  { name: 'Bombom de Camarão',                                  category: 'Salgados',                 description: 'Peixe',     unit: 'unidade', unit_price: 2.90, is_multiple_of_25: true },
  { name: 'Bolinha de Queijo',                                  category: 'Salgados',                 description: 'Sem Carne', unit: 'unidade', unit_price: 1.92, is_multiple_of_25: true },
  { name: 'Cigarrete Assado',                                   category: 'Salgados',                 description: 'Carne',     unit: 'unidade', unit_price: 1.74, is_multiple_of_25: true },
  { name: 'Coxinha c/ Catupiry',                                category: 'Salgados',                 description: 'Frango',    unit: 'unidade', unit_price: 1.58, is_multiple_of_25: true },
  { name: 'Coxinha Simples',                                    category: 'Salgados',                 description: 'Frango',    unit: 'unidade', unit_price: 1.20, is_multiple_of_25: true },
  { name: 'Croissant Recheado Presunto e Mussarela',            category: 'Salgados',                 description: 'Sem Carne', unit: 'unidade', unit_price: 2.90, is_multiple_of_25: true },
  { name: 'Delícia de Presunto e Mussarela',                    category: 'Salgados',                 description: 'Sem Carne', unit: 'unidade', unit_price: 1.56, is_multiple_of_25: true },
  { name: 'Espeto Caprese',                                     category: 'Salgados',                 description: 'Sem Carne', unit: 'unidade', unit_price: 1.94, is_multiple_of_25: true },
  { name: 'Empada Camarão',                                     category: 'Salgados',                 description: 'Peixe',     unit: 'unidade', unit_price: 2.96, is_multiple_of_25: true },
  { name: 'Empada Frango',                                      category: 'Salgados',                 description: 'Frango',    unit: 'unidade', unit_price: 1.20, is_multiple_of_25: true },
  { name: 'Empada Frango c/ Azeitona',                          category: 'Salgados',                 description: 'Frango',    unit: 'unidade', unit_price: 1.26, is_multiple_of_25: true },
  { name: 'Empada Frango c/ Catupiry',                          category: 'Salgados',                 description: 'Frango',    unit: 'unidade', unit_price: 1.38, is_multiple_of_25: true },
  { name: 'Empada Palmito',                                     category: 'Salgados',                 description: 'Sem Carne', unit: 'unidade', unit_price: 1.52, is_multiple_of_25: true },
  { name: 'Empada de Queijo',                                   category: 'Salgados',                 description: 'Sem Carne', unit: 'unidade', unit_price: 1.78, is_multiple_of_25: true },
  { name: 'Enrolado Salsicha',                                  category: 'Salgados',                 description: 'Carne',     unit: 'unidade', unit_price: 1.20, is_multiple_of_25: true },
  { name: 'Esfirra Carne',                                      category: 'Salgados',                 description: 'Carne',     unit: 'unidade', unit_price: 1.48, is_multiple_of_25: true },
  { name: 'Medalhão de Frango c/ Fio de Ovos ou Molho Oriental',category: 'Salgados',                 description: 'Frango',    unit: 'unidade', unit_price: 1.58, is_multiple_of_25: true },
  { name: 'Mini Hamburguer (Carne, Mussarela, Maionese)',       category: 'Salgados',                 description: 'Carne',     unit: 'unidade', unit_price: 3.28, is_multiple_of_25: true },
  { name: 'Pão de Queijo',                                      category: 'Salgados',                 description: 'Sem Carne', unit: 'unidade', unit_price: 1.42, is_multiple_of_25: true },
  { name: 'Pão de Queijo Recheado de Pernil',                   category: 'Salgados',                 description: 'Carne',     unit: 'unidade', unit_price: 2.58, is_multiple_of_25: true },
  { name: 'Pão de Queijo Recheado Tomate Seco, Mussarela de Búfala e Rúcula', category: 'Salgados',  description: 'Sem Carne', unit: 'unidade', unit_price: 3.14, is_multiple_of_25: true },
  { name: 'Pastel Assado de Frango',                            category: 'Salgados',                 description: 'Frango',    unit: 'unidade', unit_price: 1.06, is_multiple_of_25: true },
  { name: 'Pastel Assado de Palmito',                           category: 'Salgados',                 description: 'Sem Carne', unit: 'unidade', unit_price: 1.18, is_multiple_of_25: true },
  { name: 'Pastel Português de Milho',                          category: 'Salgados',                 description: 'Sem Carne', unit: 'unidade', unit_price: 1.26, is_multiple_of_25: true },
  { name: 'Quibe',                                              category: 'Salgados',                 description: 'Carne',     unit: 'unidade', unit_price: 1.46, is_multiple_of_25: true },
  { name: 'Quibe c/ Catupiry',                                  category: 'Salgados',                 description: 'Carne',     unit: 'unidade', unit_price: 1.82, is_multiple_of_25: true },
  { name: 'Quiche Alho Poró',                                   category: 'Salgados',                 description: 'Sem Carne', unit: 'unidade', unit_price: 2.18, is_multiple_of_25: true },

  // ── TORTAS SALGADAS ────────────────────────────────────────────
  { name: 'Torta de Palmito c/ Catupiry (8 pessoas)',           category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 152.00, is_multiple_of_25: false },
  { name: 'Torta de Palmito c/ Catupiry (12 pessoas)',          category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 226.00, is_multiple_of_25: false },
  { name: 'Torta de Palmito c/ Catupiry (18 pessoas)',          category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 272.00, is_multiple_of_25: false },
  { name: 'Torta de Camarão (8 pessoas)',                       category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 218.00, is_multiple_of_25: false },
  { name: 'Torta de Camarão (12 pessoas)',                      category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 280.00, is_multiple_of_25: false },
  { name: 'Torta de Camarão (18 pessoas)',                      category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 340.00, is_multiple_of_25: false },
  { name: 'Torta de Camarão c/ Catupiry (8 pessoas)',           category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 218.00, is_multiple_of_25: false },
  { name: 'Torta de Camarão c/ Catupiry (12 pessoas)',          category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 280.00, is_multiple_of_25: false },
  { name: 'Torta de Camarão c/ Catupiry (18 pessoas)',          category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 340.00, is_multiple_of_25: false },
  { name: 'Torta de Frango (8 pessoas)',                        category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 96.00,  is_multiple_of_25: false },
  { name: 'Torta de Frango (12 pessoas)',                       category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 140.00, is_multiple_of_25: false },
  { name: 'Torta de Frango (18 pessoas)',                       category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 192.00, is_multiple_of_25: false },
  { name: 'Torta de Frango c/ Catupiry (8 pessoas)',            category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 106.00, is_multiple_of_25: false },
  { name: 'Torta de Frango c/ Catupiry (12 pessoas)',           category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 174.00, is_multiple_of_25: false },
  { name: 'Torta de Frango c/ Catupiry (18 pessoas)',           category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 234.00, is_multiple_of_25: false },
  { name: 'Torta de Palmito (8 pessoas)',                       category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 126.00, is_multiple_of_25: false },
  { name: 'Torta de Palmito (12 pessoas)',                      category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 194.00, is_multiple_of_25: false },
  { name: 'Torta de Palmito (18 pessoas)',                      category: 'Tortas Salgadas',          description: '',          unit: 'torta',   unit_price: 250.00, is_multiple_of_25: false },

  // ── TORTAS SALGADAS CONGELADAS ─────────────────────────────────
  { name: 'Torta Frango 500g',                                  category: 'Tortas Salgadas Congeladas', description: '',        unit: 'torta',   unit_price: 24.00,  is_multiple_of_25: false },
  { name: 'Torta Frango 1,5kg',                                 category: 'Tortas Salgadas Congeladas', description: '',        unit: 'torta',   unit_price: 60.00,  is_multiple_of_25: false },
  { name: 'Torta Frango com Catupiry 500g',                     category: 'Tortas Salgadas Congeladas', description: '',        unit: 'torta',   unit_price: 26.00,  is_multiple_of_25: false },
  { name: 'Torta Frango com Catupiry 1,5kg',                    category: 'Tortas Salgadas Congeladas', description: '',        unit: 'torta',   unit_price: 76.00,  is_multiple_of_25: false },
  { name: 'Torta Palmito 500g',                                 category: 'Tortas Salgadas Congeladas', description: '',        unit: 'torta',   unit_price: 32.00,  is_multiple_of_25: false },
  { name: 'Torta Camarão com Catupiry 500g',                    category: 'Tortas Salgadas Congeladas', description: '',        unit: 'torta',   unit_price: 65.90,  is_multiple_of_25: false },

  // ── TORTAS DOCES ───────────────────────────────────────────────
  { name: 'Torta Brigadeiro / Chocolate c/ Marshmallow (10 pessoas)',  category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 84.00,  is_multiple_of_25: false },
  { name: 'Torta Brigadeiro / Chocolate c/ Marshmallow (25 pessoas)',  category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 140.00, is_multiple_of_25: false },
  { name: 'Torta Brigadeiro / Chocolate c/ Marshmallow (40 pessoas)',  category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 210.00, is_multiple_of_25: false },
  { name: 'Torta Brigadeiro / Chocolate c/ Marshmallow (60 pessoas)',  category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 280.00, is_multiple_of_25: false },
  { name: 'Torta Brigadeiro / Chocolate c/ Marshmallow (80 pessoas)',  category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 358.00, is_multiple_of_25: false },
  { name: 'Torta de Nozes / Morango / Prestígio / Floresta Negra / Limão Siciliano (10 pessoas)', category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 132.00, is_multiple_of_25: false },
  { name: 'Torta de Nozes / Morango / Prestígio / Floresta Negra / Limão Siciliano (25 pessoas)', category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 210.00, is_multiple_of_25: false },
  { name: 'Torta de Nozes / Morango / Prestígio / Floresta Negra / Limão Siciliano (40 pessoas)', category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 280.00, is_multiple_of_25: false },
  { name: 'Torta de Nozes / Morango / Prestígio / Floresta Negra / Limão Siciliano (60 pessoas)', category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 360.00, is_multiple_of_25: false },
  { name: 'Torta de Nozes / Morango / Prestígio / Floresta Negra / Limão Siciliano (80 pessoas)', category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 514.00, is_multiple_of_25: false },
  { name: 'Torta de Abacaxi com Coco (10 pessoas)',             category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 99.00,  is_multiple_of_25: false },
  { name: 'Torta de Abacaxi com Coco (25 pessoas)',             category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 176.00, is_multiple_of_25: false },
  { name: 'Torta de Abacaxi com Coco (40 pessoas)',             category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 220.00, is_multiple_of_25: false },
  { name: 'Torta de Abacaxi com Coco (60 pessoas)',             category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 288.00, is_multiple_of_25: false },
  { name: 'Torta de Abacaxi com Coco (80 pessoas)',             category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 396.00, is_multiple_of_25: false },
  { name: 'Torta Leite Ninho c/ Nutela (10 pessoas)',           category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 172.00, is_multiple_of_25: false },
  { name: 'Torta Leite Ninho c/ Nutela (25 pessoas)',           category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 266.00, is_multiple_of_25: false },
  { name: 'Torta Leite Ninho c/ Nutela (40 pessoas)',           category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 358.00, is_multiple_of_25: false },
  { name: 'Torta Leite Ninho c/ Nutela (60 pessoas)',           category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 442.00, is_multiple_of_25: false },
  { name: 'Torta Leite Ninho c/ Nutela (80 pessoas)',           category: 'Tortas Doces', description: '', unit: 'torta', unit_price: 690.00, is_multiple_of_25: false },

  // ── DOCES (preço por cento ÷ 100) ─────────────────────────────
  { name: 'Amor em Pedaço',                                     category: 'Doces', description: '', unit: 'unidade', unit_price: 1.76, is_multiple_of_25: true },
  { name: 'Brigadeiro',                                         category: 'Doces', description: '', unit: 'unidade', unit_price: 1.42, is_multiple_of_25: true },
  { name: 'Brigadeiro Crocante (Branco ou Preto)',              category: 'Doces', description: '', unit: 'unidade', unit_price: 1.58, is_multiple_of_25: true },
  { name: 'Brigadeiro de Paçoca',                               category: 'Doces', description: '', unit: 'unidade', unit_price: 1.58, is_multiple_of_25: true },
  { name: 'Cajuzinho',                                          category: 'Doces', description: '', unit: 'unidade', unit_price: 1.42, is_multiple_of_25: true },
  { name: 'Canudinho de Doce de Leite',                         category: 'Doces', description: '', unit: 'unidade', unit_price: 1.42, is_multiple_of_25: true },
  { name: 'Chapéu Napoleão',                                    category: 'Doces', description: '', unit: 'unidade', unit_price: 1.66, is_multiple_of_25: true },
  { name: 'Cocada',                                             category: 'Doces', description: '', unit: 'unidade', unit_price: 1.76, is_multiple_of_25: true },
  { name: 'Coxinha de Leite Ninho com Morango',                 category: 'Doces', description: '', unit: 'unidade', unit_price: 3.40, is_multiple_of_25: true },
  { name: 'Doce de Coco',                                       category: 'Doces', description: '', unit: 'unidade', unit_price: 1.66, is_multiple_of_25: true },
  { name: 'Ele e Ela',                                          category: 'Doces', description: '', unit: 'unidade', unit_price: 1.48, is_multiple_of_25: true },
  { name: 'Leite Ninho com Nutela',                             category: 'Doces', description: '', unit: 'unidade', unit_price: 2.92, is_multiple_of_25: true },
  { name: 'Mini Churros com Doce de Leite',                     category: 'Doces', description: '', unit: 'unidade', unit_price: 1.38, is_multiple_of_25: true },
  { name: 'Moranguinho',                                        category: 'Doces', description: '', unit: 'unidade', unit_price: 1.66, is_multiple_of_25: true },
  { name: 'Olho de Sogra',                                      category: 'Doces', description: '', unit: 'unidade', unit_price: 1.84, is_multiple_of_25: true },
  { name: 'Palha Italiana',                                     category: 'Doces', description: '', unit: 'unidade', unit_price: 1.42, is_multiple_of_25: true },
  { name: 'Petit Four',                                         category: 'Doces', description: '', unit: 'unidade', unit_price: 1.00, is_multiple_of_25: true },
  { name: 'Pé de Moleque com Leite Condensado',                 category: 'Doces', description: '', unit: 'unidade', unit_price: 1.68, is_multiple_of_25: true },
  { name: 'Prestígio',                                          category: 'Doces', description: '', unit: 'unidade', unit_price: 1.70, is_multiple_of_25: true },
  { name: 'Rolinho de Damasco',                                 category: 'Doces', description: '', unit: 'unidade', unit_price: 1.94, is_multiple_of_25: true },
  { name: 'Romeu e Julieta',                                    category: 'Doces', description: '', unit: 'unidade', unit_price: 1.84, is_multiple_of_25: true },

  // ── BOMBONS E TRUFAS (preço por cento ÷ 100) ──────────────────
  { name: 'Bombom de Coco',                                     category: 'Bombons e Trufas', description: '', unit: 'unidade', unit_price: 2.00, is_multiple_of_25: true },
  { name: 'Bombom de Brigadeiro',                               category: 'Bombons e Trufas', description: '', unit: 'unidade', unit_price: 2.00, is_multiple_of_25: true },
  { name: 'Bombom de Morango',                                  category: 'Bombons e Trufas', description: '', unit: 'unidade', unit_price: 3.74, is_multiple_of_25: true },
  { name: 'Bombom de Nozes',                                    category: 'Bombons e Trufas', description: '', unit: 'unidade', unit_price: 2.58, is_multiple_of_25: true },
  { name: 'Bombom de Uva',                                      category: 'Bombons e Trufas', description: '', unit: 'unidade', unit_price: 2.16, is_multiple_of_25: true },
  { name: 'Trufa de Chocolate',                                 category: 'Bombons e Trufas', description: '', unit: 'unidade', unit_price: 2.80, is_multiple_of_25: true },

  // ── ESPETOS DE FRUTA ───────────────────────────────────────────
  { name: 'Espeto Fruta 4 sabores',                             category: 'Espetos de Fruta', description: '1 por pessoa', unit: 'unidade', unit_price: 4.50, is_multiple_of_25: false },
  { name: 'Mini Espeto Fruta 3 sabores',                        category: 'Espetos de Fruta', description: '1 por pessoa', unit: 'unidade', unit_price: 3.50, is_multiple_of_25: false },

  // ── BOLOS ──────────────────────────────────────────────────────
  { name: 'Bolo com Cobertura 650g (Laranja, Coco, Cenoura, Broa)',   category: 'Bolos', description: 'Até 25 pessoas', unit: 'bolo', unit_price: 30.00, is_multiple_of_25: false },
  { name: 'Bolo com Cobertura 1,3kg (Laranja, Coco, Cenoura, Broa)', category: 'Bolos', description: 'Até 50 pessoas', unit: 'bolo', unit_price: 55.00, is_multiple_of_25: false },

  // ── DELIVERY — PASTÉIS GRANDES ─────────────────────────────────
  { name: 'Pastel Grande de Banana',                            category: 'Delivery - Pastéis Grandes', description: 'Doce',     unit: 'unidade', unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Pastel Grande de Carne',                             category: 'Delivery - Pastéis Grandes', description: 'Carne',    unit: 'unidade', unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Pastel Grande Camarão com Catupiry',                 category: 'Delivery - Pastéis Grandes', description: 'Peixe',    unit: 'unidade', unit_price: 13.00, is_multiple_of_25: false },
  { name: 'Pastel Grande de Frango',                            category: 'Delivery - Pastéis Grandes', description: 'Frango',   unit: 'unidade', unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Pastel Grande Frango c/ Catupiry',                   category: 'Delivery - Pastéis Grandes', description: 'Frango',   unit: 'unidade', unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Pastel Grande Goiabada c/ Catupiry',                 category: 'Delivery - Pastéis Grandes', description: 'Doce',     unit: 'unidade', unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Pastel Grande Napolitano',                           category: 'Delivery - Pastéis Grandes', description: 'Sem Carne',unit: 'unidade', unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Pastel Grande de Palmito',                           category: 'Delivery - Pastéis Grandes', description: 'Sem Carne',unit: 'unidade', unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Pastel Grande Queijo',                               category: 'Delivery - Pastéis Grandes', description: 'Sem Carne',unit: 'unidade', unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Pastel Grande Vegano',                               category: 'Delivery - Pastéis Grandes', description: 'Sem Carne',unit: 'unidade', unit_price: 8.00,  is_multiple_of_25: false },

  // ── DELIVERY — PASTÉIS PEQUENOS ────────────────────────────────
  { name: 'Pastel Pequeno Chocolate (3 unidades)',              category: 'Delivery - Pastéis Pequenos', description: 'Doce',     unit: 'pacote 3un', unit_price: 7.00,  is_multiple_of_25: false },
  { name: 'Pastel Pequeno Doce de Leite c/ Queijo (3 unidades)',category: 'Delivery - Pastéis Pequenos', description: 'Doce',     unit: 'pacote 3un', unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Pastel Mini Carne',                                  category: 'Delivery - Pastéis Pequenos', description: 'Carne',    unit: 'unidade',    unit_price: 2.06, is_multiple_of_25: false },
  { name: 'Pastel Mini Queijo',                                 category: 'Delivery - Pastéis Pequenos', description: 'Sem Carne',unit: 'unidade',    unit_price: 2.06, is_multiple_of_25: false },

  // ── DELIVERY — PORÇÕES (5 unidades) ───────────────────────────
  { name: 'Porção Crocante Carne (5un)',                        category: 'Delivery - Porções', description: 'Carne',     unit: 'porção', unit_price: 15.00, is_multiple_of_25: false },
  { name: 'Porção Crocante Espinafre (5un)',                    category: 'Delivery - Porções', description: 'Sem Carne', unit: 'porção', unit_price: 15.00, is_multiple_of_25: false },
  { name: 'Porção Coxinha Simples (5un)',                       category: 'Delivery - Porções', description: 'Frango',    unit: 'porção', unit_price: 7.50,  is_multiple_of_25: false },
  { name: 'Porção Quibe (5un)',                                 category: 'Delivery - Porções', description: 'Carne',     unit: 'porção', unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Porção Quibe c/ Catupiry (5un)',                     category: 'Delivery - Porções', description: 'Carne',     unit: 'porção', unit_price: 9.00,  is_multiple_of_25: false },
  { name: 'Porção Mini Churros (5un)',                          category: 'Delivery - Porções', description: 'Doce',      unit: 'porção', unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Porção Pastel Português Milho (5un)',                category: 'Delivery - Porções', description: 'Sem Carne', unit: 'porção', unit_price: 8.00,  is_multiple_of_25: false },

  // ── DELIVERY — SALGADOS ────────────────────────────────────────
  { name: 'Enrolado Salsicha (Delivery)',                       category: 'Delivery - Salgados', description: 'Carne',  unit: 'unidade', unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Enrolado Napolitano (Delivery)',                     category: 'Delivery - Salgados', description: 'Sem Carne', unit: 'unidade', unit_price: 8.00, is_multiple_of_25: false },
  { name: 'Empada de Frango (Delivery)',                        category: 'Delivery - Salgados', description: 'Frango', unit: 'unidade', unit_price: 7.00,  is_multiple_of_25: false },
  { name: 'Pastel Assado Frango (Delivery)',                    category: 'Delivery - Salgados', description: 'Frango', unit: 'unidade', unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Tortinha Frango c/ Catupiry (Delivery)',             category: 'Delivery - Salgados', description: 'Frango', unit: 'unidade', unit_price: 10.00, is_multiple_of_25: false },

  // ── DELIVERY — DOCES ───────────────────────────────────────────
  { name: 'Bombom de Nozes (Delivery)',                         category: 'Delivery - Doces', description: '', unit: 'unidade', unit_price: 8.50,  is_multiple_of_25: false },
  { name: 'Brigadeiro Mini — Bandeja 25 unidades',              category: 'Delivery - Doces', description: '', unit: 'bandeja', unit_price: 38.50, is_multiple_of_25: false },
  { name: 'Doces Grandes 60g (Brigadeiro, Palha Italiana, Cajuzinho)', category: 'Delivery - Doces', description: '', unit: 'unidade', unit_price: 6.00, is_multiple_of_25: false },
  { name: 'Rosca',                                              category: 'Delivery - Doces', description: '', unit: 'unidade', unit_price: 25.00, is_multiple_of_25: false },

  // ── BEBIDAS ────────────────────────────────────────────────────
  { name: 'Água Gasosa 500ml',                                  category: 'Bebidas', description: '', unit: 'garrafa',    unit_price: 4.50,  is_multiple_of_25: false },
  { name: 'Água Mineral 500ml',                                 category: 'Bebidas', description: '', unit: 'garrafa',    unit_price: 4.50,  is_multiple_of_25: false },
  { name: 'Água Mineral 1,5L',                                  category: 'Bebidas', description: '100ml por pessoa', unit: 'garrafa 1,5L', unit_price: 6.00, is_multiple_of_25: false },
  { name: 'Água de Coco 300ml',                                 category: 'Bebidas', description: '', unit: 'unidade',    unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Água de Coco 500ml',                                 category: 'Bebidas', description: '', unit: 'unidade',    unit_price: 10.00, is_multiple_of_25: false },
  { name: 'Café Expresso',                                      category: 'Bebidas', description: '', unit: 'unidade',    unit_price: 6.00,  is_multiple_of_25: false },
  { name: 'Caldo de Cana 300ml',                                category: 'Bebidas', description: '', unit: 'copo',       unit_price: 8.50,  is_multiple_of_25: false },
  { name: 'Caldo de Cana 500ml',                                category: 'Bebidas', description: '', unit: 'copo',       unit_price: 12.00, is_multiple_of_25: false },
  { name: 'Coca-Cola 2L',                                       category: 'Bebidas', description: '200ml por pessoa', unit: 'garrafa 2L', unit_price: 17.50, is_multiple_of_25: false },
  { name: 'Coca-Cola 600ml',                                    category: 'Bebidas', description: '', unit: 'garrafa',    unit_price: 9.50,  is_multiple_of_25: false },
  { name: 'Coca-Cola Lata 350ml',                               category: 'Bebidas', description: '', unit: 'lata',       unit_price: 7.50,  is_multiple_of_25: false },
  { name: 'Coca-Cola 200ml',                                    category: 'Bebidas', description: '', unit: 'garrafa',    unit_price: 4.50,  is_multiple_of_25: false },
  { name: 'Guaraná 2L',                                         category: 'Bebidas', description: '', unit: 'garrafa 2L', unit_price: 17.50, is_multiple_of_25: false },
  { name: 'Guaraná Lata 350ml',                                 category: 'Bebidas', description: '', unit: 'lata',       unit_price: 7.50,  is_multiple_of_25: false },
  { name: 'Mate Couro 2L',                                      category: 'Bebidas', description: '', unit: 'garrafa',    unit_price: 14.00, is_multiple_of_25: false },
  { name: 'Mate Couro 600ml',                                   category: 'Bebidas', description: '', unit: 'garrafa',    unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Mate Couro 2L Zero',                                 category: 'Bebidas', description: '', unit: 'garrafa',    unit_price: 14.00, is_multiple_of_25: false },
  { name: 'Mate Couro 200ml',                                   category: 'Bebidas', description: '', unit: 'garrafa',    unit_price: 4.50,  is_multiple_of_25: false },
  { name: 'Suco Tetra Pack 1L',                                 category: 'Bebidas', description: '200ml por pessoa', unit: 'garrafa 1L', unit_price: 12.00, is_multiple_of_25: false },
  { name: 'Suco Lata 290ml',                                    category: 'Bebidas', description: '', unit: 'lata',       unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Leite',                                              category: 'Bebidas', description: '150ml por pessoa', unit: 'litro',      unit_price: 6.00,  is_multiple_of_25: false },
  { name: 'Chá',                                               category: 'Bebidas', description: '150ml por pessoa', unit: 'litro',      unit_price: 8.00,  is_multiple_of_25: false },
  { name: 'Chocolate Quente',                                   category: 'Bebidas', description: '150ml por pessoa', unit: 'litro',      unit_price: 14.00, is_multiple_of_25: false },

  // ── SUCOS NATURAIS ─────────────────────────────────────────────
  { name: 'Suco Laranja 300ml',                                 category: 'Sucos Naturais', description: '', unit: 'copo', unit_price: 9.00,  is_multiple_of_25: false },
  { name: 'Suco Laranja 500ml',                                 category: 'Sucos Naturais', description: '', unit: 'copo', unit_price: 14.00, is_multiple_of_25: false },
  { name: 'Limonada Suíça 300ml',                               category: 'Sucos Naturais', description: '', unit: 'copo', unit_price: 7.00,  is_multiple_of_25: false },
  { name: 'Limonada Suíça 500ml',                               category: 'Sucos Naturais', description: '', unit: 'copo', unit_price: 10.00, is_multiple_of_25: false },
  { name: 'Limonada Suíça 300ml (Promoção)',                    category: 'Sucos Naturais', description: '', unit: 'copo', unit_price: 6.00,  is_multiple_of_25: false },
  { name: 'Suco Abacaxi, Água de Coco e Gengibre 300ml',        category: 'Sucos Naturais', description: '', unit: 'copo', unit_price: 9.00,  is_multiple_of_25: false },
  { name: 'Suco Abacaxi, Água de Coco e Gengibre 500ml',        category: 'Sucos Naturais', description: '', unit: 'copo', unit_price: 14.00, is_multiple_of_25: false },
  { name: 'Suco Abacaxi c/ Laranja 300ml',                      category: 'Sucos Naturais', description: '', unit: 'copo', unit_price: 9.00,  is_multiple_of_25: false },
  { name: 'Suco Abacaxi c/ Laranja 500ml',                      category: 'Sucos Naturais', description: '', unit: 'copo', unit_price: 14.00, is_multiple_of_25: false },
  { name: 'Suco Morango c/ Laranja 300ml',                      category: 'Sucos Naturais', description: '', unit: 'copo', unit_price: 9.00,  is_multiple_of_25: false },
  { name: 'Suco Morango c/ Laranja 500ml',                      category: 'Sucos Naturais', description: '', unit: 'copo', unit_price: 14.00, is_multiple_of_25: false },

  // ── PRODUTOS CONGELADOS ────────────────────────────────────────
  { name: 'Empada Frango Congelada (25un)',                     category: 'Produtos Congelados', description: '', unit: 'pacote 25un', unit_price: 33.00, is_multiple_of_25: false },
  { name: 'Empada Frango com Catupiry Congelada (25un)',        category: 'Produtos Congelados', description: '', unit: 'pacote 25un', unit_price: 35.00, is_multiple_of_25: false },
  { name: 'Empada Frango com Azeitona Congelada (25un)',        category: 'Produtos Congelados', description: '', unit: 'pacote 25un', unit_price: 34.00, is_multiple_of_25: false },
  { name: 'Empada Palmito Congelada (25un)',                    category: 'Produtos Congelados', description: '', unit: 'pacote 25un', unit_price: 42.00, is_multiple_of_25: false },
  { name: 'Esfirra de Carne Congelada (25un)',                  category: 'Produtos Congelados', description: '', unit: 'pacote 25un', unit_price: 33.00, is_multiple_of_25: false },
  { name: 'Coxinha Simples Congelada (25un)',                   category: 'Produtos Congelados', description: '', unit: 'pacote 25un', unit_price: 33.00, is_multiple_of_25: false },
  { name: 'Coxinha com Catupiry Congelada (25un)',              category: 'Produtos Congelados', description: '', unit: 'pacote 25un', unit_price: 42.00, is_multiple_of_25: false },
  { name: 'Quibe Congelado (25un)',                             category: 'Produtos Congelados', description: '', unit: 'pacote 25un', unit_price: 40.00, is_multiple_of_25: false },
  { name: 'Quibe com Catupiry Congelado (25un)',                category: 'Produtos Congelados', description: '', unit: 'pacote 25un', unit_price: 48.00, is_multiple_of_25: false },
  { name: 'Pastel Frito Congelado Mini Carne (25un)',           category: 'Produtos Congelados', description: '', unit: 'pacote 25un', unit_price: 54.00, is_multiple_of_25: false },
  { name: 'Pastel Frito Congelado Mini Queijo (20un)',          category: 'Produtos Congelados', description: '', unit: 'pacote 20un', unit_price: 62.00, is_multiple_of_25: false },
  { name: 'Pastel Frito Congelado Mini Frango com Catupiry (25un)', category: 'Produtos Congelados', description: '', unit: 'pacote 25un', unit_price: 54.00, is_multiple_of_25: false },
  { name: 'Pastel Crocante Congelado Mini Carne (15un)',        category: 'Produtos Congelados', description: '', unit: 'pacote 15un', unit_price: 40.00, is_multiple_of_25: false },
  { name: 'Pastel Crocante Congelado Mini Espinafre (15un)',    category: 'Produtos Congelados', description: '', unit: 'pacote 15un', unit_price: 40.00, is_multiple_of_25: false },
];

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    const { data: pwdData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'security_master_password')
      .single();

    if (!pwdData || pwdData.value !== password) {
      return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 });
    }

    await supabase
      .from('products')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    const { error: insertError } = await supabase
      .from('products')
      .insert(PRODUCTS.map(p => ({ ...p, is_active: true })));

    if (insertError) throw insertError;

    const categories = [...new Set(PRODUCTS.map(p => p.category))];
    await supabase.from('settings').upsert({
      key: 'category_order',
      value: categories,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      inserted: PRODUCTS.length,
      message: `${PRODUCTS.length} produtos inseridos com sucesso.`,
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
