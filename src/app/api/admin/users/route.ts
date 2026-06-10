import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isAdminRole } from '@/lib/permissions';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET /api/admin/users — lista todos os usuários e cargos (service role, ignora RLS)
export async function GET() {
  const supabase = adminClient();
  const [usersRes, rolesRes] = await Promise.all([
    supabase
      .from('admin_users')
      .select('id, name, email, role, whatsapp, photo_url, profile_completed')
      .order('name'),
    supabase
      .from('role_settings')
      .select('role, permissions')
      .order('role'),
  ]);

  if (usersRes.error) return NextResponse.json({ error: usersRes.error.message }, { status: 500 });
  if (rolesRes.error) return NextResponse.json({ error: rolesRes.error.message }, { status: 500 });
  return NextResponse.json({ users: usersRes.data, roles: rolesRes.data });
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

  if (action === 'create_role') {
    const { name, permissions } = body;
    const trimmed = (name ?? '').trim();
    if (!trimmed) return NextResponse.json({ error: 'Nome do cargo é obrigatório.' }, { status: 400 });

    // Bloqueia nome duplicado ignorando maiúsculas/minúsculas (evita "admin" vs "Admin")
    const { data: existingRoles } = await supabase.from('role_settings').select('role');
    const dup = (existingRoles ?? []).find(r => r.role.toLowerCase() === trimmed.toLowerCase());
    if (dup) return NextResponse.json({ error: `Já existe um cargo chamado "${dup.role}".` }, { status: 409 });

    const { data, error } = await supabase
      .from('role_settings')
      .insert({ role: trimmed, permissions: permissions ?? {} })
      .select('role, permissions')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ role: data });
  }

  if (action === 'update_permissions') {
    const { role, permissions } = body;
    if (!role) return NextResponse.json({ error: 'Cargo obrigatório.' }, { status: 400 });
    // O cargo admin tem acesso total permanente — nunca pode ser alterado.
    if (isAdminRole(role, permissions)) {
      return NextResponse.json(
        { error: 'O cargo "admin" tem acesso total permanente e não pode ser editado.' },
        { status: 403 },
      );
    }
    const { error } = await supabase
      .from('role_settings')
      .update({ permissions: permissions ?? {} })
      .eq('role', role);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'rename_role') {
    const { oldRole, newRole } = body;
    if (!newRole?.trim()) return NextResponse.json({ error: 'Nome inválido.' }, { status: 400 });
    // O cargo admin não pode ser renomeado (perderia a proteção de acesso total).
    if (isAdminRole(oldRole)) {
      return NextResponse.json({ error: 'O cargo "admin" não pode ser renomeado.' }, { status: 403 });
    }

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
    // O cargo admin não pode ser deletado.
    if (isAdminRole(role)) {
      return NextResponse.json({ error: 'O cargo "admin" não pode ser deletado.' }, { status: 403 });
    }
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
