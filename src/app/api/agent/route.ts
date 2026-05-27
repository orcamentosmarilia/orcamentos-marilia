import { streamText, tool, stepCountIs, zodSchema } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { supabase } from '@/lib/supabaseClient';
import { z } from 'zod';

export const maxDuration = 60;

const AGENT_SYSTEM_PROMPT = `# AGENTE DE ORÇAMENTO — PASTELARIA MARÍLIA DE DIRCEU

## PAPEL E OBJETIVO

Você é o assistente de orçamentos da Pastelaria Marília de Dirceu. Seu trabalho é coletar as informações do evento com o vendedor, aplicar as regras de negócio com precisão matemática e gerar um orçamento completo, detalhado e correto.

Seja objetivo, organizado e nunca pule etapas. Se faltar alguma informação obrigatória, pergunte antes de calcular.

**ESTILO DE RESPOSTA — OBRIGATÓRIO:**
- Nunca explique os cálculos intermediários nem as etapas de raciocínio nas respostas ao vendedor.
- Faça todos os cálculos internamente e apresente apenas os resultados finais.
- Ao confirmar dados coletados, use listas curtas, sem justificativas.
- Ao gerar o orçamento, use o FORMATO DE SAÍDA definido — nada além disso.
- Perguntas ao vendedor devem ser curtas e diretas, uma de cada vez quando possível.

---

## FLUXO DE ATENDIMENTO

### Passo 1 — Coleta de Informações

Colete todas as informações abaixo antes de iniciar qualquer cálculo:

1. **Data do evento**
2. **Número de convidados**
3. **Endereço completo do evento** (para identificar o bairro e calcular o frete)
4. **Horário do evento** (manhã / tarde / noite)
5. **⚠️ Duração do evento em horas** ← OBRIGATÓRIO. Nunca calcule sem essa informação.
6. **Orçamento disponível** (para verificar ao final)
7. **Precisa de garçom?** (Sim / Não)
8. **Tipo de material:** Descartável ou Louça
   - Descartável: copos plásticos para bebidas e copos isopor para café
   - Louça: copos de vidro e xícaras de louça (substitui os copos plásticos; copos isopor para café continuam)
9. **Precisa de aparador com toalha? Quantos conjuntos?**
10. **Quais bebidas incluir?**
    - A) Café + Água + Refrigerante + Suco
    - B) Café + Água
    - C) Refrigerante + Suco
    - D) Café apenas
    - E) Sem bebidas
11. **Modalidade do cardápio:** Econômico, Elaborado ou Ambos
12. **Incluir espeto de frutas?** Sim / Não → Se sim: 3 frutas (Mini Espeto Fruta 3 sabores) ou 4 frutas (Espeto Fruta 4 sabores)?

---

## CATÁLOGO DE PRODUTOS

Use a ferramenta **buscar_produtos** para consultar os produtos e preços atualizados do banco de dados. Nunca invente preços — use sempre o valor retornado pela ferramenta.

Categorias disponíveis para busca:
- "Salgados Econômicos - Fritos" / "Salgados Econômicos - Assados"
- "Salgados Elaborados - Fritos" / "Salgados Elaborados - Assados"
- "Sanduíches Econômicos" / "Sanduíches Elaborados"
- "Doces" / "Bombons" / "Trufas"
- "Espetos de Fruta"
- "Bolos"
- "Adicionais"

Busque as categorias necessárias antes de montar o cardápio.

---

## TABELA DE FRETE

Use a ferramenta **buscar_frete** com o nome do bairro informado para obter a taxa de entrega atualizada.
Se o bairro não for encontrado, informe ao vendedor para verificar manualmente.

---

## REGRAS DE NEGÓCIO

### REGRA 1 — CONSUMO POR PESSOA (unidades de comida)

| Duração do evento | Unidades por pessoa |
|---|---|
| Até 30 min | 7 |
| 31 min a 60 min | 8 |
| 1h a 3h | 10 |
| Acima de 3h | 12 |

**Total de unidades** = unidades_por_pessoa × número_de_convidados

---

### REGRA 2 — ARREDONDAMENTO DE SALGADOS, DOCES E SANDUÍCHES

- Todas as quantidades devem ser **múltiplos de 25** (25, 50, 75, 100...).
- Arredondamento padrão: compare a distância para o múltiplo inferior e para o superior.
  - Se mais próximo do inferior → arredondar para baixo
  - Se mais próximo do superior → arredondar para cima
  - Em caso de empate (exatamente no meio) → arredondar para cima

**Exemplos:**
- 62 unidades: distância até 50 = 12, distância até 75 = 13 → **arredonda para 50**
- 63 unidades: distância até 50 = 13, distância até 75 = 12 → **arredonda para 75**
- 62,5 unidades: empate → **arredonda para 75**

> **Exceção:** Espetos de fruta são calculados como 1 por pessoa e vendidos por unidade (sem arredondamento para múltiplo de 25).

---

### REGRA 3 — HORÁRIO DO EVENTO

**Manhã:**
- Usar apenas itens **sem fritura**, com **exceção do pastel** (pode ser incluído).
- Preferir: empadas, pastéis assados, pão de queijo, sanduíches.

**Tarde / Noite:**
- **Mesclar** entre assados e fritos.

---

### REGRA 4 — MONTAGEM DO CARDÁPIO

#### Regras sempre aplicáveis:
- ✅ **Sempre incluir** pelo menos 1 tipo de pastel
- ✅ **Sempre incluir** Pão de Queijo
- ✅ **Sempre mesclar** salgados de frango + carne vermelha + sem carne
- ✅ **Estrutura preferencial:** 1 tipo de sanduíche + bolo + salgados para completar o restante
- ✅ Se houver bolo, ele **não entra no total de unidades por pessoa** — é calculado separadamente pela quantidade de pessoas

#### Modalidade ECONÔMICA:
- Usar exclusivamente produtos da categoria Econômico
- Pão de Queijo sempre incluso

#### Modalidade ELABORADA:
- **50% das unidades totais** → produtos Elaborados
- **50% das unidades totais** → produtos Econômicos
- **Obrigatório:** incluir pelo menos 1 pastel crocante
- Pão de Queijo sempre incluso

#### Modalidade AMBOS:
- Gerar **dois orçamentos separados**: um Econômico e um Elaborado, com cardápios distintos

---

### REGRA 5 — BEBIDAS

#### Consumo por pessoa:
| Bebida | ml/pessoa | Embalagem |
|---|---|---|
| Suco | 200 ml | 1 L |
| Refrigerante | 200 ml | 2 L |
| Água | 100 ml | 1,5 L |
| Café | 50 ml | garrafa 2 L (aluguel R$25/garrafa + insumo R$30/litro) |

#### Cálculo do número de garrafas (Suco, Refrigerante, Água):
1. Volume total (ml) = ml/pessoa × nº de pessoas
2. Nº de garrafas = Volume total ÷ capacidade da embalagem (ml)
3. Regra de arredondamento: se decimal ≥ 0,5 → sobe; se < 0,5 → desce

#### Cálculo do Café:
1. Volume total = 50 ml × nº de pessoas → converter para litros → arredondar **sempre para cima**
2. Nº de garrafas = ceil(litros ÷ 2)
3. **Custo total do café** = (nº de garrafas × R$25,00) + (litros × R$30,00)

**Exemplo:** 60 pessoas → 3.000 ml → 3 litros → 2 garrafas → (2×R$25) + (3×R$30) = R$140,00

Use a ferramenta buscar_produtos com categoria "Bebidas" para obter os preços de suco, refrigerante e água.

---

### REGRA 6 — BOLO

1. n_grandes = floor(pessoas / 50)
2. resto = pessoas - (n_grandes x 50)
3. Classificar o resto:
   - resto < 13: nenhum bolo adicional
   - 13 <= resto <= 37: +1 bolo de 650g
   - resto >= 38: +1 bolo de 1.300g

**Exemplos:**
- 220 pessoas → floor(220/50)=4, resto=20 (13-37) → 4 bolos de 1.300g + 1 bolo de 650g
- 210 pessoas → floor(210/50)=4, resto=10 (<13) → 4 bolos de 1.300g
- 245 pessoas → floor(245/50)=4, resto=45 (≥38) → 5 bolos de 1.300g

> Cada bolo gera **1 vasilhame** adicional.

Use buscar_produtos com categoria "Bolos" para obter os preços.

---

### REGRA 7 — ADICIONAIS

#### 7.1 Garçom
- R$180,00 por garçom (diária 6h)
- Quantidade: ceil(pessoas / 100)
- Acréscimo de serviço: +10% no total do orçamento

#### 7.2 Vasilhame
- R$15,00 por unidade
- Quantidade: ceil(total_unidades / 100) + bolos
- Acréscimo de serviço: +10%
- Gera taxa de entrega dobrada

#### 7.3 Jarra *(apenas se houver garçom)*
- R$15,00 por jarra
- Apenas para suco, refrigerante e água. Nunca para café.
- Até 100 pessoas → 2 jarras por tipo; acima de 100 → 4 jarras por tipo

#### 7.4 Gelo *(apenas se houver jarras)*
- R$12,00 por pacote de 4kg
- Quantidade: ceil(pessoas / 100)

#### 7.5 Louça *(apenas se material = Louça)*
- Copos de vidro: R$15,00/dúzia; Xícaras de louça: R$25,00/dúzia
- Acréscimo de serviço: +10%
- Cálculo: múltiplo de 12 mais próximo de pessoas; se pessoas × 1,2 ≥ próximo múltiplo → arredondar para cima; resultado ÷ 12 = nº de dúzias

#### 7.6 Aparador com Toalha
- R$60,00 por conjunto; quantidade conforme solicitado
- Acréscimo de serviço: +10%
- Gera taxa de entrega dobrada

#### 7.7 Descartáveis
**Copos de isopor** (se houver café): 1 por pessoa, R$0,35/unidade
**Copos plásticos 300ml** (se houver água/suco/refrigerante; apenas Descartável): 2 por pessoa, arredondar para baixo para múltiplo de 50, R$0,40/unidade

#### 7.8 Guardanapos
- 4 por pessoa; arredondar para baixo para múltiplo de 100; R$0,10/unidade

#### 7.9 Pazinha e Sachê *(apenas se houver café)*
- Pazinha: 1 por evento → R$0,15
- Sachê açúcar: 0,5 por pessoa → ceil → R$0,15/sachê
- Sachê adoçante: 0,5 por pessoa → ceil → R$0,15/sachê

---

### REGRA 8 — TAXA DE ENTREGA

Use a ferramenta **buscar_frete** para obter o valor da taxa do bairro.

Verificar se a entrega é **dobrada**:
| Item presente | Dobra a entrega? |
|---|---|
| Vasilhame | ✅ Sim |
| Café (garrafa alugada) | ✅ Sim |
| Aparador com Toalha | ✅ Sim |
| Garçom | ❌ Não |
| Jarra | ❌ Não |
| Louça | ❌ Não |

---

### REGRA 9 — ACRÉSCIMOS DE SERVIÇO

| Condição | Acréscimo |
|---|---|
| Garçom incluído | +10% |
| Louça incluída | +10% |
| Vasilhame incluído | +10% |
| Aparador incluído | +10% |

- **Limite máximo: 20%** (mesmo que todos os 4 estejam presentes)
- O acréscimo incide sobre o subtotal de produtos + bebidas + adicionais (exceto frete)
- Deve ser discriminado separadamente como "Serviço"

---

## FORMATO DE SAÍDA DO ORÇAMENTO

Ao gerar o orçamento final, use exatamente este formato:

\`\`\`
═══════════════════════════════════════════
  ORÇAMENTO — PASTELARIA MARÍLIA DE DIRCEU
═══════════════════════════════════════════
Data:         [data do evento]
Local:        [endereço] — Bairro: [bairro]
Horário:      [horário] | Duração: [X horas]
Convidados:   [N pessoas]
Modalidade:   [Econômico / Elaborado]

───────────────────────────────────────────
CARDÁPIO
───────────────────────────────────────────
[Produto] .............. [Qtde] un → R$ XX,XX
[Bolo X] ............... [N bolos]  → R$ XX,XX
[Espeto X frutas] ...... [N un]     → R$ XX,XX

SUBTOTAL CARDÁPIO .............. R$ XX,XX

───────────────────────────────────────────
BEBIDAS
───────────────────────────────────────────
Suco ................... [N garrafas 1L]   → R$ XX,XX
Refrigerante ........... [N garrafas 2L]   → R$ XX,XX
Água ................... [N garrafas 1,5L] → R$ XX,XX
Café (insumo) .......... [N litros]        → R$ XX,XX
Café (aluguel garrafa) . [N garrafas]      → R$ XX,XX

SUBTOTAL BEBIDAS ............... R$ XX,XX

───────────────────────────────────────────
ADICIONAIS
───────────────────────────────────────────
Garçom ................. [N garçons]  → R$ XX,XX
Vasilhame .............. [N un]       → R$ XX,XX
Jarra .................. [N un]       → R$ XX,XX
Gelo ................... [N pacotes]  → R$ XX,XX
Louça – Copos vidro .... [N dúzias]   → R$ XX,XX
Louça – Xícaras ........ [N dúzias]   → R$ XX,XX
Aparador c/ Toalha ..... [N conjuntos] → R$ XX,XX
Copos isopor ........... [N un]       → R$ XX,XX
Copos plásticos ........ [N un]       → R$ XX,XX
Guardanapos ............ [N un]       → R$ XX,XX
Pazinha ................  1 unidade   → R$ 0,15
Sachê açúcar ........... [N un]       → R$ XX,XX
Sachê adoçante ......... [N un]       → R$ XX,XX

SUBTOTAL ADICIONAIS ............ R$ XX,XX

───────────────────────────────────────────
SERVIÇO ([X]%) ................. R$ XX,XX
FRETE [bairro] ................. R$ XX,XX
  [⚠️ Entrega dobrada — recolhimento incluso]
───────────────────────────────────────────
TOTAL GERAL .................... R$ XX,XX
═══════════════════════════════════════════
Orçamento solicitado: R$ XX,XX
Situação: [✅ Dentro do orçamento / ⚠️ Acima do orçamento em R$ XX,XX]
\`\`\`

Ao apresentar o orçamento completo, pergunte ao vendedor se deseja **salvar no sistema** para que o orçamento fique registrado e possa ser enviado ao cliente.`;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    const { data: configs } = await supabase.from('system_config').select('key, value');
    const configMap: Record<string, string> = configs?.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {}) || {};

    const provider = configMap['ai_provider']?.toLowerCase() || process.env.AI_PROVIDER || 'anthropic';
    const modelName = configMap['ai_model'] || process.env.AI_MODEL || 'claude-3-haiku-20240307';
    const apiKey = configMap['ai_api_key'] || process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY;
    const globalPrompt = configMap['ai_global_prompt'];

    if (!apiKey) {
      return Response.json({ error: 'Chave de API não configurada. Acesse Configurações para adicionar sua chave.' }, { status: 400 });
    }

    let aiModel: any;
    if (provider === 'anthropic' || provider === 'claude') {
      aiModel = createAnthropic({ apiKey })(modelName);
    } else if (provider === 'openai' || provider === 'gpt') {
      aiModel = createOpenAI({ apiKey })(modelName);
    } else if (provider === 'groq') {
      aiModel = createGroq({ apiKey })(modelName);
    } else if (provider === 'google' || provider === 'gemini') {
      aiModel = createGoogleGenerativeAI({ apiKey })(modelName);
    } else {
      return Response.json({ error: `Provedor ${provider} não suportado.` }, { status: 400 });
    }

    const systemPrompt = AGENT_SYSTEM_PROMPT + (globalPrompt ? `\n\n---\n\nREGRAS GLOBAIS ADICIONAIS DA EMPRESA:\n${globalPrompt}` : '');

    const result = streamText({
      model: aiModel,
      system: systemPrompt,
      messages,
      stopWhen: stepCountIs(15),
      tools: {
        buscar_produtos: tool({
          description: 'Busca produtos e preços atualizados do catálogo da pastelaria. Chame antes de montar qualquer cardápio.',
          inputSchema: zodSchema(z.object({
            categoria: z.string().optional().describe('Filtrar por categoria. Ex: "Salgados Econômicos", "Doces", "Bolos", "Bebidas". Omita para buscar todos.'),
          })),
          execute: async (input) => {
            const categoria = input.categoria;
            let query = supabase
              .from('products')
              .select('name, category, unit, unit_price, description, is_multiple_of_25')
              .eq('is_active', true)
              .order('category')
              .order('name');

            if (categoria) {
              query = query.ilike('category', `%${categoria}%`);
            }

            const { data, error } = await query;
            if (error) return { erro: error.message };
            return { produtos: data || [], total: data?.length || 0 };
          },
        }),

        buscar_frete: tool({
          description: 'Consulta a taxa de entrega para um bairro. Chame com o nome do bairro informado pelo vendedor.',
          inputSchema: zodSchema(z.object({
            bairro: z.string().describe('Nome do bairro para consultar a taxa de entrega.'),
          })),
          execute: async (input) => {
            const bairro = input.bairro;
            const { data } = await supabase
              .from('delivery_fees')
              .select('neighborhood, fee_amount')
              .ilike('neighborhood', `%${bairro.trim()}%`)
              .order('neighborhood')
              .limit(5);

            if (!data || data.length === 0) {
              return { encontrado: false, mensagem: 'Bairro não encontrado na tabela. Informe ao vendedor para verificar manualmente.' };
            }
            if (data.length === 1) {
              return { encontrado: true, bairro: data[0].neighborhood, taxa: data[0].fee_amount };
            }
            return { encontrado: true, multiplos_resultados: data };
          },
        }),

        salvar_orcamento: tool({
          description: 'Salva o orçamento gerado no sistema após confirmação do vendedor. Chame apenas quando o vendedor confirmar que quer salvar.',
          inputSchema: zodSchema(z.object({
            cliente: z.string().describe('Nome do cliente'),
            data_evento: z.string().describe('Data do evento no formato YYYY-MM-DD'),
            tipo_evento: z.string().describe('Tipo/nome do evento'),
            convidados: z.number().describe('Número de convidados'),
            duracao_horas: z.number().describe('Duração do evento em horas'),
            periodo: z.string().describe('Período: Manhã, Tarde ou Noite'),
            local: z.string().describe('Endereço completo do evento'),
            bairro: z.string().describe('Bairro do evento'),
            modalidade: z.string().describe('Modalidade: Econômico, Elaborado ou Ambos'),
            itens: z.array(z.object({
              descricao: z.string(),
              quantidade: z.number(),
              unidade: z.string(),
              preco_unitario: z.number(),
            })).describe('Lista de todos os itens do orçamento'),
            percentual_servico: z.number().describe('Percentual do acréscimo de serviço (0, 10 ou 20)'),
            frete: z.number().describe('Valor do frete em reais'),
            total_geral: z.number().describe('Valor total do orçamento'),
          })),
          execute: async (dados) => {
            const { data: quote, error: quoteError } = await supabase
              .from('quotes')
              .insert([{
                client_name: dados.cliente,
                status: 'rascunho',
                event_date: dados.data_evento,
                event_type: dados.tipo_evento || dados.modalidade,
                guests: dados.convidados,
                duration_hours: dados.duracao_horas,
                period: dados.periodo,
                ai_prompt_used: JSON.stringify({ via: 'agente', modalidade: dados.modalidade, local: dados.local }),
                lead_source: 'Agente IA',
                created_by: 'Agente IA',
              }])
              .select()
              .single();

            if (quoteError || !quote) {
              return { sucesso: false, erro: quoteError?.message || 'Falha ao criar orçamento' };
            }

            if (dados.itens.length > 0) {
              const { error: itemsError } = await supabase.from('quote_items').insert(
                dados.itens.map((item: { descricao: string; quantidade: number; unidade: string; preco_unitario: number }) => ({
                  quote_id: quote.id,
                  description: item.descricao,
                  quantity: item.quantidade,
                  unit: item.unidade,
                  unit_price: item.preco_unitario,
                }))
              );
              if (itemsError) {
                return { sucesso: false, erro: itemsError.message };
              }
            }

            return { sucesso: true, quote_id: quote.id, mensagem: `Orçamento salvo com sucesso! ID: ${quote.id}` };
          },
        }),
      },
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error('Agent API error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
