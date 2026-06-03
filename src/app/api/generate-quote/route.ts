import { NextResponse } from 'next/server';
import { generateText, tool, stepCountIs, zodSchema } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { supabase } from '@/lib/supabaseClient';
import { z } from 'zod';

function buildAIPrompt(modalidades: any[], composition: any | null, globalPrompt: string | null, rules: any[]): string {
  const modalBlock = modalidades.map(m => {
    const eco = Math.round(((m.tier_split?.Econômico) ?? 1) * 100);
    const ela = Math.round(((m.tier_split?.Elaborado) ?? 0) * 100);
    return `- ${m.name}: ${eco}% tier Econômico + ${ela}% tier Elaborado${m.requires_crocante ? '. Obrigatório ao menos 1 pastel crocante (tier Elaborado).' : ''}`;
  }).join('\n');

  const compLines = composition ? [
    `Itens sempre incluídos: ${(composition.mandatory_items || []).join(', ')}.`,
    `Formatos obrigatórios: ${(composition.mandatory_formats || []).join(', ')}.`,
    `Sabores obrigatórios: ${(composition.mandatory_flavors || []).join(', ')}.`,
    composition.include_sandwich ? 'Inclua sempre ao menos 1 sanduíche.' : '',
    Object.entries(composition.period_restrictions || {}).length > 0
      ? `Restrições por período:\n${Object.entries(composition.period_restrictions).map(([p, r]) => `  - ${p}: ${r}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n') : '';

  const activeRules = (rules || []).filter((r: any) => r.active);
  const rulesBlock = activeRules.length > 0
    ? activeRules.map((r: any, i: number) => `${i + 1}. **${r.title}**: ${r.text}`).join('\n')
    : '';

  return [
    SYSTEM_PROMPT_HEADER,
    modalBlock ? `## MODALIDADES\n${modalBlock}` : '',
    compLines ? `## COMPOSIÇÃO MÍNIMA\n${compLines}` : '',
    rulesBlock ? `## REGRAS DE NEGÓCIO\n${rulesBlock}` : '',
    globalPrompt ? `## INSTRUÇÕES ADICIONAIS DO ADMIN\n${globalPrompt}` : '',
    SYSTEM_PROMPT_FOOTER,
  ].filter(Boolean).join('\n\n');
}

const DRINK_PRODUCT_MAP_DEFAULT: Record<string, string> = {
  cafe:             'Café Expresso',
  agua:             'Água Mineral 1,5L',
  refrigerante:     'Coca-Cola 2L',
  suco_natural:     'Suco Laranja 500ml',
  agua_gas:         'Água Gasosa 500ml',
  suco_tetrapak:    'Suco Tetra Pack 1L',
  leite:            'Leite',
  cha:              'Chá',
  chocolate_quente: 'Chocolate Quente',
};

function calcDrinkQty(product: { unit: string; description: string }, guests: number): number {
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
  return Math.max(1, Math.ceil(guests / 10));
}

const SYSTEM_PROMPT_HEADER = `Você é o gerador de orçamentos da Pastelaria Marília de Dirceu.
Siga EXATAMENTE esta sequência de ferramentas — não pule nenhum passo:

PASSO 1 — calcular_totais: chame este tool com os dados do evento. Ele retorna as quantidades exatas de unidades, divisão por tier e acessórios calculados pelas regras do banco.
PASSO 2 — buscar_produtos: use o(s) tier(s) indicados pelo calcular_totais para buscar produtos reais. Chame uma vez por tier necessário.
PASSO 3 — Monte o cardápio usando as quantidades EXATAS de calcular_totais. NÃO recalcule por conta própria.
PASSO 4 — Retorne o JSON final.

As quantidades retornadas por calcular_totais são definitivas — não arredonde, não ajuste.
Não invente preços — use sempre o retorno de buscar_produtos.`;

const SYSTEM_PROMPT_FOOTER = `NÃO inclua na lista: garçom, louça (aluguel), aparador, jarra, gelo, frete — esses são serviços externos já calculados.

## FORMATO DE SAÍDA
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
    const modalidade = formData.modalidade || 'Econômico';
    const espeto = formData.espeto || 'nao';
    const budget = formData.budget ? parseFloat(formData.budget) : null;
    let materialType = formData.material || 'Descartável';

    // 1. Fetch all settings from DB (single source of truth — nada hardcoded)
    const [{ data: configs }, { data: calcRulesData }, { data: modalidadeData }, { data: compositionData }, { data: drinkMappingsData }, { data: businessRulesData }, { data: categoriesData }] = await Promise.all([
      supabase.from('system_config').select('key, value'),
      supabase.from('settings').select('value').eq('key', 'calculation_rules').single(),
      supabase.from('settings').select('value').eq('key', 'modalidade_config').single(),
      supabase.from('settings').select('value').eq('key', 'composition_rules').single(),
      supabase.from('settings').select('value').eq('key', 'drink_mappings').single(),
      supabase.from('settings').select('value').eq('key', 'business_rules').single(),
      // Categorias reais do catálogo — fonte única da verdade (nada chumbado no código)
      supabase.from('product_categories').select('name').order('name'),
    ]);

    // Lista dinâmica de categorias existentes para orientar a IA (sem nomes fixos no código)
    const categoryNames: string[] = (categoriesData || []).map((c: any) => c.name).filter(Boolean);
    const categoriaDescricao = categoryNames.length > 0
      ? `Categoria exata do catálogo (use exatamente um destes nomes): ${categoryNames.map(n => `"${n}"`).join(', ')}. Omita para buscar em todas.`
      : 'Categoria do catálogo. Omita para buscar em todas.';

    // Validate critical settings — return clear error for admin if missing
    if (!calcRulesData?.value) {
      return NextResponse.json({ error: 'Parâmetros de cálculo não configurados. Acesse Configurações > Parâmetros de Cálculo.' }, { status: 400 });
    }
    if (!modalidadeData?.value || !(modalidadeData.value as any).modalidades) {
      return NextResponse.json({ error: 'Modalidades não configuradas. Acesse Configurações > Modalidades.' }, { status: 400 });
    }

    const calcRules = calcRulesData.value as any;
    const modalidades = (modalidadeData.value as any).modalidades as any[];
    const composition = compositionData?.value as any ?? null;

    const drinkMappingsArr: { id: string; label: string; productName: string }[] =
      Array.isArray(drinkMappingsData?.value) ? drinkMappingsData.value : [];
    const DRINK_PRODUCT_MAP: Record<string, string> = drinkMappingsArr.length > 0
      ? Object.fromEntries(drinkMappingsArr.map(d => [d.id, d.productName]))
      : DRINK_PRODUCT_MAP_DEFAULT;

    const configMap: Record<string, string> = configs?.reduce((acc: any, curr: any) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {}) || {};

    const provider = configMap['ai_provider']?.toLowerCase() || process.env.AI_PROVIDER || 'anthropic';
    const modelName = configMap['ai_model'] || process.env.AI_MODEL || 'claude-3-haiku-20240307';
    const apiKey = configMap['ai_api_key'] || process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY;
    const globalPrompt = configMap['ai_global_prompt'] || null;

    const businessRules: any[] = Array.isArray(businessRulesData?.value) ? businessRulesData.value : [];

    // Build system prompt automatically from structured DB settings
    const GENERATION_SYSTEM_PROMPT = buildAIPrompt(modalidades, composition, globalPrompt, businessRules);

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
        // Detect cup replacements by service name
        hasGlassCup = servicesData.some(srv => /vidro/i.test(srv.name || ''));
        hasPorcelainCup = servicesData.some(srv => /porcel|xícar|xicar/i.test(srv.name || ''));

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
      });

      if (hasTableware) {
        calculatedServices.push({
          description: `Taxa de Retorno (Louça) — ${deliveryNeighborhood || 'Entrega'}`,
          quantity: 1,
          unit: 'retorno',
          unit_price: deliveryFee,
          is_service: true,
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
          const qty = calcDrinkQty(p, guests);
          calculatedServices.push({
            description: p.name,
            quantity: qty,
            unit: p.unit,
            unit_price: p.unit_price,
            product_id: p.id,
            is_service: false,
          });
        });
      }
    }

    // 5. Resolve event profile name
    let eventTypeName = formData.eventName || '';
    if (formData.eventType && formData.eventType !== 'custom' && formData.eventType !== '') {
      const { data: profileData } = await supabase
        .from('event_profiles')
        .select('name')
        .eq('id', formData.eventType)
        .single();
      if (profileData?.name) eventTypeName = profileData.name;
    }
    if (!eventTypeName) eventTypeName = modalidade;

    // 5. Save Quote Draft
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert([{
        client_name: formData.clientName || 'Cliente sem nome',
        status: 'rascunho',
        event_date: formData.eventDate || new Date().toISOString().split('T')[0],
        event_type: eventTypeName,
        guests,
        duration_hours: duration,
        period: formData.period,
        services: selectedServiceIds,
        beverages: formData.drinks || [],
        created_by: formData.createdBy || 'Sistema',
        lead_source: formData.leadSource || 'WhatsApp',
        ai_prompt_used: JSON.stringify({ modalidade, espeto, budget }),
        delivery_fee: deliveryFee,
        delivery_neighborhood: deliveryNeighborhood,
        ai_rules_snapshot: { modalidades, composition },
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

    // 7. Build User Prompt
    const hasCafe = (formData.drinks || []).includes('cafe');
    const hasAguaSucoRefri = (formData.drinks || []).some((d: string) => ['agua', 'suco_natural', 'refrigerante', 'suco_tetrapak', 'agua_gas'].includes(d));

    const espetoDesc = espeto === '3frutas'
      ? 'Mini Espeto Fruta 3 sabores (1 por pessoa)'
      : espeto === '4frutas'
        ? 'Espeto Fruta 4 sabores (1 por pessoa)'
        : 'Não';

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

PARÂMETROS PARA calcular_totais:
- guests: ${guests}
- duration_hours: ${duration}
- modalidade: "${modalidade}"
- inclui_doces: ${formData.incluiDoces ? 'true' : 'false'}
- has_cafe: ${hasCafe ? 'true' : 'false'}
- has_agua_suco_refri: ${hasAguaSucoRefri ? 'true' : 'false'}
- has_tableware: ${hasTableware ? 'true' : 'false'}
- has_glass_cup: ${hasGlassCup ? 'true' : 'false'}
- has_porcelain_cup: ${hasPorcelainCup ? 'true' : 'false'}
- material: "${materialType}"

Siga os 4 passos: calcular_totais → buscar_produtos → montar cardápio → retornar JSON.
NÃO inclua bebidas (já adicionadas). NÃO inclua: ${serviceNames || 'nenhum serviço externo'}.
${hasPorcelainCup ? 'XÍCARA DE PORCELANA selecionada: NÃO inclua copos de isopor (substituídos pela xícara).' : ''}
${hasGlassCup ? 'COPO DE VIDRO selecionado: NÃO inclua copos plásticos (substituídos pelo copo de vidro).' : ''}
Retorne apenas o JSON.`;

    // 8. Call AI with Tool Calling
    const systemPrompt = GENERATION_SYSTEM_PROMPT;

    const { text } = await generateText({
      model: aiModel,
      system: systemPrompt,
      prompt: userPrompt,
      stopWhen: stepCountIs(15),
      tools: {
        calcular_totais: tool({
          description: 'Calcula quantidades exatas de comida e acessórios com base nas regras de cálculo do banco. CHAME ESTE TOOL PRIMEIRO, antes de buscar produtos.',
          inputSchema: zodSchema(z.object({
            guests: z.number().describe('Número de convidados'),
            duration_hours: z.number().describe('Duração do evento em horas'),
            modalidade: z.enum(['Econômico', 'Meio Termo', 'Elaborado']).describe('Modalidade do cardápio selecionada pelo cliente'),
            inclui_doces: z.boolean().describe('Se o cardápio inclui doces'),
            has_cafe: z.boolean().describe('Se há café nas bebidas do evento'),
            has_agua_suco_refri: z.boolean().describe('Se há água, suco ou refrigerante nas bebidas do evento'),
            has_tableware: z.boolean().describe('Se o cliente optou por serviço de louça'),
            has_glass_cup: z.boolean().describe('Se o serviço "Copo de vidro" foi selecionado — substitui copos plásticos'),
            has_porcelain_cup: z.boolean().describe('Se o serviço "Xícara de porcelana" foi selecionado — substitui copos de isopor do café'),
            material: z.enum(['Descartável', 'Louça']).describe('Tipo de material para copos e descartáveis'),
          })),
          execute: async (input) => {
            // calcRules e modalidades vêm do escopo externo (já lidos do banco no início do request)
            const { guests, duration_hours, modalidade, inclui_doces, has_cafe, has_agua_suco_refri, has_glass_cup, has_porcelain_cup, material } = input;

            // Consumo por duração
            const consumption: { max_hours: number; units_per_person: number }[] = calcRules.consumption || [];
            let unitsPerPerson = 10;
            for (const entry of consumption) {
              if (duration_hours <= entry.max_hours) { unitsPerPerson = entry.units_per_person; break; }
            }
            const totalUnitsRaw = unitsPerPerson * guests;

            // Arredondamento
            const foodMultiple: number = calcRules.rounding?.food_multiple ?? 25;
            const lower = Math.floor(totalUnitsRaw / foodMultiple) * foodMultiple;
            const upper = lower + foodMultiple;
            const totalUnits = (totalUnitsRaw - lower) >= (upper - totalUnitsRaw) ? upper : lower;

            // Modalidade: divisão por tier
            const modalConfig = modalidades.find((m: any) => m.name === modalidade)
              ?? { name: modalidade, tier_split: { Econômico: 1.0, Elaborado: 0.0 }, requires_crocante: false };
            const splitEco = (modalConfig.tier_split as any).Econômico ?? 1.0;
            const economicoUnits = Math.round(totalUnits * splitEco);
            const elaboradoUnits = totalUnits - economicoUnits;

            // Regra 6: bolo
            const bf = calcRules.bolo ?? { guests_per_large: 50, extra_small_min: 13, extra_small_max: 37, extra_large_min: 38 };
            const nGrandes = Math.floor(guests / bf.guests_per_large);
            const resto = guests - nGrandes * bf.guests_per_large;
            let extraBoloSize = '';
            if (resto >= bf.extra_large_min) extraBoloSize = 'grande (1300g)';
            else if (resto >= bf.extra_small_min) extraBoloSize = 'pequeno (650g)';
            const extraBolos = extraBoloSize ? 1 : 0;
            const totalBolos = nGrandes + extraBolos;

            // Acessórios
            const ac = calcRules.accessories ?? {};
            const accessories: any[] = [];

            const vasilhameQty = Math.ceil(totalUnits / (ac.vasilhame_per_units ?? 100)) + totalBolos;
            accessories.push({ item: 'Vasilhame', quantity: vasilhameQty, unit: 'unidade', unit_price: ac.vasilhame_price ?? 15 });

            if (has_cafe) {
              // Copos de isopor: omitir se xícara de porcelana foi selecionada
              if (!has_porcelain_cup) {
                const isopQty = Math.round((ac.isopor_per_person ?? 1) * guests);
                accessories.push({ item: 'Copos isopor', quantity: isopQty, unit: 'unidade', unit_price: ac.isopor_price ?? 0.35, rule: `${ac.isopor_per_person ?? 1}/pessoa` });
              }
              accessories.push({ item: 'Pazinha', quantity: 1, unit: 'unidade', unit_price: ac.pazinha_price ?? 0.15, rule: '1 por evento' });
              const sachetQty = Math.ceil((ac.sachet_ratio ?? 0.5) * guests);
              accessories.push({ item: 'Sachê açúcar', quantity: sachetQty, unit: 'unidade', unit_price: ac.sachet_price ?? 0.15, rule: `${ac.sachet_ratio ?? 0.5}/pessoa` });
              accessories.push({ item: 'Sachê adoçante', quantity: sachetQty, unit: 'unidade', unit_price: ac.sachet_price ?? 0.15, rule: `${ac.sachet_ratio ?? 0.5}/pessoa` });
            }

            // Copos plásticos: omitir se copo de vidro foi selecionado
            if (has_agua_suco_refri && !has_glass_cup && material === 'Descartável') {
              const rawCopos = (ac.copo_per_person ?? 2) * guests;
              const coposMultiple = calcRules.rounding?.copos_multiple ?? 50;
              const coposQty = Math.floor(rawCopos / coposMultiple) * coposMultiple;
              accessories.push({ item: 'Copos plásticos 300ml', quantity: coposQty, unit: 'unidade', unit_price: ac.copo_price ?? 0.40, rule: `${ac.copo_per_person ?? 2}/pessoa, arredondar PARA BAIXO ao múltiplo de ${coposMultiple}` });
            }

            const rawGuardanapos = (ac.guardanapo_per_person ?? 4) * guests;
            const guardaMultiple = calcRules.rounding?.guardanapos_multiple ?? 100;
            const guardanapQty = Math.floor(rawGuardanapos / guardaMultiple) * guardaMultiple;
            accessories.push({ item: 'Guardanapos', quantity: guardanapQty, unit: 'unidade', unit_price: ac.guardanapo_price ?? 0.10, rule: `${ac.guardanapo_per_person ?? 4}/pessoa, arredondar PARA BAIXO ao múltiplo de ${guardaMultiple}` });

            return {
              guests,
              duration_hours,
              modalidade,
              units_per_person: unitsPerPerson,
              total_units_raw: totalUnitsRaw,
              total_units: totalUnits,
              food_multiple: foodMultiple,
              tier_breakdown: {
                Econômico: economicoUnits,
                Elaborado: elaboradoUnits,
                requires_crocante: modalConfig.requires_crocante,
              },
              inclui_doces,
              bolo: {
                total_bolos: totalBolos,
                n_grandes: nGrandes,
                extra_bolo_size: extraBoloSize || null,
              },
              accessories,
              instrucoes: [
                `Use EXATAMENTE ${totalUnits} unidades de alimentos no cardápio (múltiplo de ${foodMultiple}).`,
                `Tier Econômico: ${economicoUnits} un | Tier Elaborado: ${elaboradoUnits} un.`,
                modalConfig.requires_crocante ? 'OBRIGATÓRIO ao menos 1 pastel crocante (tier Elaborado).' : '',
                inclui_doces ? 'Inclua doces no cardápio dentro do total de unidades.' : 'NÃO inclua doces.',
                totalBolos > 0 ? `Inclua ${totalBolos} bolo(s): ${nGrandes}× grande${extraBoloSize ? ` + 1× ${extraBoloSize}` : ''}. Bolos não entram no total de unidades.` : 'Nenhum bolo neste evento.',
                `Acessórios já calculados acima — inclua-os no JSON com os preços indicados.`,
              ].filter(Boolean),
            };
          },
        }),

        buscar_produtos: tool({
          description: 'Busca produtos e preços atualizados do catálogo. Use tier para filtrar por modalidade econômica/elaborada.',
          inputSchema: zodSchema(z.object({
            categoria: z.string().optional().describe(categoriaDescricao),
            tier: z.enum(['Econômico', 'Elaborado']).optional().describe('Modalidade: "Econômico" = produtos econômicos, "Elaborado" = produtos elaborados. Omita para trazer de ambas as modalidades.'),
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
      .select('id, name, category, unit, unit_price')
      .eq('is_active', true);

    const productList = allProducts || [];

    function findProduct(description: string) {
      const desc = description.toLowerCase().trim();
      // Exact match
      const exact = productList.find(p => p.name.toLowerCase() === desc);
      if (exact) return exact;
      // Substring match (description contains product name or vice versa)
      const partial = productList.find(
        p => desc.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(desc)
      );
      return partial || null;
    }

    // Computed accessories that are rule-based (not catalog products)
    const COMPUTED_KEYWORDS = ['vasilhame', 'copo', 'guardanapo', 'pazinha', 'sachê', 'açúcar', 'adoçante', 'café (insumo)', 'café (aluguel'];

    const isComputed = (desc: string) =>
      COMPUTED_KEYWORDS.some(kw => desc.toLowerCase().includes(kw));

    // 11. Save All Items
    const finalItems = [
      ...calculatedServices.map(srv => ({
        quote_id: quote.id,
        description: srv.description,
        quantity: srv.quantity,
        unit: srv.unit,
        unit_price: srv.unit_price,
      })),
      ...(suggestedItems.items || []).map((item: any) => {
        // Computed accessories bypass product matching
        if (isComputed(item.description)) {
          return { quote_id: quote.id, description: item.description, quantity: item.quantity, unit: item.unit, unit_price: item.unit_price };
        }
        // Match against real DB products
        const match = findProduct(item.description);
        if (match) {
          return { quote_id: quote.id, product_id: match.id, description: match.name, quantity: item.quantity, unit: match.unit, unit_price: match.unit_price };
        }
        // No match found — skip this item (AI hallucinated a product not in DB)
        console.warn('Produto não encontrado no catálogo, ignorado:', item.description);
        return null;
      }).filter(Boolean),
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
