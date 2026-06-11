import { NextResponse } from 'next/server';
import { generateText, tool, stepCountIs, zodSchema } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { supabase } from '@/lib/supabaseClient';
import { z } from 'zod';

function buildAIPrompt(globalPrompt: string | null, rules: any[]): string {
  const activeRules = (rules || []).filter((r: any) => r.active);
  const rulesBlock = activeRules.length > 0
    ? activeRules.map((r: any, i: number) => `${i + 1}. **${r.title}**: ${r.text}`).join('\n')
    : '';

  return [
    SYSTEM_PROMPT_HEADER,
    rulesBlock ? `## REGRAS DE NEGÓCIO\n${rulesBlock}` : '',
    globalPrompt ? `## INSTRUÇÕES ADICIONAIS DO ADMIN\n${globalPrompt}` : '',
    SYSTEM_PROMPT_FOOTER,
  ].filter(Boolean).join('\n\n');
}

// Quantidade de bebida: prioriza "N ml por pessoa" na descrição do produto;
// senão usa a regra configurada (1 a cada `guestsPerUnit` pessoas).
function calcDrinkQty(product: { unit: string; description: string }, guests: number, guestsPerUnit: number): number {
  const mlPerPersonMatch = product.description?.match(/(\d+)\s*ml\s*por\s*pessoa/i);
  if (mlPerPersonMatch) {
    const mlPerPerson = parseInt(mlPerPersonMatch[1]);
    const lMatch = product.unit.match(/(\d+(?:[,.]\d+)?)\s*L/i);
    const mlMatch = product.unit.match(/(\d+)\s*ml/i);
    const unitMl = lMatch
      ? parseFloat(lMatch[1].replace(',', '.')) * 1000
      : mlMatch ? parseInt(mlMatch[1]) : 0;
    if (unitMl > 0) return Math.max(1, Math.ceil((mlPerPerson * guests) / unitMl));
  }
  return Math.max(1, Math.ceil(guests / (guestsPerUnit || 10)));
}

const SYSTEM_PROMPT_HEADER = `Você é o gerador de orçamentos da Pastelaria Marília de Dirceu.
Monte o cardápio e as quantidades SEGUINDO as REGRAS DE NEGÓCIO abaixo (consumo por pessoa conforme a duração, modalidade do cardápio, arredondamentos, composição etc.).

Passos OBRIGATÓRIOS:
1. buscar_produtos: PRIMEIRO veja os produtos REAIS do catálogo. A modalidade define o TIER permitido: Econômico → buscar_produtos(tier="Econômico"); Elaborado → tier="Elaborado"; Meio Termo → busque os dois. Chame quantas vezes precisar (por categoria também).
2. Escolha SOMENTE entre os produtos que apareceram no buscar_produtos. NÃO invente produtos.
3. Calcule as quantidades pelas REGRAS DE NEGÓCIO (convidados, duração).
4. Inclua os MATERIAIS E ACESSÓRIOS conforme a seção correspondente.
5. Retorne o JSON final.

REGRAS CRÍTICAS DE NOMES:
- No campo "description", use EXATAMENTE o nome do produto como veio do buscar_produtos (copie igualzinho).
- "Econômico"/"Elaborado" é o TIER (filtro), NÃO faz parte do nome — NUNCA escreva "(Econômico)" nem "Pastel de Carne" se o produto se chama só "Carne". Use o nome exato do catálogo.
- Não invente preços — use sempre o unit_price do buscar_produtos.`;

const SYSTEM_PROMPT_FOOTER = `## FORMATO DE SAÍDA
Retorne SOMENTE um JSON válido, sem markdown, sem texto extra:
{
  "items": [
    { "description": "Nome exato do item", "quantity": N, "unit": "unidade", "unit_price": 0.00 }
  ],
  "reasoning": [
    {
      "item": "Nome do item",
      "calculation": "Cálculo passo a passo: ex. 80 pessoas × 10 un/pessoa (2h) = 800. 30% pastéis = 240. Múltiplo de 25 → 250.",
      "rule_applied": "Regra 1, Regra 2",
      "choice_reason": "Por que este produto/quantidade foi escolhido"
    }
  ]
}`;


