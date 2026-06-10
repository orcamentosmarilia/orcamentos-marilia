import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { effectivePermissions } from '@/lib/permissions';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET /api/user/profile?email=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'Email obrigatório.' }, { status: 400 });

  const supabase = adminClient();
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, email, name, role, whatsapp, photo_url, profile_completed')
    .eq('email', email)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

  // Busca permissões do cargo via service_role (bypassa RLS)
  const { data: roleData } = await supabase
    .from('role_settings')
    .select('permissions')
    .eq('role', data.role)
    .single();

  // Admin sempre recebe acesso total, independentemente do que está salvo.
  return NextResponse.json({
    user: data,
    permissions: effectivePermissions(data.role, roleData?.permissions),
  });
}

// POST /api/user/profile — atualiza perfil, email ou senha
export async function POST(request: Request) {
  const body = await request.json();
  const { action, userId, email, updates, currentPassword, newPassword, newEmail } = body;
  const supabase = adminClient();

  // Verificar senha atual
  if (action === 'verify_password') {
    const { data } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', userId)
      .eq('password', currentPassword)
      .single();
    return NextResponse.json({ valid: !!data });
  }

  // Atualizar perfil (nome, whatsapp, photo_url, profile_completed)
  if (action === 'update_profile') {
    const { error } = await supabase.from('admin_users').update(updates).eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Atualizar e-mail
  if (action === 'update_email') {
    // Verificar senha atual primeiro
    const { data: check } = await supabase
      .from('admin_users').select('id').eq('id', userId).eq('password', currentPassword).single();
    if (!check) return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 401 });
    const { error } = await supabase.from('admin_users').update({ email: newEmail }).eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Atualizar senha
  if (action === 'update_password') {
    const { data: check } = await supabase
      .from('admin_users').select('id').eq('id', userId).eq('password', currentPassword).single();
    if (!check) return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 401 });
    const { error } = await supabase.from('admin_users').update({ password: newPassword }).eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
}
