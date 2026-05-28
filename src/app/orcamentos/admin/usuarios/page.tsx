"use client";

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Users, UserCog, ShieldCheck, Mail, Phone, Save,
  Loader2, Search, ChevronRight, Info, AlertCircle,
  Plus, Trash2, Eye, X, Camera
} from "lucide-react";
import PageHeader from "@/components/PageHeader";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  role: string;
  photo_url: string;
  profile_completed: boolean;
}

interface RoleSetting {
  role: string;
  functions?: string;
  permissions: Record<string, boolean>;
}

const PERMISSIONS = [
  { id: "dashboard_view",   label: "Ver Dashboard",              icon: "dashboard" },
  { id: "pipeline_view",    label: "Ver Kanban / Pipeline",      icon: "view_kanban" },
  { id: "quotes_view_all",  label: "Ver Todos os Orçamentos",    icon: "list_alt" },
  { id: "quotes_create",    label: "Criar Novos Orçamentos",     icon: "add_circle" },
  { id: "quotes_delete",    label: "Excluir Orçamentos",         icon: "delete_forever" },
  { id: "clients_manage",   label: "Gerenciar Clientes",         icon: "contacts" },
  { id: "catalog_manage",   label: "Gerenciar Catálogo",         icon: "restaurant_menu" },
  { id: "logistics_view",   label: "Acessar Logística",          icon: "local_shipping" },
  { id: "loss_reasons",     label: "Motivos de Perda",           icon: "sentiment_dissatisfied" },
  { id: "agent_use",        label: "Usar Agente IA",             icon: "smart_toy" },
  { id: "logs_view",        label: "Ver Histórico / Logs",       icon: "history" },
  { id: "reviews_view",     label: "Ver Revisões IA",            icon: "rate_review" },
  { id: "users_manage",     label: "Gerenciar Equipe",           icon: "group" },
  { id: "settings_manage",  label: "Acessar Configurações",      icon: "settings" },
];

const EMPTY_FORM = { name: "", email: "", password: "", role: "", whatsapp: "", photo_url: "" };

