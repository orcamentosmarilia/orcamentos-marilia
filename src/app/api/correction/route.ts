import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { supabase } from '@/lib/supabaseClient';

export async function POST(request: Request) {
  try {
    const { quote_id, admin_message } = await request.json();
    if (!quote_id || !admin_message?.trim()) {
      return NextResponse.json({ error: 'quote_id e admin_message são obrigatórios' }, { status: 400 });
    }

    // Fetch quote with AI logs
    const { data: quote, error: qErr } = await supabase
      .from('quotes')
      .select('id, client_name, guests, ai_system_prompt, ai_raw_output, ai_rules_snapshot')
      .eq('id', quote_id)
      .single();
    if (qErr || !quote) return NextResponse.json({ error: 'Orçamento não encontrado' }, { status: 404 });

    // Fetch AI config
    const { data: configs } = await supabase.from('system_config').select('key, value');
    const cfg: Record<string, string> = configs?.reduce((a: any, c: any) => ({ ...a, [c.key]: c.value }), {}) || {};
    const provider = cfg['ai_provider']?.toLowerCase() || process.env.AI_PROVIDER || 'anthropic';
    const modelName = cfg['ai_model'] || process.env.AI_MODEL || 'claude-3-haiku-20240307';
    const apiKey = cfg['ai_api_key'] || process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Chave de API não configurada' }, { status: 400 });

    let aiModel: any;
    if (provider === 'anthropic' || provider === 'claude') aiModel = createAnthropic({ apiKey })(modelName);
    else if (provider === 'openai' || provider === 'gpt') aiModel = createOpenAI({ apiKey })(modelName);
    else if (provider === 'groq') aiModel = createGroq({ apiKey })(modelName);
    else if (provider === 'google' || provider === 'gemini') aiModel = createGoogleGenerativeAI({ apiKey })(modelName);
    else return NextResponse.json({ error: `Provedor ${provider} não suportado` }, { status: 400 });

    const rulesSnapshot: any[] = quote.ai_rules_snapshot || [];
    const rulesText = rulesSnapshot.length > 0
      ? rulesSnapshot.map((r: any) => `### ${r.title}\n${r.content}`).join('\n\n')
      : '(regras não disponíveis)';

    const systemPrompt = `Você é um especialista em regras de negócio de buffet/catering.
Um administrador identificou um erro em um orçamento gerado pela IA e quer melhorar as regras.
Sua tarefa é analisar o erro reportado e sugerir uma melhoria ESPECÍFICA e PRECISA para a regra correspondente.

Responda SOMENTE com um JSON válido, sem markdown:
{
  "analysis": "Análise curta do que causou o erro",
  "affected_rule_id": "ID da regra (ex: '1', '2', ..., '7') ou null se for instrução global",
  "affected_rule_title": "Título da regra afetada",
  "new_rule_content": "Conteúdo COMPLETO e MELHORADO da regra (substitui o conteúdo atual)",
  "explanation": "Por que essa mudança corrige o problema"
}`;

    const userPrompt = `## Orçamento analisado
Cliente: ${quote.client_name} | Convidados: ${quote.guests}

## Regras usadas na geração
${rulesText}

## Output bruto gerado pela IA
${quote.ai_raw_output || '(não disponível)'}

## Mensagem do administrador (o que está errado)
${admin_message}

Analise e sugira a melhoria na regra correspondente.`;

    const { text } = await generateText({ model: aiModel, system: systemPrompt, prompt: userPrompt });

    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    let suggestion: any = {};
    try { suggestion = JSON.parse(jsonStr); } catch { suggestion = { analysis: text, affected_rule_id: null, new_rule_content: null, explanation: '' }; }

    // Save correction record
    const { data: correction } = await supabase.from('ai_corrections').insert([{
      quote_id,
      admin_message,
      ai_suggestion: suggestion.explanation || suggestion.analysis,
      affected_rule_id: suggestion.affected_rule_id,
      new_rule_content: suggestion.new_rule_content,
      status: 'pending',
    }]).select().single();

    return NextResponse.json({ success: true, correction_id: correction?.id, suggestion });
  } catch (err: any) {
    console.error('Correction API error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Apply an approved correction to the business rules
export async function PATCH(request: Request) {
  try {
    const { correction_id } = await request.json();
    if (!correction_id) return NextResponse.json({ error: 'correction_id obrigatório' }, { status: 400 });

    const { data: correction, error: cErr } = await supabase
      .from('ai_corrections')
      .select('*')
      .eq('id', correction_id)
      .single();
    if (cErr || !correction) return NextResponse.json({ error: 'Correção não encontrada' }, { status: 404 });

    if (correction.affected_rule_id && correction.new_rule_content) {
      // Fetch current rules
      const { data: settings } = await supabase.from('settings').select('value').eq('key', 'business_rules').single();
      const currentRules: any[] = Array.isArray(settings?.value) ? settings.value : [];

      const updatedRules = currentRules.map((r: any) =>
        r.id === correction.affected_rule_id
          ? { ...r, content: correction.new_rule_content }
          : r
      );

      await supabase.from('settings').upsert({
        key: 'business_rules',
        value: updatedRules,
        updated_at: new Date().toISOString(),
      });
    }

    // Mark correction as approved
    await supabase.from('ai_corrections').update({ status: 'approved', resolved_at: new Date().toISOString() }).eq('id', correction_id);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Reject a correction
export async function DELETE(request: Request) {
  try {
    const { correction_id } = await request.json();
    await supabase.from('ai_corrections').update({ status: 'rejected', resolved_at: new Date().toISOString() }).eq('id', correction_id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