export async function POST(request: Request) {
  try {
    const { formData } = await request.json();

    const guests = formData.guests ? parseInt(formData.guests) : 0;
    const duration = formData.duration ? parseFloat(formData.duration) : 0;
    const selectedServiceIds = formData.services || [];
    const selectedMaterialIds: string[] = formData.materials || [];
    const modalidade = formData.modalidade || 'Econômico';
    const espeto = formData.espeto || 'nao';
    const budget = formData.budget ? parseFloat(formData.budget) : null;
    const notes: string = (formData.notes || '').trim();
    const eventTime: string = formData.eventTime || null;
    let materialType = formData.material || 'Descartável';

    // 1. Fetch settings from DB
    const [{ data: configs }, { data: drinkMappingsData }, { data: businessRulesData }, { data: categoriesData }, { data: formCfgData }] = await Promise.all([
      supabase.from('system_config').select('key, value'),
      supabase.from('settings').select('value').eq('key', 'drink_mappings').single(),
      supabase.from('settings').select('value').eq('key', 'business_rules').single(),
      supabase.from('product_categories').select('name').order('name'),
      supabase.from('settings').select('value').eq('key', 'quote_form_config').single(),
    ]);

    // Lista dinâmica de categorias existentes para orientar a IA (sem nomes fixos no código)
    const categoryNames: string[] = (categoriesData || []).map((c: any) => c.name).filter(Boolean);
    const categoriaDescricao = categoryNames.length > 0
      ? `Categoria exata do catálogo (use exatamente um destes nomes): ${categoryNames.map(n => `"${n}"`).join(', ')}. Omita para buscar em todas.`
      : 'Categoria do catálogo. Omita para buscar em todas.';

    const formCfg = (formCfgData?.value as any) ?? {};

    // Mapa de bebidas — fonte única no banco (sem fallback chumbado).
    const drinkMappingsArr: any[] = Array.isArray(drinkMappingsData?.value) ? drinkMappingsData.value : [];
    const DRINK_PRODUCT_MAP: Record<string, string> = Object.fromEntries(drinkMappingsArr.map(d => [d.id, d.productName]));
    // Por nome do produto: regra de quantidade (1 a cada N pessoas).
    const drinkQtyByName: Record<string, number> = Object.fromEntries(
      drinkMappingsArr.filter(d => d.productName).map(d => [d.productName, d.guests_per_unit || 10])
    );
    // Conjuntos de ids que disparam café / bebida fria (antes listas chumbadas).
    const coffeeDrinkIds = new Set(drinkMappingsArr.filter(d => d.counts_as_coffee).map(d => d.id));
    const coldDrinkIds = new Set(drinkMappingsArr.filter(d => d.counts_as_cold_drink).map(d => d.id));

    const configMap: Record<string, string> = configs?.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {}) || {};

    const provider = configMap['ai_provider']?.toLowerCase() || process.env.AI_PROVIDER || 'anthropic';
    const modelName = configMap['ai_model'] || process.env.AI_MODEL || 'claude-3-haiku-20240307';
    const apiKey = configMap['ai_api_key'] || process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY;
    const globalPrompt = configMap['ai_global_prompt'] || null;

    const businessRules: any[] = Array.isArray(businessRulesData?.value) ? businessRulesData.value : [];

    // Materiais e acessórios — produto + regra em texto. A IA inclui conforme a regra.
    const { data: depRulesData } = await supabase.from('product_dependencies').select('*').eq('active', true).order('sort_order');
    const depList: any[] = depRulesData || [];
    const depProductIds = new Set<string>(depList.map((r: any) => r.product_id).filter(Boolean));
    let depProducts: Record<string, any> = {};
    if (depProductIds.size > 0) {
      const { data: dp } = await supabase.from('products').select('id,name,unit,unit_price,material_type').in('id', Array.from(depProductIds));
      depProducts = Object.fromEntries((dp || []).map((p: any) => [p.id, p]));
    }
    // Inclui no prompt: materiais SELECIONADOS no formulário + regras sem tipo de material (ex.: bolo, sempre).
    const selectedMaterialSet = new Set<string>(selectedMaterialIds);
    const activeDeps = depList.filter((r: any) => {
      const p = depProducts[r.product_id];
      const isMaterial = !!p?.material_type;
      return isMaterial ? selectedMaterialSet.has(r.product_id) : true;
    });
    const materialsRulesText = activeDeps.length
      ? '## MATERIAIS E ACESSÓRIOS\nInclua estes itens no orçamento conforme a regra de cada um. Use exatamente o nome e o preço do produto do catálogo:\n'
        + activeDeps.map((r: any) => {
            const p = depProducts[r.product_id];
            if (!p) return null;
            return `- ${p.name} (R$ ${p.unit_price}/${p.unit}): ${r.rule_text || 'conforme necessário'}`;
          }).filter(Boolean).join('\n')
      : '';

    // Prompt do sistema = regras de negócio escritas (modalidade, consumo, arredondamento, etc.).
    const GENERATION_SYSTEM_PROMPT = buildAIPrompt(globalPrompt, businessRules);

    // 2. Fetch Selected Services & Calculate Deterministic Prices
    let calculatedServices: any[] = [];
    let hasTableware = false;
    let hasGlassCup = false;    // Copo de vidro → substitui copos plásticos
    let hasPorcelainCup = false; // Xícara de porcelana → substitui copos de isopor

    if (selectedServiceIds.length > 0) {
      const { data: servicesData } = await supabase.from('services').select('*').in('id', selectedServiceIds);
      if (servicesData) {
        hasTableware = servicesData.some(srv => srv.is_tableware === true);
        if (hasTableware) materialType = 'Louça';
        // Substituição descartável×louça agora sai do tipo do material do produto
        // vs o material do evento (lib/dependencies). Sem detecção por palavra-chave.

        servicesData.forEach(srv => {
          let quantity = 1;
          let unit = 'serviço';

          if (srv.pricing_type === 'time_based') {
            quantity = duration;
            unit = 'horas';
          } else if (srv.pricing_type === 'per_person') {
            quantity = guests;
            unit = 'pessoas';
          } else if (srv.pricing_type === 'ratio_based') {
            const multiplier = Math.ceil(guests / (srv.ratio_y || 1));
            quantity = multiplier * (srv.ratio_x || 1);
            unit = 'unidades';
          } else if (srv.pricing_type === 'ratio_of_item') {
            // Quantity depends on another item — resolved by AI; placeholder qty
            quantity = 1;
            unit = `a cada ${srv.ratio_y || 1} ${srv.ratio_ref || 'item'}`;
          } else if (srv.pricing_type === 'fixed_plus_percent') {
            quantity = 1;
            unit = 'serviço';
            // When tableware is present, percentage doubles (10% → 20%)
            // extra_price holds the base %; we'll store both to display properly
          } else if (srv.pricing_type === 'fixed') {
            quantity = 1;
          } else if (srv.pricing_type === 'percentage') {
            unit = '% sobre total';
          }

          // For fixed_plus_percent, adjust % when louça is present
          const effectiveExtraPrice = (srv.pricing_type === 'fixed_plus_percent' && hasTableware)
            ? (srv.extra_price || 0) * 2
            : (srv.extra_price || 0);

          const description = (srv.pricing_type === 'fixed_plus_percent')
            ? `${srv.name} (${effectiveExtraPrice}% sobre o pedido${hasTableware ? ' — louça' : ''})`
            : srv.name;

          calculatedServices.push({
            description,
            quantity,
            unit,
            unit_price: srv.base_price,
            extra_price: effectiveExtraPrice,
            pricing_type: srv.pricing_type,
            is_service: true,
            item_type: 'service',
          });
        });
      }
    }

    // 3. Add Delivery Fee + Return Fee if tableware is present
    const deliveryFee = formData.deliveryFee || 0;
    const deliveryNeighborhood = formData.neighborhood || '';
    if (deliveryFee > 0) {
      calculatedServices.push({
        description: `Taxa de Entrega — ${deliveryNeighborhood || 'Entrega'}`,
        quantity: 1,
        unit: 'entrega',
        unit_price: deliveryFee,
        is_service: true,
        item_type: 'fee',
      });

      if (hasTableware) {
        calculatedServices.push({
          description: `Taxa de Retorno (Louça) — ${deliveryNeighborhood || 'Entrega'}`,
          quantity: 1,
          unit: 'retorno',
          unit_price: deliveryFee,
          is_service: true,
          item_type: 'fee',
        });
      }
    }

    // 4. Resolve drink products directly from DB (no AI guessing)
    const selectedDrinkIds: string[] = formData.drinks || [];
    if (selectedDrinkIds.length > 0) {
      const drinkNames = selectedDrinkIds
        .map((id: string) => DRINK_PRODUCT_MAP[id])
        .filter(Boolean);
      if (drinkNames.length > 0) {
        const { data: drinkData } = await supabase
          .from('products')
          .select('id, name, unit, unit_price, description')
          .in('name', drinkNames)
          .eq('is_active', true);
        (drinkData || []).forEach((p: any) => {
          const qty = calcDrinkQty(p, guests, drinkQtyByName[p.name]);
          calculatedServices.push({
            description: p.name,
            quantity: qty,
            unit: p.unit,
            unit_price: p.unit_price,
            product_id: p.id,
            is_service: false,
            item_type: 'beverage',
          });
        });
      }
    }

    // 5. Nome do evento (texto livre do formulário)
    let eventTypeName = formData.eventName || '';
    if (!eventTypeName) eventTypeName = modalidade;

    // 5. Save Quote Draft
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert([{
        client_name: formData.clientName || 'Cliente sem nome',
        status: 'rascunho',
        event_date: formData.eventDate || new Date().toISOString().split('T')[0],
        event_time: eventTime,
        event_type: eventTypeName,
        guests,
        duration_hours: duration,
        period: formData.period,
        services: selectedServiceIds,
        beverages: formData.drinks || [],
        materials: selectedMaterialIds,
        notes: notes || null,
        created_by: formData.createdBy || 'Sistema',
        lead_source: formData.leadSource || 'WhatsApp',
        ai_prompt_used: JSON.stringify({ modalidade, espeto, budget }),
        delivery_fee: deliveryFee,
        delivery_neighborhood: deliveryNeighborhood,
        ai_rules_snapshot: { modalidade },
      }])
      .select()
      .single();

    if (quoteError) throw new Error('Falha ao salvar rascunho no banco');

    // 5. Fallback sem API Key: salva só serviços
    if (!apiKey) {
      if (calculatedServices.length > 0) {
        await supabase.from('quote_items').insert(
          calculatedServices.map(srv => ({
            quote_id: quote.id,
            description: srv.description,
            quantity: srv.quantity,
            unit: srv.unit,
            unit_price: srv.unit_price,
            item_type: srv.item_type ?? 'service',
            product_id: srv.product_id ?? null,
          }))
        );
      }
      return NextResponse.json({
        success: true,
        quote_id: quote.id,
        mocked: true,
        message: 'Rascunho salvo com serviços. Configure a chave de API nas Configurações para gerar o cardápio.',
      });
    }

    // 6. Create AI Model
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
      throw new Error(`Provedor ${provider} não suportado.`);
    }

    // 7. Build User Prompt — café/bebida fria derivados das flags do banco.
    const hasCafe = (formData.drinks || []).some((d: string) => coffeeDrinkIds.has(d));
    const hasAguaSucoRefri = (formData.drinks || []).some((d: string) => coldDrinkIds.has(d));

    // Espeto — produto associado (quote_form_config.skewer_products). 1 por pessoa, já incluído.
    let espetoDesc = 'Não';
    if (espeto && espeto !== 'nao') {
      const { data: espProd } = await supabase.from('products').select('id,name,unit,unit_price').eq('id', espeto).single();
      if (espProd) {
        calculatedServices.push({ description: espProd.name, quantity: guests, unit: espProd.unit, unit_price: espProd.unit_price, product_id: espProd.id, is_service: false, item_type: 'food' });
        espetoDesc = `${espProd.name} (1 por pessoa, já incluído — não repetir)`;
      }
    }

    const drinkNames = (formData.drinks || [])
      .map((id: string) => DRINK_PRODUCT_MAP[id])
      .filter(Boolean)
      .join(', ') || 'Nenhuma';

    const serviceNames = calculatedServices.map((s: any) => s.description).join(', ') || 'Nenhum';

    const userPrompt = `Gere o orçamento completo para este evento:

- Convidados: ${guests} pessoas
- Duração: ${duration} horas
- Período: ${formData.period || 'Tarde'}
- Modalidade do cardápio: ${modalidade}
- Incluir doces no cardápio: ${formData.incluiDoces ? 'Sim' : 'Não'}
- Espeto de frutas: ${espetoDesc}
- Material (copos): ${materialType}
- Bairro do evento: ${formData.neighborhood || 'não informado'}
- Bebidas (já incluídas, NÃO repetir): ${drinkNames}
- Demais itens já cobertos (NÃO incluir): ${serviceNames}
${budget ? `- Orçamento disponível: R$ ${budget}` : ''}

Calcule as quantidades a partir das REGRAS DE NEGÓCIO (consumo por pessoa conforme a duração, modalidade "${modalidade}", arredondamentos, composição).
Use buscar_produtos para pegar os produtos reais e seus preços.
NÃO inclua bebidas (já adicionadas). NÃO inclua: ${serviceNames || 'nenhum serviço externo'}.
Retorne apenas o JSON.`;

    // 8. Call AI with Tool Calling
    const notesBlock = notes
      ? `## OBSERVAÇÕES DO VENDEDOR\nLeve em conta estas observações ao montar o orçamento:\n${notes}`
      : '';
    const systemPrompt = [GENERATION_SYSTEM_PROMPT, materialsRulesText, notesBlock].filter(Boolean).join('\n\n');

    const { text } = await generateText({
      model: aiModel,
      system: systemPrompt,
      prompt: userPrompt,
      stopWhen: stepCountIs(15),
      tools: {
        buscar_produtos: tool({
          description: 'Busca produtos e preços atualizados do catálogo. Use tier para filtrar por modalidade econômica/elaborada.',
          inputSchema: zodSchema(z.object({
            categoria: z.string().optional().describe(categoriaDescricao),
            tier: z.string().optional().describe('Tier do produto (ex.: "Econômico" ou "Elaborado"). Omita para trazer de todos os tiers.'),
          })),
          execute: async (input) => {
            const { categoria, tier } = input;
            let query = supabase
              .from('products')
              .select('name, category, tier, unit, unit_price, is_multiple_of_25')
              .eq('is_active', true)
              .order('category')
              .order('name');
            if (categoria) query = query.ilike('category', `%${categoria}%`);
            if (tier) query = query.eq('tier', tier);
            const { data } = await query;
            return { produtos: data || [] };
          },
        }),
      },
    });

    // 9. Parse JSON first so we can save reasoning alongside
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    let suggestedItems: { items: any[]; reasoning?: any[] } = { items: [] };
    try {
      const parsed = JSON.parse(jsonString);
      suggestedItems = parsed;
    } catch {
      console.error('AI JSON parse error:', text.slice(0, 500));
      throw new Error('A IA não retornou um JSON válido.');
    }

    // 10. Save AI log + reasoning to quote
    await supabase.from('quotes').update({
      ai_system_prompt: systemPrompt,
      ai_raw_output: text,
      ai_reasoning: suggestedItems.reasoning || null,
    }).eq('id', quote.id);

    // 11. Fetch full product catalog to validate AI output
    const { data: allProducts } = await supabase
      .from('products')
      .select('id, name, category, unit, unit_price, material_type')
      .eq('is_active', true);

    const productList = allProducts || [];

    // Casa a descrição da IA com um produto REAL do catálogo.
    // (a) tira sufixos como "(Econômico)" — tier é filtro, não nome.
    // (b) tenta nome EXATO; (c) senão, o nome de produto MAIS LONGO contido na
    //     descrição (específico ganha de genérico: "Pão de Queijo" > "Queijo").
    // Nunca casa por pedaço minúsculo: exige o produto cobrir boa parte da descrição,
    // pra não trocar um item inventado por um produto errado.
    function findProduct(description: string) {
      const desc = description.toLowerCase().replace(/\([^)]*\)/g, '').trim();
      if (!desc) return null;
      const exact = productList.find(p => p.name.toLowerCase() === desc);
      if (exact) return exact;
      // produtos cujo nome está contido na descrição (ou vice-versa)
      const candidates = productList
        .map(p => ({ p, n: p.name.toLowerCase() }))
        .filter(({ n }) => n.length >= 4 && (desc.includes(n) || n.includes(desc)))
        .sort((a, b) => b.n.length - a.n.length);
      if (candidates.length === 0) return null;
      const best = candidates[0];
      // confiança: o nome casado precisa cobrir >= 50% da descrição, senão é arriscado.
      const longer = Math.max(best.n.length, desc.length);
      if (best.n.length / longer < 0.6) return null;
      return best.p;
    }

    // 11. Save All Items — materiais/acessórios agora vêm do próprio cardápio da IA
    // (conforme as regras de materiais em texto), casados com o produto do catálogo.
    const finalItems = [
      ...calculatedServices.map(srv => ({
        quote_id: quote.id,
        description: srv.description,
        quantity: srv.quantity,
        unit: srv.unit,
        unit_price: srv.unit_price,
        item_type: srv.item_type ?? 'service',
        product_id: srv.product_id ?? null,
      })),
      ...(suggestedItems.items || []).map((item: any) => {
        const match = findProduct(item.description);
        if (match) {
          // material_type marcado → é material/acessório; senão é comida.
          const tipo = match.material_type ? 'accessory' : 'food';
          return { quote_id: quote.id, product_id: match.id, description: match.name, quantity: item.quantity, unit: match.unit, unit_price: match.unit_price, item_type: tipo };
        }
        // Sem casamento confiável: NÃO troca por produto errado. Mantém o item da IA
        // como veio (sem product_id) para o vendedor revisar/corrigir na Revisão.
        console.warn('Produto não casado no catálogo (mantido p/ revisão):', item.description);
        return { quote_id: quote.id, product_id: null, description: item.description, quantity: item.quantity, unit: item.unit || 'unidade', unit_price: item.unit_price || 0, item_type: 'food' };
      }),
    ];

    if (finalItems.length > 0) {
      const { error: itemsError } = await supabase.from('quote_items').insert(finalItems);
      if (itemsError) console.error('Erro inserindo itens:', itemsError);
    }

    return NextResponse.json({
      success: true,
      quote_id: quote.id,
      items_generated: finalItems.length,
      provider_used: provider,
      model_used: modelName,
    });

  } catch (error: any) {
    console.error('Generate Quote Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
