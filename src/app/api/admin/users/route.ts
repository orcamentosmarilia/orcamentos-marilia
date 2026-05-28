import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET /api/admin/users — lista todos os usuários
export async function GET() {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from('admin_users')
    .select('id, name, email, role, whatsapp, photo_url, profile_completed')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

// POST /api/admin/users
export async function POST(request: Request) {
  const body = await request.json();
  const { action } = body;
  const supabase = adminClient();

  if (action === 'create') {
    const { name, email, password, role, whatsapp } = body;
    if (!email || !password || !role) {
      return NextResponse.json({ error: 'E-mail, senha e cargo são obrigatórios.' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('admin_users')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Já existe um usuário com este e-mail.' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('admin_users')
      .insert({
        name: name?.trim() || '',
        email: email.trim().toLowerCase(),
        password: password.trim(),
        role,
        whatsapp: whatsapp?.trim() || '',
        profile_completed: !!name,
      })
      .select('id, name, email, role, whatsapp, photo_url, profile_completed, created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ user: data });
  }

  if (action === 'update_role') {
    const { userId, role } = body;
    const { error } = await supabase
      .from('admin_users')
      .update({ role })
      .eq('id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'rename_role') {
    const { oldRole, newRole } = body;
    if (!newRole?.trim()) return NextResponse.json({ error: 'Nome inválido.' }, { status: 400 });

    // Cria novo cargo copiando permissões do antigo
    const { data: oldData } = await supabase
      .from('role_settings').select('permissions').eq('role', oldRole).single();

    const { error: insertErr } = await supabase
      .from('role_settings')
      .insert({ role: newRole.trim(), permissions: oldData?.permissions ?? {} });
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    // Migra usuários para o novo nome
    await supabase.from('admin_users').update({ role: newRole.trim() }).eq('role', oldRole);

    // Remove cargo antigo
    await supabase.from('role_settings').delete().eq('role', oldRole);

    return NextResponse.json({ success: true });
  }

  if (action === 'delete_role') {
    const { role } = body;
    const { data: usersWithRole } = await supabase
      .from('admin_users').select('id').eq('role', role);
    if (usersWithRole && usersWithRole.length > 0)
      return NextResponse.json({ error: `Existem ${usersWithRole.length} usuário(s) com este cargo. Troque o cargo deles primeiro.` }, { status: 409 });
    const { error } = await supabase.from('role_settings').delete().eq('role', role);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete') {
    const { userId } = body;
    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
}
