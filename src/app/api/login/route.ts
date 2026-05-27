import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios.' }, { status: 400 });
    }

    // Service role key — nunca exposta ao browser, só existe no servidor
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY não configurada');
      return NextResponse.json({ error: 'Configuração de servidor inválida.' }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('id, email, name, role')
      .eq('email', email.trim().toLowerCase())
      .eq('password', password.trim())
      .single();

    if (error || !data) {
      // Não revelar se é e-mail ou senha inválida (evita enumeração)
      return NextResponse.json({ error: 'E-mail ou senha incorretos.' }, { status: 401 });
    }

    return NextResponse.json({ user: data });
  } catch (err) {
    console.error('Erro no login:', err);
    return NextResponse.json({ error: 'Erro ao realizar login. Tente novamente.' }, { status: 500 });
  }
}
