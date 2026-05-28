"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { 
  Users,
  UserCog,
  ShieldCheck,
  Mail,
  Phone,
  Save,
  Loader2,
  Search,
  ChevronRight,
  Info,
  AlertCircle,
  Plus,
  Trash2,
  Eye
} from "lucide-react";
import PageHeader from "@/components/PageHeader";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  role: string;
  photo_url: string;
  profile_completed: boolean;
  created_at?: string;
}

interface RoleSetting {
  role: string;
  functions: string;
  permissions: Record<string, boolean>;
  isNew?: boolean;
}

const AVAILABLE_PERMISSIONS = [
  { id: "dashboard_view", label: "Ver Dashboard", icon: "dashboard" },
  { id: "pipeline_view", label: "Ver Kanban / Pipeline", icon: "view_kanban" },
  { id: "quotes_view_all", label: "Ver Todos os Orçamentos", icon: "list_alt" },
  { id: "quotes_create", label: "Criar Novos Orçamentos", icon: "add_circle" },
  { id: "quotes_delete", label: "Excluir Orçamentos", icon: "delete_forever" },
  { id: "quotes_restore", label: "Recuperar Orçamentos Apagados", icon: "settings_backup_restore" },
  { id: "catalog_manage", label: "Gerenciar Catálogo (Produtos)", icon: "restaurant_menu" },
  { id: "logs_view", label: "Ver Histórico / Logs", icon: "history" },
  { id: "users_manage", label: "Gerenciar Equipe / Usuários", icon: "group" },
  { id: "logistics_view", label: "Acessar Logística", icon: "local_shipping" },
];

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roleSettings, setRoleSettings] = useState<RoleSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [activeRoleTab, setActiveRoleTab] = useState<string>("");
  const [isEditingRoleName, setIsEditingRoleName] = useState(false);
  const [tempRoleName, setTempRoleName] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", password: "", role: "", whatsapp: "" });
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/admin/users').then(r => r.json()),
        supabase.from("role_settings").select("*")
      ]);

      setUsers(usersRes.users || []);
      const roles = rolesRes.data || [];
      setRoleSettings(roles);
      if (roles.length > 0 && !activeRoleTab) {
        setActiveRoleTab(roles[0].role);
        setTempRoleName(roles[0].role);
      }
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateUser = async () => {
    setCreateError("");
    if (!createForm.email || !createForm.password || !createForm.role) {
      setCreateError("E-mail, senha e cargo são obrigatórios.");
      return;
    }
    try {
      setSaving("create");
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...createForm }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || "Erro ao criar usuário."); return; }
      setUsers(prev => [...prev, data.user].sort((a, b) => a.name?.localeCompare(b.name)));
      setShowCreateModal(false);
      setCreateForm({ name: "", email: "", password: "", role: "", whatsapp: "" });
    } catch (err: any) {
      setCreateError("Erro ao criar usuário.");
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja remover "${userName}" do sistema? Esta ação não pode ser desfeita.`)) return;
    try {
      setSaving("delete-" + userId);
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setUsers(prev => prev.filter(u => u.id !== userId));
      if (selectedUser?.id === userId) setSelectedUser(null);
    } catch (err: any) {
      alert("Erro ao remover usuário: " + err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      setSaving(userId);
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_role', userId, role: newRole }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      if (selectedUser?.id === userId) setSelectedUser({ ...selectedUser, role: newRole });
    } catch (err: any) {
      alert("Erro ao atualizar cargo: " + err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateRolePermissions = async (role: string, permissions: Record<string, boolean>) => {
    try {
      setSaving(role);
      const { error } = await supabase
        .from("role_settings")
        .update({ permissions, updated_at: new Date().toISOString() })
        .eq("role", role);

      if (error) throw error;
      
      setRoleSettings(prev => prev.map(r => r.role === role ? { ...r, permissions } : r));
    } catch (err: any) {
      alert("Erro ao atualizar permissões: " + err.message);
    } finally {
      setSaving(null);
    }
  };

  const togglePermission = (role: string, permissionId: string) => {
    const roleSetting = roleSettings.find(r => r.role === role);
    if (!roleSetting) return;

    const newPermissions = {
      ...(roleSetting.permissions || {}),
      [permissionId]: !roleSetting.permissions?.[permissionId]
    };

    handleUpdateRolePermissions(role, newPermissions);
  };

  const handleRenameRole = async (oldRole: string, newRole: string) => {
    if (!newRole || oldRole === newRole) {
      setIsEditingRoleName(false);
      return;
    }

    try {
      setSaving("rename-" + oldRole);
      
      // 1. Create new role setting with same functions
      const currentRole = roleSettings.find(r => r.role === oldRole);
      const { error: insertError } = await supabase
        .from("role_settings")
        .insert({ role: newRole, functions: currentRole?.functions });

      if (insertError) throw insertError;

      // 2. Update all users with this role
      const { error: userError } = await supabase
        .from("admin_users")
        .update({ role: newRole })
        .eq("role", oldRole);

      if (userError) throw userError;

      // 3. Delete old role setting
      const { error: deleteError } = await supabase
        .from("role_settings")
        .delete()
        .eq("role", oldRole);

      if (deleteError) throw deleteError;

      setRoleSettings(prev => prev.map(r => r.role === oldRole ? { ...r, role: newRole } : r));
      setUsers(prev => prev.map(u => u.role === oldRole ? { ...u, role: newRole } : u));
      setActiveRoleTab(newRole);
      setIsEditingRoleName(false);
      alert(`Cargo renomeado de "${oldRole}" para "${newRole}" com sucesso!`);
    } catch (err: any) {
      alert("Erro ao renomear cargo: " + err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleAddRole = async () => {
    const roleName = prompt("Digite o nome do novo cargo:");
    if (!roleName) return;

    if (roleSettings.some(r => r.role.toLowerCase() === roleName.toLowerCase())) {
      alert("Este cargo já existe!");
      return;
    }

    try {
      setSaving("add-role");
      const { error } = await supabase
        .from("role_settings")
        .insert({ 
          role: roleName, 
          functions: "", 
          permissions: {} 
        });

      if (error) throw error;
      
      const newRole = { role: roleName, functions: "", permissions: {} };
      setRoleSettings(prev => [...prev, newRole]);
      setActiveRoleTab(roleName);
      setTempRoleName(roleName);
    } catch (err: any) {
      alert("Erro ao adicionar cargo: " + err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteRole = async (role: string) => {
    // Check if any user is using this role
    const usersWithRole = users.filter(u => u.role === role);
    if (usersWithRole.length > 0) {
      alert(`Não é possível deletar este cargo porque existem ${usersWithRole.length} usuários vinculados a ele. Troque o cargo dos usuários primeiro.`);
      return;
    }

    if (!confirm(`Tem certeza que deseja deletar o cargo "${role}"?`)) return;

    try {
      setSaving("delete-" + role);
      const { error } = await supabase
        .from("role_settings")
        .delete()
        .eq("role", role);

      if (error) throw error;
      
      const newRoles = roleSettings.filter(r => r.role !== role);
      setRoleSettings(newRoles);
      if (activeRoleTab === role && newRoles.length > 0) {
        setActiveRoleTab(newRoles[0].role);
      }
      alert(`Cargo "${role}" deletado com sucesso.`);
    } catch (err: any) {
      alert("Erro ao deletar cargo: " + err.message);
    } finally {
      setSaving(null);
    }
  };

  const handleSimulateAccess = (user: UserProfile) => {
    localStorage.setItem("marilia_impersonated_user", JSON.stringify(user));
    window.location.reload();
  };

  const currentRoleSetting = roleSettings.find(r => r.role === activeRoleTab);

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-12 text-center text-rose-300 font-dm text-xl">Carregando usuários...</div>;

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Equipe Marília"
        description="Gerencie permissões, cargos e funções de todos os colaboradores."
        actions={
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300" size={18} />
              <input type="text" placeholder="Buscar..." className="pl-11 pr-5 py-2.5 bg-white border border-brand-pink2 rounded-xl text-sm focus:outline-none focus:border-[#D14237] w-56 font-dm shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <button
              onClick={() => { setCreateForm({ name: "", email: "", password: "", role: roleSettings[0]?.role || "", whatsapp: "" }); setCreateError(""); setShowCreateModal(true); }}
              className="flex items-center gap-2 bg-[#5C1F2E] hover:bg-[#4A1925] text-white px-4 py-2.5 rounded-xl text-sm font-dm font-bold transition-all shadow-lg shadow-[#5C1F2E]/20"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Novo Usuário</span>
              <span className="sm:hidden">Novo</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LISTA DE USUÁRIOS */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-[32px] border border-brand-pink2 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-rose-50 bg-[#FDF6F2]/50 flex items-center justify-between">
              <h2 className="font-lora text-lg font-bold text-[#5C1F2E]">Colaboradores</h2>
              <span className="text-[10px] font-bold text-rose-300 uppercase tracking-widest">{filteredUsers.length} total</span>
            </div>
            
            <div className="divide-y divide-rose-50">
              {filteredUsers.map(user => (
                <div 
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`p-6 flex items-center justify-between hover:bg-rose-50/30 transition-all cursor-pointer group ${selectedUser?.id === user.id ? 'bg-rose-50/50' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm shrink-0">
                      {user.photo_url ? (
                        <img src={user.photo_url} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-lora font-bold text-rose-300 text-lg">{user.name?.charAt(0) || user.email.charAt(0)}</span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-dm font-bold text-[#5C1F2E] group-hover:text-[#D14237] transition-colors uppercase text-sm">
                        {user.name || "Sem nome preenchido"}
                      </h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[10px] text-rose-400 font-medium italic">
                          <Mail size={10} /> {user.email}
                        </span>
                        {user.whatsapp && (
                          <span className="flex items-center gap-1 text-[10px] text-rose-400 font-medium italic">
                            <Phone size={10} /> {user.whatsapp}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`hidden sm:inline px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                      user.role === 'Administrador' ? 'bg-red-50 text-red-600 border border-red-100' :
                      user.role === 'Gerente' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                      'bg-rose-50 text-rose-500 border border-rose-100'
                    }`}>
                      {user.role}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteUser(user.id, user.name || user.email); }}
                      disabled={saving === "delete-" + user.id}
                      className="p-1.5 text-rose-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Remover usuário"
                    >
                      {saving === "delete-" + user.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                    <ChevronRight className={`text-rose-200 transition-transform ${selectedUser?.id === user.id ? 'rotate-90 text-[#D14237]' : 'group-hover:translate-x-1'}`} size={18} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PAINEL DE EDIÇÃO / CARGOS */}
        <div className="space-y-8">
          {selectedUser ? (
            <section className="bg-white rounded-[32px] border border-[#D14237]/20 shadow-xl p-8 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-rose-50">
                <UserCog className="text-[#D14237]" size={24} />
                <h3 className="font-lora text-xl font-bold text-[#5C1F2E]">Editar Cargo</h3>
              </div>

              <div className="text-center mb-8">
                <div className="w-24 h-24 rounded-[32px] bg-rose-50 mx-auto mb-4 border-2 border-white shadow-lg overflow-hidden">
                  {selectedUser.photo_url ? <img src={selectedUser.photo_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-rose-200"><Users size={40}/></div>}
                </div>
                <h4 className="font-lora text-lg font-bold text-[#5C1F2E]">{selectedUser.name}</h4>
                <p className="text-xs text-rose-400 font-dm mb-4">{selectedUser.email}</p>
                
                <button
                  onClick={() => handleSimulateAccess(selectedUser)}
                  className="bg-rose-50 hover:bg-[#D14237] text-rose-400 hover:text-white px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 mx-auto"
                >
                  <Eye size={14} />
                  Simular Acesso
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[11px] font-bold text-rose-400 uppercase tracking-widest mb-3 block">Novo Cargo</label>
                  <div className="grid grid-cols-1 gap-2">
                    {roleSettings.map(role => (
                      <button
                        key={role.role}
                        onClick={() => handleUpdateUserRole(selectedUser.id, role.role)}
                        disabled={saving === selectedUser.id}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-sm font-dm ${
                          selectedUser.role === role.role 
                          ? 'bg-[#5C1F2E] text-white border-[#5C1F2E] shadow-lg' 
                          : 'bg-white text-[#5C1F2E] border-rose-100 hover:border-[#D14237]'
                        }`}
                      >
                        {role.role}
                        {selectedUser.role === role.role && <ShieldCheck size={16} />}
                        {saving === selectedUser.id && selectedUser.role !== role.role && <Loader2 size={16} className="animate-spin opacity-50" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <div className="bg-rose-50/50 rounded-[32px] border border-dashed border-rose-200 p-12 text-center">
              <UserCog className="text-rose-200 mx-auto mb-4" size={48} />
              <p className="font-dm text-rose-300 text-sm">Selecione um colaborador ao lado para editar o cargo.</p>
            </div>
          )}

          {/* DEFINIÇÃO DE FUNÇÕES DOS CARGOS */}
          <section className="bg-white rounded-[32px] border border-brand-pink2 shadow-sm p-8">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-rose-50">
              <Info className="text-[#D14237]" size={24} />
              <h3 className="font-lora text-xl font-bold text-[#5C1F2E]">Funções por Cargo</h3>
            </div>

            {/* Toggle Buttons (Tabs) */}
            <div className="flex flex-wrap gap-2 mb-8">
              {roleSettings.map(role => (
                <button
                  key={role.role}
                  onClick={() => {
                    setActiveRoleTab(role.role);
                    setTempRoleName(role.role);
                    setIsEditingRoleName(false);
                  }}
                  className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                    activeRoleTab === role.role
                    ? 'bg-[#5C1F2E] text-white shadow-md'
                    : 'bg-rose-50 text-rose-400 hover:bg-rose-100'
                  }`}
                >
                  {role.role}
                </button>
              ))}
              <button
                onClick={handleAddRole}
                className="px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest border border-dashed border-rose-200 text-rose-300 hover:border-[#D14237] hover:text-[#D14237] transition-all flex items-center gap-1"
              >
                <Plus size={12} />
                Novo Cargo
              </button>
            </div>

            {currentRoleSetting ? (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    {isEditingRoleName ? (
                      <div className="flex items-center gap-2">
                        <input 
                          type="text"
                          value={tempRoleName}
                          onChange={(e) => setTempRoleName(e.target.value)}
                          className="bg-[#FDF6F2] border border-[#D14237]/30 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[#5C1F2E] w-full"
                          autoFocus
                          onBlur={() => handleRenameRole(activeRoleTab, tempRoleName)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameRole(activeRoleTab, tempRoleName)}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditingRoleName(true)}>
                        <span className="text-[11px] font-bold text-[#5C1F2E] uppercase tracking-widest">{activeRoleTab}</span>
                        <UserCog size={12} className="text-rose-200 group-hover:text-[#D14237]" />
                      </div>
                    )}
                  </div>
                    {saving === activeRoleTab && <Loader2 size={10} className="animate-spin text-rose-300" />}
                    <div className="w-[1px] h-3 bg-rose-100 ml-auto"></div>
                    <button 
                      onClick={() => handleDeleteRole(activeRoleTab)}
                      disabled={saving === activeRoleTab}
                      className="text-[10px] font-bold text-rose-300 hover:text-red-600 flex items-center gap-1 shrink-0 transition-colors"
                      title="Deletar este cargo"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                
                <div className="grid grid-cols-1 gap-3">
                  {AVAILABLE_PERMISSIONS.map(perm => {
                    const isEnabled = currentRoleSetting.permissions?.[perm.id];
                    return (
                      <button
                        key={perm.id}
                        onClick={() => togglePermission(activeRoleTab, perm.id)}
                        disabled={saving === activeRoleTab}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                          isEnabled 
                          ? 'bg-rose-50 border-[#D14237]/20 text-[#5C1F2E]' 
                          : 'bg-white border-rose-50 text-rose-300 opacity-60 grayscale-[0.5]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`material-symbols-outlined text-lg ${isEnabled ? 'text-[#D14237]' : 'text-rose-200'}`}>
                            {perm.icon}
                          </span>
                          <span className="text-xs font-bold font-dm uppercase tracking-tight">{perm.label}</span>
                        </div>
                        
                        {/* Toggle Switch UI */}
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${isEnabled ? 'bg-[#D14237]' : 'bg-rose-100'}`}>
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isEnabled ? 'left-6' : 'left-1'}`}></div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                
                <p className="text-[10px] text-rose-300 italic flex items-center gap-2">
                  <AlertCircle size={12} />
                  Dica: As alterações nas permissões são salvas automaticamente.
                </p>
              </div>
            ) : (
              <div className="p-8 text-center text-rose-200 italic text-sm">Carregando funções...</div>
            )}
          </section>
        </div>

      </div>

      {/* ══ MODAL CRIAR USUÁRIO ══ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-[#5C1F2E]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-7 py-5 border-b border-rose-50">
              <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">Novo Usuário</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-rose-300 hover:text-[#D14237]">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
            <div className="p-7 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nome Completo</label>
                <input type="text" value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Ana Silva"
                  className="w-full border border-rose-100 rounded-xl px-4 py-2.5 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] placeholder:text-rose-200" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">E-mail <span className="text-red-400">*</span></label>
                <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="colaborador@email.com"
                  className="w-full border border-rose-100 rounded-xl px-4 py-2.5 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] placeholder:text-rose-200" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Senha Inicial <span className="text-red-400">*</span></label>
                <input type="text" value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Senha que o colaborador usará para entrar"
                  className="w-full border border-rose-100 rounded-xl px-4 py-2.5 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] placeholder:text-rose-200" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">WhatsApp</label>
                <input type="text" value={createForm.whatsapp} onChange={e => setCreateForm(f => ({ ...f, whatsapp: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  className="w-full border border-rose-100 rounded-xl px-4 py-2.5 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] placeholder:text-rose-200" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Cargo <span className="text-red-400">*</span></label>
                <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-rose-100 rounded-xl px-4 py-2.5 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] bg-white">
                  <option value="">Selecione um cargo...</option>
                  {roleSettings.map(r => <option key={r.role} value={r.role}>{r.role}</option>)}
                </select>
              </div>
              {createError && (
                <p className="text-red-500 text-xs font-dm flex items-center gap-1.5">
                  <AlertCircle size={12} /> {createError}
                </p>
              )}
              <button
                onClick={handleCreateUser}
                disabled={saving === "create"}
                className="w-full bg-[#5C1F2E] hover:bg-[#4A1925] disabled:opacity-50 text-white py-3 rounded-xl font-dm font-bold text-sm flex items-center justify-center gap-2 transition-all mt-2"
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