export default function UsuariosPage() {
  const [users, setUsers]               = useState<AdminUser[]>([]);
  const [roles, setRoles]               = useState<RoleSetting[]>([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState<string | null>(null);
  const [search, setSearch]             = useState("");
  const [selected, setSelected]         = useState<AdminUser | null>(null);
  const [activeRole, setActiveRole]     = useState("");
  const [showCreate, setShowCreate]     = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [formError, setFormError]       = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef                   = useRef<HTMLInputElement>(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [uRes, rRes] = await Promise.all([
        fetch("/api/admin/users").then(r => r.json()),
        supabase.from("role_settings").select("*"),
      ]);
      setUsers(uRes.users ?? []);
      const r = rRes.data ?? [];
      setRoles(r);
      if (r.length > 0) setActiveRole(r[0].role);
    } catch (e) {
      console.error("loadAll error:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/new-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("profile-images").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("profile-images").getPublicUrl(path);
      setForm(f => ({ ...f, photo_url: publicUrl }));
    } catch (err: any) {
      setFormError("Erro ao enviar foto: " + err.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function createUser() {
    setFormError("");
    if (!form.email || !form.password || !form.role) {
      setFormError("E-mail, senha e cargo são obrigatórios.");
      return;
    }
    setSaving("create");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...form }),
    });
    const data = await res.json();
    setSaving(null);
    if (!res.ok) { setFormError(data.error ?? "Erro ao criar."); return; }
    setUsers(prev => [...prev, data.user].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")));
    setShowCreate(false);
    setForm(EMPTY_FORM);
  }

  async function deleteUser(u: AdminUser) {
    if (!confirm(`Remover "${u.name || u.email}"? Esta ação não pode ser desfeita.`)) return;
    setSaving("del-" + u.id);
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", userId: u.id }),
    });
    setSaving(null);
    setUsers(prev => prev.filter(x => x.id !== u.id));
    if (selected?.id === u.id) setSelected(null);
  }

  async function changeRole(userId: string, role: string) {
    setSaving(userId);
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_role", userId, role }),
    });
    setSaving(null);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    if (selected?.id === userId) setSelected(s => s ? { ...s, role } : s);
  }

  async function togglePerm(roleName: string, permId: string) {
    const r = roles.find(x => x.role === roleName);
    if (!r) return;
    const newPerms = { ...(r.permissions ?? {}), [permId]: !r.permissions?.[permId] };
    setSaving("perm-" + roleName);
    await supabase.from("role_settings").update({ permissions: newPerms }).eq("role", roleName);
    setSaving(null);
    setRoles(prev => prev.map(x => x.role === roleName ? { ...x, permissions: newPerms } : x));
  }

  const currentRole = roles.find(r => r.role === activeRole);
  const filtered = users.filter(u =>
    (u.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="animate-spin text-[#D14237]" size={36} />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Equipe Marília"
        description="Gerencie permissões, cargos e colaboradores."
        actions={
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-300" size={16} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-9 pr-4 py-2 bg-white border border-rose-100 rounded-xl text-sm font-dm focus:outline-none focus:border-[#D14237] w-48"
              />
            </div>
            <button
              onClick={() => { setForm({ ...EMPTY_FORM, role: roles[0]?.role ?? "" }); setFormError(""); setShowCreate(true); }}
              className="flex items-center gap-2 bg-[#5C1F2E] hover:bg-[#4A1925] text-white px-4 py-2.5 rounded-xl text-sm font-dm font-bold transition-all"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Novo Usuário</span>
              <span className="sm:hidden">Novo</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Lista de usuários ── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-rose-50 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-rose-50 flex items-center justify-between">
              <h2 className="font-lora text-lg font-bold text-[#5C1F2E]">Colaboradores</h2>
              <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">{filtered.length} total</span>
            </div>
            <div className="divide-y divide-rose-50">
              {filtered.length === 0 && (
                <div className="p-10 text-center text-rose-300 font-dm text-sm">Nenhum colaborador encontrado.</div>
              )}
              {filtered.map(u => (
                <div
                  key={u.id}
                  onClick={() => setSelected(u)}
                  className={`px-6 py-4 flex items-center justify-between hover:bg-rose-50/30 cursor-pointer group transition-all ${selected?.id === u.id ? "bg-rose-50/50" : ""}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-rose-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                      {u.photo_url
                        ? <img src={u.photo_url} className="w-full h-full object-cover" alt={u.name} />
                        : <span className="font-lora font-bold text-rose-300">{(u.name || u.email).charAt(0).toUpperCase()}</span>}
                    </div>
                    <div>
                      <p className="font-dm font-bold text-[#5C1F2E] text-sm">{u.name || "Sem nome"}</p>
                      <p className="text-[11px] text-rose-400 mt-0.5">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden sm:inline px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-500 border border-rose-100">
                      {u.role}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteUser(u); }}
                      disabled={saving === "del-" + u.id}
                      className="p-1.5 rounded-lg text-rose-200 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    >
                      {saving === "del-" + u.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                    <ChevronRight size={16} className={`text-rose-200 transition-transform ${selected?.id === u.id ? "rotate-90 text-[#D14237]" : "group-hover:translate-x-0.5"}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Painel direito ── */}
        <div className="space-y-6">
          {/* Editar cargo */}
          {selected ? (
            <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-rose-50">
                <UserCog className="text-[#D14237]" size={20} />
                <h3 className="font-lora font-bold text-[#5C1F2E]">Editar Cargo</h3>
              </div>
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-rose-50 mx-auto mb-3 flex items-center justify-center overflow-hidden">
                  {selected.photo_url
                    ? <img src={selected.photo_url} className="w-full h-full object-cover" alt={selected.name} />
                    : <Users size={28} className="text-rose-200" />}
                </div>
                <p className="font-lora font-bold text-[#5C1F2E]">{selected.name || "Sem nome"}</p>
                <p className="text-xs text-rose-400">{selected.email}</p>
              </div>
              <div className="space-y-2">
                {roles.map(r => (
                  <button
                    key={r.role}
                    onClick={() => changeRole(selected.id, r.role)}
                    disabled={saving === selected.id}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-sm font-dm transition-all ${
                      selected.role === r.role
                        ? "bg-[#5C1F2E] text-white border-[#5C1F2E]"
                        : "bg-white text-[#5C1F2E] border-rose-100 hover:border-[#D14237]"
                    }`}
                  >
                    {r.role}
                    {selected.role === r.role && <ShieldCheck size={14} />}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-rose-50/50 rounded-3xl border border-dashed border-rose-200 p-10 text-center">
              <UserCog size={40} className="text-rose-200 mx-auto mb-3" />
              <p className="text-rose-300 text-sm font-dm">Selecione um colaborador para editar o cargo.</p>
            </div>
          )}

          {/* Permissões por cargo */}
          <div className="bg-white rounded-3xl border border-rose-50 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5 pb-4 border-b border-rose-50">
              <Info className="text-[#D14237]" size={20} />
              <h3 className="font-lora font-bold text-[#5C1F2E]">Permissões por Cargo</h3>
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              {roles.map(r => (
                <button
                  key={r.role}
                  onClick={() => setActiveRole(r.role)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all ${
                    activeRole === r.role ? "bg-[#5C1F2E] text-white" : "bg-rose-50 text-rose-400 hover:bg-rose-100"
                  }`}
                >
                  {r.role}
                </button>
              ))}
            </div>
            {currentRole && (
              <div className="space-y-2">
                {PERMISSIONS.map(p => {
                  const on = !!currentRole.permissions?.[p.id];
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePerm(activeRole, p.id)}
                      disabled={saving === "perm-" + activeRole}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${on ? "bg-rose-50 border-[#D14237]/20" : "bg-white border-rose-50 opacity-60"}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`material-symbols-outlined text-base ${on ? "text-[#D14237]" : "text-rose-200"}`}>{p.icon}</span>
                        <span className="text-[11px] font-bold font-dm uppercase tracking-tight text-[#5C1F2E]">{p.label}</span>
                      </div>
                      <div className={`w-9 h-5 rounded-full relative transition-colors ${on ? "bg-[#D14237]" : "bg-rose-100"}`}>
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${on ? "left-5" : "left-1"}`} />
                      </div>
                    </button>
                  );
                })}
                <p className="text-[10px] text-rose-300 italic flex items-center gap-1 pt-1">
                  <AlertCircle size={10} /> Alterações salvas automaticamente.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal criar usuário ── */}
      {showCreate && (
        <div className="fixed inset-0 bg-[#5C1F2E]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-7 py-5 border-b border-rose-50">
              <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">Novo Usuário</h2>
              <button onClick={() => setShowCreate(false)}><X size={18} className="text-rose-300 hover:text-[#D14237]" /></button>
            </div>
            <div className="p-7 space-y-4">
              {/* Foto opcional */}
              <div className="flex flex-col items-center gap-2 pb-2">
                <div
                  onClick={() => photoInputRef.current?.click()}
                  className="w-20 h-20 rounded-full border-2 border-dashed border-rose-200 hover:border-[#5C1F2E] flex items-center justify-center cursor-pointer transition-all overflow-hidden relative group"
                >
                  {uploadingPhoto ? (
                    <Loader2 size={22} className="animate-spin text-rose-300" />
                  ) : form.photo_url ? (
                    <>
                      <img src={form.photo_url} className="w-full h-full object-cover" alt="foto" />
                      <div className="absolute inset-0 bg-[#5C1F2E]/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera size={18} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-rose-300">
                      <Camera size={22} />
                      <span className="text-[9px] font-dm text-center leading-tight">Adicionar<br/>foto</span>
                    </div>
                  )}
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                <p className="text-[10px] text-rose-300 font-dm">Foto de perfil (opcional)</p>
              </div>

              {[
                { key: "name",     label: "Nome Completo",  type: "text",     placeholder: "Ex: Ana Silva",              required: false },
                { key: "email",    label: "E-mail",         type: "email",    placeholder: "colaborador@email.com",       required: true  },
                { key: "password", label: "Senha Inicial",  type: "text",     placeholder: "Senha de primeiro acesso",    required: true  },
                { key: "whatsapp", label: "WhatsApp",       type: "text",     placeholder: "(00) 00000-0000",             required: false },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    {f.label} {f.required && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type={f.type}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full border border-rose-100 rounded-xl px-4 py-2.5 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] placeholder:text-rose-200"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Cargo <span className="text-red-400">*</span>
                </label>
                <select
                  value={form.role}
                  onChange={e => setForm(x => ({ ...x, role: e.target.value }))}
                  className="w-full border border-rose-100 rounded-xl px-4 py-2.5 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] bg-white"
                >
                  <option value="">Selecione um cargo...</option>
                  {roles.map(r => <option key={r.role} value={r.role}>{r.role}</option>)}
                </select>
              </div>
              {formError && (
                <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={12} />{formError}</p>
              )}
              <button
                onClick={createUser}
                disabled={saving === "create"}
                className="w-full bg-[#5C1F2E] hover:bg-[#4A1925] disabled:opacity-50 text-white py-3 rounded-xl font-dm font-bold text-sm flex items-center justify-center gap-2 transition-all"
              >
                {saving === "create" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Criar Usuário
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
