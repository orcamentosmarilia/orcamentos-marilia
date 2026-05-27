import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { provider, apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ models: [] });
    }

    let models: string[] = [];

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      const data = await res.json();
      if (data.data) {
        models = data.data
          .filter((m: any) => m.id.startsWith('gpt-'))
          .map((m: any) => m.id)
          .sort();
      }
    } 
    else if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      const data = await res.json();
      if (data.data) {
        models = data.data.map((m: any) => m.id).sort();
      }
    }
    else if (provider === 'google') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await res.json();
      if (data.models) {
        models = data.models
          .filter((m: any) => m.name.includes('gemini'))
          .map((m: any) => m.name.replace('models/', ''))
          .sort();
      }
    }
    else if (provider === 'anthropic') {
      // Anthropic does not have a public list models API yet.
      // We will provide the most common current ones as a fallback.
      models = [
        'claude-3-5-sonnet-20240620',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
      ];
    }

    return NextResponse.json({ models });
  } catch (error: any) {
    console.error('Error fetching models:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
