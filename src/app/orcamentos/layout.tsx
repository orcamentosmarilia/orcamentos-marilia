"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Camera, Save, Loader2, Eye, EyeOff, X, ImagePlus, KeyRound, Mail, Menu } from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  role: string;
  photo_url: string;
  profile_completed: boolean;
  permissions?: Record<string, boolean>;
}

type ProfileTab = "foto" | "email" | "senha";

export default function OrcamentosLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<UserProfile | null>(null);

  /* ── Profile modal ── */
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileTab, setProfileTab] = useState<ProfileTab>("foto");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const profileFileRef = useRef<HTMLInputElement>(null);

  const currentUser = impersonatedUser || user;

  const stopImpersonating = () => {
    localStorage.removeItem("marilia_impersonated_user");
    setImpersonatedUser(null);
    window.location.reload();
  };

  useEffect(() => {
    const sessionStr = localStorage.getItem("marilia_admin_session");
    if (!sessionStr && !pathname.includes("/login")) {
      router.push("/login");
      return;
    }
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      fetchUserProfile(session.email);
    }
    setMobileMenuOpen(false);
    const impStr = localStorage.getItem("marilia_impersonated_user");
    if (impStr) setImpersonatedUser(JSON.parse(impStr));
  }, [pathname, router]);

  async function fetchUserProfile(email: string) {
    try {
      // Usa rota server-side para não expor admin_users via anon key
      const res = await fetch(`/api/user/profile?email=${encodeURIComponent(email)}`);
      if (!res.ok) throw new Error('Usuário não encontrado');
      const { user: realUser, permissions: realPermissions } = await res.json();

      const impStr = localStorage.getItem("marilia_impersonated_user");
      let activeUser = realUser;
      let impUserObj = null;
      if (impStr) {
        impUserObj = JSON.parse(impStr);
        activeUser = impUserObj;
        setImpersonatedUser(impUserObj);
      }

      // Permissões já vêm da API (service_role, sem problema de RLS)
      let activePermissions = realPermissions || {};
      if (impUserObj) {
        // Se impersonando, busca permissões do cargo impersonado
        const impRes = await fetch(`/api/user/profile?email=${encodeURIComponent(impUserObj.email)}`);
        if (impRes.ok) {
          const { permissions: impPerms } = await impRes.json();
          activePermissions = impPerms || {};
        }
      }

      setUser({ ...realUser, permissions: realUser.role === activeUser.role ? activePermissions : realPermissions || {} });
      if (impUserObj) setImpersonatedUser({ ...impUserObj, permissions: activePermissions });

      const checkAccess = (path: string) => {
        if (path.includes("/admin/logs") && !activePermissions.logs_view) return false;
        if (path.includes("/admin/usuarios") && !activePermissions.users_manage) return false;
        if (path.includes("/logistica") && !activePermissions.logistics_view) return false;
        if (path.includes("/pipeline") && !activePermissions.pipeline_view) return false;
        if (path.includes("/motivos-perda") && !activePermissions.pipeline_view) return false;
        if (path.includes("/dashboard") && !activePermissions.dashboard_view) return false;
        if (path.includes("/catalogo") && !activePermissions.catalog_manage) return false;
        if ((path === "/orcamentos" || path === "/orcamentos/") && !activePermissions.quotes_view_all) return false;
        return true;
      };

      if (!checkAccess(pathname)) router.push("/orcamentos/dashboard");
      if (!realUser.profile_completed && !pathname.includes("/login")) setShowCompletionModal(true);
    } catch (err) {
      console.error("Erro ao buscar perfil:", err);
      localStorage.removeItem("marilia_admin_session");
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }

  /* ── Profile completion modal submit ── */
  const handleUpdateProfile = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const formData = new FormData(e.currentTarget);
    const updates = {
      name: formData.get("name") as string,
      whatsapp: formData.get("whatsapp") as string,
      profile_completed: true,
    };
    try {
      setLoading(true);
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_profile', userId: user.id, updates }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setUser({ ...user, ...updates });
      setShowCompletionModal(false);
    } catch (err: any) {
      alert("Erro ao atualizar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Photo upload (completion modal) ── */
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const filePath = `avatars/${user.id}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from("profile-images").upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("profile-images").getPublicUrl(filePath);
      const updRes = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_profile', userId: user.id, updates: { photo_url: publicUrl } }),
      });
      if (!updRes.ok) throw new Error('Erro ao salvar foto');
      setUser({ ...user, photo_url: publicUrl });
    } catch (err: any) {
      alert("Erro no upload: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  /* ── Profile modal: verify current password ── */
  async function verifyPassword(password: string): Promise<boolean> {
    if (!user) return false;
    const res = await fetch('/api/user/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify_password', userId: user.id, currentPassword: password }),
    });
    const data = await res.json();
    return !!data.valid;
  }

  /* ── Profile modal: change photo ── */
  async function handleProfilePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setProfileSaving(true);
    setProfileError("");
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `avatars/${user.id}-${Date.now()}.${fileExt}`;
      const { error: upErr } = await supabase.storage.from("profile-images").upload(filePath, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("profile-images").getPublicUrl(filePath);
      const updRes = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_profile', userId: user.id, updates: { photo_url: publicUrl } }),
      });
      if (!updRes.ok) throw new Error('Erro ao atualizar foto');
      setUser({ ...user, photo_url: publicUrl });
    } catch (err: any) {
      setProfileError("Erro ao enviar foto: " + err.message);
    } finally {
      setProfileSaving(false);
    }
  }

  /* ── Profile modal: change email ── */
  async function handleEmailChange() {
    if (!newEmail.trim() || !currentPassword) { setProfileError("Preencha todos os campos."); return; }
    setProfileSaving(true); setProfileError("");
    try {
      const ok = await verifyPassword(currentPassword);
      if (!ok) { setProfileError("Senha atual incorreta."); return; }
      const res2 = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_email', userId: user!.id, currentPassword, newEmail: newEmail.trim() }),
      });
      if (!res2.ok) throw new Error((await res2.json()).error);
      const session = JSON.parse(localStorage.getItem("marilia_admin_session") || "{}");
      localStorage.setItem("marilia_admin_session", JSON.stringify({ ...session, email: newEmail.trim() }));
      setUser({ ...user!, email: newEmail.trim() });
      setNewEmail(""); setCurrentPassword("");
      setProfileError(""); alert("E-mail atualizado com sucesso!");
    } catch (err: any) {
      setProfileError("Erro: " + err.message);
    } finally {
      setProfileSaving(false);
    }
  }

  /* ── Profile modal: change password ── */
  async function handlePasswordChange() {
    if (!currentPassword || !newPassword || !confirmPassword) { setProfileError("Preencha todos os campos."); return; }
    if (newPassword !== confirmPassword) { setProfileError("As senhas não coincidem."); return; }
    if (newPassword.length < 6) { setProfileError("A nova senha deve ter ao menos 6 caracteres."); return; }
    setProfileSaving(true); setProfileError("");
    try {
      const ok = await verifyPassword(currentPassword);
      if (!ok) { setProfileError("Senha atual incorreta."); return; }
      const res2 = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_password', userId: user!.id, currentPassword, newPassword }),
      });
      if (!res2.ok) throw new Error((await res2.json()).error);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      alert("Senha atualizada com sucesso!");
    } catch (err: any) {
      setProfileError("Erro: " + err.message);
    } finally {
      setProfileSaving(false);
    }
  }

  function openProfileModal(tab: ProfileTab = "foto") {
    setProfileTab(tab);
    setProfileError("");
    setCurrentPassword(""); setNewEmail(""); setNewPassword(""); setConfirmPassword("");
    setShowProfileModal(true);
  }

  /* ─────────────────── RENDER ─────────────────────────────────── */
  return (
    <div className="bg-[#FDF6F2] min-h-screen text-[#6B5C5A] font-sans flex">

      {/* ══ PROFILE MODAL ══ */}
      {showProfileModal && user && (
        <div className="fixed inset-0 bg-[#5C1F2E]/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-rose-50">
              <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">Meu Perfil</h2>
              <button onClick={() => setShowProfileModal(false)} className="text-rose-300 hover:text-[#D14237]"><X size={18} /></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-rose-50 px-2">
              {([
                { id: "foto",  icon: <ImagePlus size={14} />, label: "Foto" },
                { id: "email", icon: <Mail size={14} />,      label: "E-mail" },
                { id: "senha", icon: <KeyRound size={14} />,  label: "Senha" },
              ] as { id: ProfileTab; icon: React.ReactNode; label: string }[]).map(t => (
                <button key={t.id} onClick={() => { setProfileTab(t.id); setProfileError(""); }}
                  className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-dm font-bold border-b-2 transition-all ${
                    profileTab === t.id
                      ? "border-[#5C1F2E] text-[#5C1F2E]"
                      : "border-transparent text-rose-300 hover:text-rose-500"
                  }`}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            <div className="p-7 space-y-5">
              {/* ── Foto ── */}
              {profileTab === "foto" && (
                <div className="flex flex-col items-center gap-5">
                  <div
                    onClick={() => profileFileRef.current?.click()}
                    className="w-28 h-28 rounded-full border-2 border-dashed border-rose-200 flex items-center justify-center cursor-pointer hover:border-[#5C1F2E] transition-all overflow-hidden relative group"
                  >
                    {user.photo_url ? (
                      <>
                        <img src={user.photo_url} alt="avatar" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-[#5C1F2E]/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Camera size={22} className="text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-rose-300">
                        <Camera size={28} />
                        <span className="text-[10px] font-dm text-center">Clique para<br/>adicionar</span>
                      </div>
                    )}
                    {profileSaving && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <Loader2 className="animate-spin text-[#5C1F2E]" size={24} />
                      </div>
                    )}
                  </div>
                  <input ref={profileFileRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePhotoUpload} />
                  <div className="text-center">
                    <p className="font-lora font-bold text-[#5C1F2E] text-lg">{user.name}</p>
                    <p className="text-xs font-dm text-rose-400 mt-0.5 uppercase tracking-wider">{user.role}</p>
                    <p className="text-xs font-dm text-rose-300 mt-0.5">{user.email}</p>
                  </div>
                  <button onClick={() => profileFileRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#5C1F2E] hover:bg-[#4A1925] text-white rounded-xl text-sm font-dm font-bold transition-all">
                    <Camera size={15} /> {user.photo_url ? "Trocar foto" : "Adicionar foto"}
                  </button>
                </div>
              )}

              {/* ── E-mail ── */}
              {profileTab === "email" && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">E-mail atual</p>
                    <p className="text-sm font-dm text-[#5C1F2E] font-bold">{user.email}</p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Novo e-mail</label>
                    <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                      placeholder="novo@email.com"
                      className="w-full border border-rose-100 rounded-xl px-4 py-2.5 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] placeholder:text-rose-200" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Confirme sua senha atual</label>
                    <div className="relative">
                      <input type={showCurrentPw ? "text" : "password"} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Senha atual..."
                        className="w-full border border-rose-100 rounded-xl px-4 py-2.5 pr-10 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] placeholder:text-rose-200" />
                      <button type="button" onClick={() => setShowCurrentPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-300 hover:text-rose-500">
                        {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  {profileError && <p className="text-red-500 text-xs font-dm">{profileError}</p>}
                  <button onClick={handleEmailChange} disabled={profileSaving}
                    className="w-full bg-[#5C1F2E] hover:bg-[#4A1925] disabled:opacity-50 text-white py-3 rounded-xl font-dm font-bold text-sm flex items-center justify-center gap-2 transition-all">
                    {profileSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    Atualizar e-mail
                  </button>
                </div>
              )}

              {/* ── Senha ── */}
              {profileTab === "senha" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Senha atual</label>
                    <div className="relative">
                      <input type={showCurrentPw ? "text" : "password"} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                        placeholder="Sua senha atual..."
                        className="w-full border border-rose-100 rounded-xl px-4 py-2.5 pr-10 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] placeholder:text-rose-200" />
                      <button type="button" onClick={() => setShowCurrentPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-300 hover:text-rose-500">
                        {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nova senha</label>
                    <div className="relative">
                      <input type={showNewPw ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres..."
                        className="w-full border border-rose-100 rounded-xl px-4 py-2.5 pr-10 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] placeholder:text-rose-200" />
                      <button type="button" onClick={() => setShowNewPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-300 hover:text-rose-500">
                        {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Confirmar nova senha</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha..."
                      className="w-full border border-rose-100 rounded-xl px-4 py-2.5 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] placeholder:text-rose-200" />
                  </div>
                  {profileError && <p className="text-red-500 text-xs font-dm">{profileError}</p>}
                  <button onClick={handlePasswordChange} disabled={profileSaving}
                    className="w-full bg-[#5C1F2E] hover:bg-[#4A1925] disabled:opacity-50 text-white py-3 rounded-xl font-dm font-bold text-sm flex items-center justify-center gap-2 transition-all">
                    {profileSaving ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
                    Atualizar senha
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MOBILE HEADER ══ */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-[#5C1F2E] flex items-center justify-between px-4 shadow-lg">
        <button onClick={() => setMobileMenuOpen(true)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <Menu size={22} className="text-white" />
        </button>
        <img src="/logo.png" alt="Marília de Dirceu" className="h-8 w-auto object-contain" />
        <button onClick={() => openProfileModal("foto")} className="p-1">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-rose-900/40 flex items-center justify-center border border-white/20">
            {currentUser?.photo_url
              ? <img src={currentUser.photo_url} alt="avatar" className="w-full h-full object-cover" />
              : <span className="material-symbols-outlined text-rose-300 text-[18px]">person</span>}
          </div>
        </button>
      </div>

      {/* ══ MOBILE OVERLAY ══ */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* ══ SIDEBAR ══ */}
      <aside className={`fixed left-0 top-0 h-screen w-[220px] z-50 bg-[#5C1F2E] flex flex-col py-8 px-0 shadow-2xl transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="px-6 mb-10 flex items-center justify-between">
          <img src="/logo.png" alt="Marília de Dirceu" className="h-14 w-auto object-contain" />
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X size={18} className="text-rose-300" />
          </button>
        </div>

        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {currentUser?.permissions?.dashboard_view && (
            <Link href="/orcamentos/dashboard" className={`flex items-center gap-3 px-6 py-3 transition-all duration-200 ${pathname.includes("dashboard") ? "bg-[#D14237]/15 border-l-4 border-[#D14237] text-white font-medium" : "border-l-4 border-transparent text-rose-200/60 hover:text-white hover:bg-white/5"}`}>
              <span className="material-symbols-outlined text-xl">dashboard</span>
              <span className="text-[13px] tracking-wide">Dashboard</span>
            </Link>
          )}
          {currentUser?.permissions?.pipeline_view && (
            <Link href="/orcamentos/pipeline" className={`flex items-center gap-3 px-6 py-3 transition-all duration-200 ${pathname.includes("pipeline") ? "bg-[#D14237]/15 border-l-4 border-[#D14237] text-white font-medium" : "border-l-4 border-transparent text-rose-200/60 hover:text-white hover:bg-white/5"}`}>
              <span className="material-symbols-outlined text-xl">view_kanban</span>
              <span className="text-[13px] tracking-wide">Kanban</span>
            </Link>
          )}
          {currentUser?.permissions?.quotes_view_all && (
            <Link href="/orcamentos" className={`flex items-center gap-3 px-6 py-3 transition-all duration-200 ${pathname === "/orcamentos" ? "bg-[#D14237]/15 border-l-4 border-[#D14237] text-white font-medium" : "border-l-4 border-transparent text-rose-200/60 hover:text-white hover:bg-white/5"}`}>
              <span className="material-symbols-outlined text-xl">list_alt</span>
              <span className="text-[13px] tracking-wide">Lista Geral</span>
            </Link>
          )}
          <Link href="/orcamentos/clientes" className={`flex items-center gap-3 px-6 py-3 transition-all duration-200 ${pathname.includes("clientes") ? "bg-[#D14237]/15 border-l-4 border-[#D14237] text-white font-medium" : "border-l-4 border-transparent text-rose-200/60 hover:text-white hover:bg-white/5"}`}>
            <span className="material-symbols-outlined text-xl">contacts</span>
            <span className="text-[13px] tracking-wide">Clientes</span>
          </Link>
          {currentUser?.permissions?.catalog_manage && (
            <Link href="/orcamentos/catalogo" className={`flex items-center gap-3 px-6 py-3 transition-all duration-200 ${pathname.includes("catalogo") ? "bg-[#D14237]/15 border-l-4 border-[#D14237] text-white font-medium" : "border-l-4 border-transparent text-rose-200/60 hover:text-white hover:bg-white/5"}`}>
              <span className="material-symbols-outlined text-xl">restaurant_menu</span>
              <span className="text-[13px] tracking-wide">Catálogo</span>
            </Link>
          )}
          {currentUser?.permissions?.logistics_view && (
            <Link href="/orcamentos/logistica" className={`flex items-center gap-3 px-6 py-3 transition-all duration-200 ${pathname.includes("logistica") ? "bg-[#D14237]/15 border-l-4 border-[#D14237] text-white font-medium" : "border-l-4 border-transparent text-rose-200/60 hover:text-white hover:bg-white/5"}`}>
              <span className="material-symbols-outlined text-xl">local_shipping</span>
              <span className="text-[13px] tracking-wide">Logística</span>
            </Link>
          )}
          {currentUser?.permissions?.pipeline_view && (
            <Link href="/orcamentos/admin/motivos-perda" className={`flex items-center gap-3 px-6 py-3 transition-all duration-200 ${pathname.includes("motivos-perda") ? "bg-[#D14237]/15 border-l-4 border-[#D14237] text-white font-medium" : "border-l-4 border-transparent text-rose-200/60 hover:text-white hover:bg-white/5"}`}>
              <span className="material-symbols-outlined text-xl">sentiment_dissatisfied</span>
              <span className="text-[13px] tracking-wide">Motivos de Perda</span>
            </Link>
          )}
          {currentUser?.permissions?.logs_view && (
            <Link href="/orcamentos/admin/logs" className={`flex items-center gap-3 px-6 py-3 transition-all duration-200 ${pathname.includes("/admin/logs") ? "bg-[#D14237]/15 border-l-4 border-[#D14237] text-white font-medium" : "border-l-4 border-transparent text-rose-200/60 hover:text-white hover:bg-white/5"}`}>
              <span className="material-symbols-outlined text-xl">history</span>
              <span className="text-[13px] tracking-wide">Histórico / Logs</span>
            </Link>
          )}
          {currentUser?.permissions?.users_manage && (
            <Link href="/orcamentos/admin/usuarios" className={`flex items-center gap-3 px-6 py-3 transition-all duration-200 ${pathname.includes("/admin/usuarios") ? "bg-[#D14237]/15 border-l-4 border-[#D14237] text-white font-medium" : "border-l-4 border-transparent text-rose-200/60 hover:text-white hover:bg-white/5"}`}>
              <span className="material-symbols-outlined text-xl">group</span>
              <span className="text-[13px] tracking-wide">Gerenciar Usuários</span>
            </Link>
          )}
          {currentUser?.permissions?.users_manage && (
            <Link href="/orcamentos/admin/revisoes" className={`flex items-center gap-3 px-6 py-3 transition-all duration-200 ${pathname.includes("/revisoes") ? "bg-[#D14237]/15 border-l-4 border-[#D14237] text-white font-medium" : "border-l-4 border-transparent text-rose-200/60 hover:text-white hover:bg-white/5"}`}>
              <span className="material-symbols-outlined text-xl">rate_review</span>
              <span className="text-[13px] tracking-wide">Revisões IA</span>
            </Link>
          )}
          {currentUser?.permissions?.users_manage && (
            <Link href="/orcamentos/settings" className={`flex items-center gap-3 px-6 py-3 transition-all duration-200 ${pathname.includes("/settings") ? "bg-[#D14237]/15 border-l-4 border-[#D14237] text-white font-medium" : "border-l-4 border-transparent text-rose-200/60 hover:text-white hover:bg-white/5"}`}>
              <span className="material-symbols-outlined text-xl">settings</span>
              <span className="text-[13px] tracking-wide">Configurações</span>
            </Link>
          )}
        </nav>

        {/* ── Sidebar bottom ── */}
        <div className="mt-auto border-t border-white/10 pt-3 pb-3">
          <div className="mx-3 flex items-center gap-1">
            {/* User card — sem ícone de editar */}
            <button
              onClick={() => openProfileModal("foto")}
              className="flex items-center gap-2.5 flex-1 min-w-0 px-2.5 py-2 rounded-xl hover:bg-white/10 transition-all text-left"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-rose-900/40 flex items-center justify-center flex-shrink-0 border border-white/10">
                {currentUser?.photo_url ? (
                  <img src={currentUser.photo_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-rose-300 text-[18px]">person</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white truncate leading-none">{currentUser?.name || "…"}</p>
                <p className="text-[9px] text-rose-300/70 uppercase tracking-wider mt-0.5 truncate">{currentUser?.role || ""}</p>
              </div>
            </button>

            {/* Ajuda */}
            <Link href="/orcamentos/ajuda" title="Ajuda"
              className={`p-2 transition-colors flex-shrink-0 ${pathname.includes("ajuda") ? "text-white" : "text-rose-300/40 hover:text-white"}`}>
              <span className="material-symbols-outlined text-[18px]">help</span>
            </Link>

            {/* Sair */}
            <button
              onClick={() => { localStorage.removeItem("marilia_admin_session"); window.location.href = "/login"; }}
              title="Sair"
              className="p-2 text-rose-300/40 hover:text-white transition-colors flex-shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Impersonation Banner */}
      {impersonatedUser && (
        <div className="fixed top-0 left-[220px] right-0 bg-[#D14237] text-white py-2 px-6 z-30 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs font-bold">
            <Eye size={16} />
            MODO DE SIMULAÇÃO ATIVO: Você está visualizando como "{impersonatedUser.name}" ({impersonatedUser.role})
          </div>
          <button onClick={stopImpersonating}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2">
            <EyeOff size={14} /> Parar Simulação
          </button>
        </div>
      )}

      {/* ══ PROFILE COMPLETION MODAL ══ */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-[#5C1F2E]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-8 text-center border-b border-rose-50">
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 relative group cursor-pointer overflow-hidden border-2 border-dashed border-rose-200">
                {user?.photo_url ? (
                  <img src={user.photo_url} className="w-full h-full object-cover" />
                ) : (
                  <Camera className="text-rose-300" size={32} />
                )}
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                {uploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="animate-spin text-rose-500" /></div>}
              </div>
              <h2 className="font-lora text-2xl font-bold text-[#5C1F2E]">Bem-vindo(a)!</h2>
              <p className="font-dm text-rose-400 text-sm mt-2">Complete seu perfil para começar a usar o sistema.</p>
            </div>
            <form onSubmit={handleUpdateProfile} className="p-8 space-y-5">
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Nome Completo</label>
                <input name="name" defaultValue={user?.name || ""} required
                  className="w-full border border-rose-100 rounded-xl p-3 text-sm focus:outline-none focus:border-[#D14237]" placeholder="Seu nome..." />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">WhatsApp de Vendas</label>
                <input name="whatsapp" defaultValue={user?.whatsapp || ""} required
                  className="w-full border border-rose-100 rounded-xl p-3 text-sm focus:outline-none focus:border-[#D14237]" placeholder="(00) 00000-0000" />
              </div>
              <button type="submit" disabled={loading || uploading}
                className="w-full bg-[#5C1F2E] hover:bg-[#4A1925] text-white py-4 rounded-xl font-dm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-xl shadow-[#5C1F2E]/20">
                {loading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                Salvar e Continuar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className={`md:ml-[220px] p-4 md:p-8 w-full pt-[72px] md:pt-8 ${impersonatedUser ? "md:pt-14" : ""}`}>
        {children}
      </main>
    </div>
  );
}
