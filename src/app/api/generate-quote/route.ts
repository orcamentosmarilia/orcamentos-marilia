import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { supabase } from '@/lib/supabaseClient';

// ÚNICA instrução fixa do código: o contrato técnico de SAÍDA (pra conseguir ler o JSON).
// Tudo mais (papel da IA, como calcular, o que incluir) vem das INSTRUÇÕES GLOBAIS e das
// REGRAS DE NEGÓCIO que o usuário configura. Sem prompts ocultos, sem cálculo no código.
const JSON_FORMAT = `## FORMATO DE RESPOSTA (obrigatório)
Responda APENAS com um JSON válido, sem markdown e sem texto fora do JSON:
{
  "items": [
    { "description": "nome do item", "quantity": 0, "unit": "unidade", "unit_price": 0.00, "item_type": "food" }
  ],
  "reasoning": [
    { "item": "...", "calculation": "...", "rule_applied": "...", "choice_reason": "..." }
  ]
}
"item_type" deve ser um destes: "food" (comida), "beverage" (bebida), "accessory" (material/descartável), "service" (serviço/mão de obra), "fee" (taxa).`;

export async function POST(request: Request) {
  try {
    const { formData } = await request.json();

    const guests = formData.guests ? parseInt(formData.guests) : 0;
    const duration = formData.duration ? parseFloat(formData.duration) : 0;
    const selectedServiceIds: string[] = formData.services || [];
    const selectedMaterialIds: string[] = formData.materials || [];
    const selectedDrinkIds: string[] = formData.drinks || [];
    const modalidade = formData.modalidade || '';
    const espeto = formData.espeto || 'nao';
    const budget = formData.budget ? parseFloat(formData.budget) : null;
    const notes: string = (formData.notes || '').trim();
    const eventTime: string | null = formData.eventTime || null;
    const deliveryFee = formData.deliveryFee || 0;
    const deliveryNeighborhood = formData.neighborhood || '';

    // ── Dados (sem cálculo): configurações, regras, catálogo, e o que foi selecionado ──
    const [{ data: configs }, { data: drinkMappingsData }, { data: businessRulesData }, { data: allProductsData }] = await Promise.all([
      supabase.from('system_config').select('key, value'),
      supabase.from('settings').select('value').eq('key', 'drink_mappings').single(),
      supabase.from('settings').select('value').eq('key', 'business_rules').single(),
      supabase.from('products').select('id, name, category, tier, unit, unit_price, is_multiple_of_25, material_type').eq('is_active', true).order('category').order('name'),
    ]);

    const configMap: Record<string, string> = (configs || []).reduce((acc: any, c: any) => { acc[c.key] = c.value; return acc; }, {});
    const provider = configMap['ai_provider']?.toLowerCase() || process.env.AI_PROVIDER || 'anthropic';
    const modelName = configMap['ai_model'] || process.env.AI_MODEL || 'claude-3-haiku-20240307';
    const apiKey = configMap['ai_api_key'] || process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY;
    const globalPrompt = configMap['ai_global_prompt'] || '';

    const businessRules: any[] = Array.isArray(businessRulesData?.value) ? businessRulesData.value : [];
    const allProducts: any[] = allProductsData || [];

    // Bebidas selecionadas → produtos (via drink_mappings id→nome)
    const drinkMap: Record<string, string> = Object.fromEntries(
      (Array.isArray(drinkMappingsData?.value) ? drinkMappingsData.value : []).map((d: any) => [d.id, d.productName])
    );
    const selectedDrinkNames = selectedDrinkIds.map(id => drinkMap[id]).filter(Boolean);
    const drinkProducts = allProducts.filter(p => selectedDrinkNames.some(n => n?.toLowerCase() === p.name.toLowerCase()));

    // Serviços selecionados (tabela própria)
    let services: any[] = [];
    if (selectedServiceIds.length > 0) {
      const { data } = await supabase.from('services').select('name, base_price, extra_price, pricing_type, ratio_x, ratio_y, ratio_ref, is_tableware').in('id', selectedServiceIds);
      services = data || [];
    }
    const materialType = services.some(s => s.is_tableware) ? 'Louça' : (formData.material || 'Descartável');

    // Materiais selecionados → produtos
    const materialProducts = allProducts.filter(p => selectedMaterialIds.includes(p.id));

    // Espeto selecionado → produto
    let espetoProduct: any = null;
    if (espeto && espeto !== 'nao') espetoProduct = allProducts.find(p => p.id === espeto) || null;

    // ── Monta o prompt: SÓ instruções globais + regras + catálogo cru + dados crus ──
    const rulesBlock = businessRules.filter(r => r.active).length > 0
      ? '## REGRAS DE NEGÓCIO\n' + businessRules.filter(r => r.active).map((r, i) => `${i + 1}. ${r.title}: ${r.text}`).join('\n')
      : '';

    const catalogBlock = '## PRODUTOS DISPONÍVEIS (catálogo real — use SÓ estes, com o nome exato)\n'
      + 'Formato: Nome | tier | categoria | unidade | preço' + '\n'
      + allProducts.map(p => `- ${p.name} | ${p.tier || 'sem tier'} | ${p.category} | ${p.unit} | R$${p.unit_price}`).join('\n');

    const systemPrompt = [globalPrompt, rulesBlock, catalogBlock, JSON_FORMAT].filter(Boolean).join('\n\n');

    const fmtList = (arr: any[]) => arr.length ? arr.map(p => `- ${p.name} (${p.unit}, R$${p.unit_price})`).join('\n') : '- (nenhum)';
    const userPrompt = `## DADOS DO EVENTO
- Convidados: ${guests} pessoas
- Duração: ${duration} horas
- Período: ${formData.period || ''}
- Modalidade do cardápio: ${modalidade}
- Material (copos/descartáveis): ${materialType}
- Incluir doces: ${formData.incluiDoces ? 'Sim' : 'Não'}
${budget ? `- Orçamento disponível: R$ ${budget}` : ''}

## BEBIDAS SELECIONADAS (calcule a quantidade pelas regras)
${fmtList(drinkProducts)}

## SERVIÇOS SELECIONADOS (calcule a quantidade pelas regras)
${services.length ? services.map(s => `- ${s.name} (R$${s.base_price}${s.extra_price ? ` + ${s.extra_price}`: ''}, cobrança: ${s.pricing_type})`).join('\n') : '- (nenhum)'}

## MATERIAIS SELECIONADOS (calcule a quantidade pelas regras)
${fmtList(materialProducts)}

## ESPETO
${espetoProduct ? `- ${espetoProduct.name} (${espetoProduct.unit}, R$${espetoProduct.unit_price})` : 'Não'}

A taxa de entrega (R$${deliveryFee}) será adicionada automaticamente — NÃO a inclua.
Monte o orçamento COMPLETO aplicando as INSTRUÇÕES e as REGRAS DE NEGÓCIO aos dados acima.`;

    // ── Salva o rascunho ──
    const eventTypeName = formData.eventName || modalidade || 'Orçamento';
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
        beverages: selectedDrinkIds,
        materials: selectedMaterialIds,
        notes: notes || null,
        created_by: formData.createdBy || 'Sistema',
        lead_source: formData.leadSource || 'WhatsApp',
        ai_prompt_used: JSON.stringify({ modalidade, espeto, budget }),
        delivery_fee: deliveryFee,
        delivery_neighborhood: deliveryNeighborhood,
        ai_rules_snapshot: { modalidade },
      }])
      .select().single();
    if (quoteError) throw new Error('Falha ao salvar rascunho no banco');

    // Taxa de entrega (lookup do bairro, não é cálculo) — adicionada de forma determinística.
    const deliveryItems: any[] = [];
    if (deliveryFee > 0) {
      deliveryItems.push({ quote_id: quote.id, description: `Taxa de Entrega — ${deliveryNeighborhood || 'Entrega'}`, quantity: 1, unit: 'entrega', unit_price: deliveryFee, item_type: 'fee', product_id: null });
      if (materialType === 'Louça') {
        deliveryItems.push({ quote_id: quote.id, description: `Taxa de Retorno (Louça) — ${deliveryNeighborhood || 'Entrega'}`, quantity: 1, unit: 'retorno', unit_price: deliveryFee, item_type: 'fee', product_id: null });
      }
    }

    // Sem chave de API: salva só a taxa de entrega.
    if (!apiKey) {
      if (deliveryItems.length) await supabase.from('quote_items').insert(deliveryItems);
      return NextResponse.json({ success: true, quote_id: quote.id, mocked: true, message: 'Rascunho salvo. Configure a chave de IA em Configurações para gerar o cardápio.' });
    }

    // ── Chama a IA ──
    let aiModel: any;
    if (provider === 'anthropic' || provider === 'claude') aiModel = createAnthropic({ apiKey })(modelName);
    else if (provider === 'openai' || provider === 'gpt') aiModel = createOpenAI({ apiKey })(modelName);
    else if (provider === 'groq') aiModel = createGroq({ apiKey })(modelName);
    else if (provider === 'google' || provider === 'gemini') aiModel = createGoogleGenerativeAI({ apiKey })(modelName);
    else throw new Error(`Provedor ${provider} não suportado.`);

    const { text } = await generateText({ model: aiModel, system: systemPrompt, prompt: userPrompt });

    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    let suggested: { items: any[]; reasoning?: any[] } = { items: [] };
    try { suggested = JSON.parse(jsonString); }
    catch { console.error('AI JSON parse error:', text.slice(0, 500)); throw new Error('A IA não retornou um JSON válido.'); }

    await supabase.from('quotes').update({ ai_system_prompt: systemPrompt, ai_raw_output: text, ai_reasoning: suggested.reasoning || null }).eq('id', quote.id);

    // Casa cada item da IA com um produto real (preço/nome corretos). Falha-seguro:
    // exato (sem sufixos) → produto mais longo contido (>=60%); senão mantém o que a IA mandou.
    function findProduct(description: string) {
      const desc = (description || '').toLowerCase().replace(/\([^)]*\)/g, '').trim();
      if (!desc) return null;
      const exact = allProducts.find(p => p.name.toLowerCase() === desc);
      if (exact) return exact;
      const cands = allProducts.map(p => ({ p, n: p.name.toLowerCase() })).filter(({ n }) => n.length >= 4 && (desc.includes(n) || n.includes(desc))).sort((a, b) => b.n.length - a.n.length);
      if (!cands.length) return null;
      const best = cands[0];
      if (best.n.length / Math.max(best.n.length, desc.length) < 0.6) return null;
      return best.p;
    }

    const aiItems = (suggested.items || []).map((item: any) => {
      const match = findProduct(item.description);
      if (match) {
        return { quote_id: quote.id, product_id: match.id, description: match.name, quantity: item.quantity, unit: match.unit, unit_price: match.unit_price, item_type: item.item_type || (match.material_type ? 'accessory' : 'food') };
      }
      // Não casou: serviços, taxas e itens especiais (ex.: "Café (insumo)") — mantém como a IA mandou.
      return { quote_id: quote.id, product_id: null, description: item.description, quantity: item.quantity, unit: item.unit || 'unidade', unit_price: item.unit_price || 0, item_type: item.item_type || 'food' };
    });

    const finalItems = [...aiItems, ...deliveryItems];
    if (finalItems.length > 0) {
      const { error: itemsError } = await supabase.from('quote_items').insert(finalItems);
      if (itemsError) console.error('Erro inserindo itens:', itemsError);
    }

    return NextResponse.json({ success: true, quote_id: quote.id, items_generated: finalItems.length, provider_used: provider, model_used: modelName });
  } catch (error: any) {
    console.error('Generate Quote Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
