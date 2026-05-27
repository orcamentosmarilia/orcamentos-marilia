"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Plus, Trash2, Loader2, X, Star, Search,
  Phone, Mail, Building2, User, ChevronDown, ChevronUp, UserPlus,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";

/* ─── Types ─────────────────────────────────────────────────── */
interface Contact {
  name: string;
  role: string;
}

interface Client {
  id: string;
  name: string;
  entity_type: "PF" | "PJ";
  cpf_cnpj?: string;
  email?: string;
  phone?: string;
  secondary_phone?: string;
  contacts?: Contact[];
  address?: string;
  city?: string;
  birthday?: string;
  rating?: number;
  notes?: string;
  created_at: string;
  /* enriched from quotes */
  quote_count?: number;
  last_event?: string;
  total_spent?: number;
}

interface InformalClient {
  name: string;
  quote_count: number;
  last_event: string;
  total_spent: number;
}

const EMPTY: Omit<Client, "id" | "created_at"> = {
  name: "", entity_type: "PF", cpf_cnpj: "", email: "",
  phone: "", secondary_phone: "", contacts: [],
  address: "", city: "", birthday: "", rating: undefined, notes: "",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string) => s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—";

function RatingStars({ value, onChange }: { value?: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(value === n ? 0 : n)}
          className={`transition-colors ${n <= (value || 0) ? "text-amber-400" : "text-gray-200 hover:text-amber-200"}`}>
          <Star size={16} fill={n <= (value || 0) ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [informalClients, setInformalClients] = useState<InformalClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [modal, setModal] = useState<{ open: boolean; client: Partial<Client> | null; isNew: boolean }>({
    open: false, client: null, isNew: false,
  });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const [{ data: clientData }, { data: quoteData }] = await Promise.all([
        supabase.from("clients").select("*").order("name"),
        supabase.from("quotes").select("id, client_name, client_id, event_date, total_value, status"),
      ]);

      const allQuotes = quoteData || [];

      const quotesById: Record<string, { count: number; last: string; total: number }> = {};
      allQuotes.filter((q: any) => q.client_id).forEach((q: any) => {
        if (!quotesById[q.client_id]) quotesById[q.client_id] = { count: 0, last: "", total: 0 };
        quotesById[q.client_id].count++;
        if (!quotesById[q.client_id].last || q.event_date > quotesById[q.client_id].last)
          quotesById[q.client_id].last = q.event_date;
        if (["aprovado", "pago", "realizado"].includes(q.status?.toLowerCase()))
          quotesById[q.client_id].total += Number(q.total_value) || 0;
      });

      setClients((clientData || []).map((c: any) => ({
        ...c,
        contacts: Array.isArray(c.contacts) ? c.contacts : [],
        quote_count: quotesById[c.id]?.count || 0,
        last_event: quotesById[c.id]?.last || "",
        total_spent: quotesById[c.id]?.total || 0,
      })));

      const formalNames = new Set((clientData || []).map((c: any) => c.name.toLowerCase().trim()));
      const informalMap: Record<string, InformalClient> = {};

      allQuotes.filter((q: any) => !q.client_id && q.client_name).forEach((q: any) => {
        const name = q.client_name.trim();
        const key = name.toLowerCase();
        if (formalNames.has(key)) return;
        if (!informalMap[key]) informalMap[key] = { name, quote_count: 0, last_event: "", total_spent: 0 };
        informalMap[key].quote_count++;
        if (!informalMap[key].last_event || q.event_date > informalMap[key].last_event)
          informalMap[key].last_event = q.event_date;
        if (["aprovado", "pago", "realizado"].includes(q.status?.toLowerCase()))
          informalMap[key].total_spent += Number(q.total_value) || 0;
      });

      setInformalClients(Object.values(informalMap).sort((a, b) => a.name.localeCompare(b.name)));
    } finally {
      setLoading(false);
    }
  }

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.cpf_cnpj?.includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.contacts?.some(ct => ct.name.toLowerCase().includes(q))
    );
  }, [clients, search]);

  const filteredInformal = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return informalClients;
    return informalClients.filter(c => c.name.toLowerCase().includes(q));
  }, [informalClients, search]);

  function openNew() { setModal({ open: true, client: { ...EMPTY, contacts: [] }, isNew: true }); }
  function openEdit(c: Client) { setModal({ open: true, client: { ...c, contacts: c.contacts || [] }, isNew: false }); }
  function formalizeClient(ic: InformalClient) { setModal({ open: true, client: { ...EMPTY, name: ic.name, contacts: [] }, isNew: true }); }
  function updateField(field: keyof Client, val: any) { setModal(m => ({ ...m, client: { ...m.client, [field]: val } })); }

  /* ── Contacts helpers ── */
  function addContact() {
    const current = modal.client?.contacts || [];
    updateField("contacts", [...current, { name: "", role: "" }]);
  }
  function updateContact(i: number, field: keyof Contact, val: string) {
    const updated = (modal.client?.contacts || []).map((ct, idx) => idx === i ? { ...ct, [field]: val } : ct);
    updateField("contacts", updated);
  }
  function removeContact(i: number) {
    updateField("contacts", (modal.client?.contacts || []).filter((_, idx) => idx !== i));
  }

  async function saveClient() {
    if (!modal.client?.name?.trim()) return;
    setSaving(true);
    try {
      const payload: any = { ...modal.client };
      delete payload.id;
      delete payload.created_at;
      delete payload.quote_count;
      delete payload.last_event;
      delete payload.total_spent;
      if (!payload.rating) payload.rating = null;
      if (!payload.birthday) payload.birthday = null;
      payload.contacts = (payload.contacts || []).filter((ct: Contact) => ct.name.trim());

      if (modal.isNew) {
        const { data, error } = await supabase.from("clients").insert(payload).select("id").single();
        if (error) throw error;
        if (data?.id) {
          await supabase.from("quotes").update({ client_id: data.id })
            .is("client_id", null).ilike("client_name", payload.name.trim());
        }
      } else {
        const { error } = await supabase.from("clients").update(payload).eq("id", modal.client!.id!);
        if (error) throw error;
      }

      setModal({ open: false, client: null, isNew: false });
      fetchAll();
    } catch (err: any) {
      alert("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteClient() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await supabase.from("quotes").update({ client_id: null }).eq("client_id", deleteId);
      const { error } = await supabase.from("clients").delete().eq("id", deleteId);
      if (error) throw error;
      setDeleteId(null);
      fetchAll();
    } catch (err: any) {
      alert("Erro: " + err.message);
    } finally {
      setDeleting(false);
    }
  }

  const c = modal.client;
  const totalCount = filteredClients.length + filteredInformal.length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ══ FORM MODAL ══ */}
      {modal.open && c && (
        <div className="fixed inset-0 bg-[#5C1F2E]/90 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-rose-50 my-6">
            <div className="flex items-center justify-between px-7 py-5 border-b border-rose-50">
              <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">
                {modal.isNew ? "Novo Cliente" : "Editar Cliente"}
              </h2>
              <button onClick={() => setModal({ open: false, client: null, isNew: false })} className="text-rose-300 hover:text-[#D14237]">
                <X size={18} />
              </button>
            </div>

            <div className="p-7 space-y-5">

              {/* Entity type */}
              <div className="flex gap-3">
                {(["PF", "PJ"] as const).map(t => (
                  <button key={t} type="button" onClick={() => updateField("entity_type", t)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-dm font-bold transition-all ${
                      c.entity_type === t ? "bg-[#5C1F2E] text-white border-[#5C1F2E]" : "bg-white text-rose-400 border-rose-100 hover:border-rose-300"
                    }`}>
                    {t === "PF" ? <User size={14} /> : <Building2 size={14} />}
                    {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                  </button>
                ))}
              </div>

              {/* Name */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nome completo *" colSpan={2}>
                  <input value={c.name || ""} onChange={e => updateField("name", e.target.value)} placeholder="Nome do cliente..." />
                </Field>

                <Field label={c.entity_type === "PJ" ? "CNPJ" : "CPF"}>
                  <input value={c.cpf_cnpj || ""} onChange={e => updateField("cpf_cnpj", e.target.value)}
                    placeholder={c.entity_type === "PJ" ? "00.000.000/0001-00" : "000.000.000-00"} />
                </Field>

                <Field label="E-mail">
                  <input type="email" value={c.email || ""} onChange={e => updateField("email", e.target.value)} placeholder="email@exemplo.com" />
                </Field>

                <Field label="Telefone / WhatsApp">
                  <input value={c.phone || ""} onChange={e => updateField("phone", e.target.value)} placeholder="(41) 99999-9999" />
                </Field>

                <Field label="Telefone secundário">
                  <input value={c.secondary_phone || ""} onChange={e => updateField("secondary_phone", e.target.value)} placeholder="(41) 99999-9999" />
                </Field>

                <Field label="Endereço">
                  <input value={c.address || ""} onChange={e => updateField("address", e.target.value)} placeholder="Rua, número, bairro..." />
                </Field>

                <Field label="Cidade">
                  <input value={c.city || ""} onChange={e => updateField("city", e.target.value)} placeholder="Ex.: Curitiba" />
                </Field>

                <Field label={c.entity_type === "PJ" ? "Fundação / Aniversário da empresa" : "Data de aniversário"} colSpan={2}>
                  <input type="date" value={c.birthday || ""} onChange={e => updateField("birthday", e.target.value)} />
                </Field>
              </div>

              {/* ── Contacts ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Contatos / Responsáveis
                  </label>
                  <button type="button" onClick={addContact}
                    className="flex items-center gap-1 text-[11px] font-dm font-bold text-[#5C1F2E] hover:text-[#D14237] transition-colors">
                    <Plus size={13} /> Adicionar contato
                  </button>
                </div>

                {(c.contacts || []).length === 0 ? (
                  <button type="button" onClick={addContact}
                    className="w-full border-2 border-dashed border-rose-100 rounded-xl py-4 text-sm font-dm text-rose-300 hover:border-rose-300 hover:text-rose-400 transition-all">
                    + Adicionar contato
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(c.contacts || []).map((ct, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          value={ct.name}
                          onChange={e => updateContact(i, "name", e.target.value)}
                          placeholder="Nome do contato"
                          className="flex-1 border border-rose-100 rounded-xl px-3.5 py-2.5 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] placeholder:text-rose-200"
                        />
                        <input
                          value={ct.role}
                          onChange={e => updateContact(i, "role", e.target.value)}
                          placeholder="Cargo / função"
                          className="flex-1 border border-rose-100 rounded-xl px-3.5 py-2.5 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] placeholder:text-rose-200"
                        />
                        <button type="button" onClick={() => removeContact(i)}
                          className="p-2 text-rose-200 hover:text-red-500 rounded-lg hover:bg-rose-50 transition-all flex-shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={addContact}
                      className="text-[11px] font-dm font-bold text-rose-400 hover:text-[#5C1F2E] transition-colors text-left pl-1 mt-1">
                      + Adicionar outro contato
                    </button>
                  </div>
                )}
              </div>

              {/* Rating + Notes */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Avaliação / NPS</label>
                  <RatingStars value={c.rating} onChange={v => updateField("rating", v)} />
                </div>
              </div>

              <Field label="Observações internas" colSpan={2}>
                <textarea rows={3} value={c.notes || ""} onChange={e => updateField("notes", e.target.value)}
                  placeholder="Preferências, restrições alimentares, histórico relevante..." />
              </Field>

            </div>

            <div className="px-7 pb-7 flex gap-3">
              <button onClick={() => setModal({ open: false, client: null, isNew: false })}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 border border-gray-100 font-dm">
                Cancelar
              </button>
              <button onClick={saveClient} disabled={saving || !c.name?.trim()}
                className="flex-1 bg-[#5C1F2E] hover:bg-[#4A1925] disabled:opacity-40 text-white py-3 rounded-xl font-dm font-bold text-sm flex items-center justify-center gap-2 transition-all">
                {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                {modal.isNew ? "Cadastrar" : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DELETE CONFIRM ══ */}
      {deleteId && (
        <div className="fixed inset-0 bg-[#5C1F2E]/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-7 text-center font-dm">
            <Trash2 className="mx-auto text-red-400 mb-3" size={28} />
            <h3 className="font-lora text-lg font-bold text-[#5C1F2E] mb-2">Remover cliente?</h3>
            <p className="text-sm text-rose-400 mb-6">O vínculo com orçamentos existentes será desfeito, mas eles não serão excluídos.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-500 border border-gray-100 hover:bg-gray-50">Cancelar</button>
              <button onClick={deleteClient} disabled={deleting} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                {deleting && <Loader2 size={14} className="animate-spin" />} Remover
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="Clientes"
        description={`${totalCount} cliente${totalCount !== 1 ? "s" : ""} encontrado${totalCount !== 1 ? "s" : ""}`}
        actions={
          <button onClick={openNew} className="bg-[#5C1F2E] hover:bg-[#4A1925] text-white px-5 py-2.5 rounded-xl font-dm font-bold text-sm flex items-center gap-2 transition-all shadow-sm">
            <Plus size={15} /> Novo cliente
          </button>
        }
      />

      {/* ── Search ── */}
      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300 pointer-events-none" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, e-mail, telefone, cidade..."
          className="w-full pl-10 pr-4 py-2.5 border border-rose-100 rounded-xl text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] placeholder:text-rose-200 bg-white shadow-sm" />
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-rose-300" size={24} /></div>
      ) : (
        <>
          {/* ── Formal clients ── */}
          {filteredClients.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-rose-50 overflow-hidden">
              <div className="px-6 py-3 border-b border-rose-50 bg-rose-50/40">
                <p className="text-[10px] font-dm font-bold text-rose-400 uppercase tracking-widest">Cadastrados ({filteredClients.length})</p>
              </div>
              <div className="divide-y divide-rose-50">
                {filteredClients.map(cl => {
                  const isOpen = expandedId === cl.id;
                  return (
                    <div key={cl.id}>
                      <div className="flex items-center gap-4 px-6 py-4 hover:bg-rose-50/30 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-[#5C1F2E]/10 flex items-center justify-center flex-shrink-0">
                          {cl.entity_type === "PJ" ? <Building2 size={16} className="text-[#5C1F2E]" /> : <User size={16} className="text-[#5C1F2E]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-dm font-bold text-sm text-[#5C1F2E] truncate">{cl.name}</p>
                            {cl.entity_type === "PJ" && (
                              <span className="text-[9px] font-bold bg-rose-100 text-rose-500 px-1.5 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">PJ</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            {cl.phone && <span className="text-[11px] font-dm text-rose-400 flex items-center gap-1"><Phone size={10} />{cl.phone}</span>}
                            {cl.email && <span className="text-[11px] font-dm text-rose-400 flex items-center gap-1 truncate"><Mail size={10} />{cl.email}</span>}
                            {cl.city && <span className="text-[11px] font-dm text-rose-300">{cl.city}</span>}
                          </div>
                        </div>
                        <div className="hidden md:flex items-center gap-6 text-right flex-shrink-0">
                          <div>
                            <p className="text-[10px] font-dm text-rose-300 uppercase tracking-wider">Pedidos</p>
                            <p className="font-dm font-bold text-sm text-[#5C1F2E]">{cl.quote_count || 0}</p>
                          </div>
                          {(cl.total_spent || 0) > 0 && (
                            <div>
                              <p className="text-[10px] font-dm text-rose-300 uppercase tracking-wider">Total aprovado</p>
                              <p className="font-dm font-bold text-sm text-emerald-600">{fmt(cl.total_spent!)}</p>
                            </div>
                          )}
                          {cl.last_event && (
                            <div>
                              <p className="text-[10px] font-dm text-rose-300 uppercase tracking-wider">Último evento</p>
                              <p className="font-dm text-sm text-rose-400">{fmtDate(cl.last_event)}</p>
                            </div>
                          )}
                          {cl.rating ? (
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(n => (
                                <Star key={n} size={11} className={n <= cl.rating! ? "text-amber-400" : "text-gray-200"} fill={n <= cl.rating! ? "currentColor" : "none"} />
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => setExpandedId(isOpen ? null : cl.id)} className="p-2 text-rose-200 hover:text-[#5C1F2E] rounded-lg hover:bg-rose-50 transition-all">
                            {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                          </button>
                          <button onClick={() => openEdit(cl)} className="p-2 text-rose-200 hover:text-[#5C1F2E] rounded-lg hover:bg-rose-50 transition-all">
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                          </button>
                          <button onClick={() => setDeleteId(cl.id)} className="p-2 text-rose-100 hover:text-red-500 rounded-lg hover:bg-rose-50 transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded */}
                      {isOpen && (
                        <div className="px-6 pb-5 pt-3 bg-rose-50/20 border-t border-rose-50 space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {cl.cpf_cnpj && <Detail label={cl.entity_type === "PJ" ? "CNPJ" : "CPF"} value={cl.cpf_cnpj} />}
                            {cl.secondary_phone && <Detail label="Tel. secundário" value={cl.secondary_phone} />}
                            {cl.address && <Detail label="Endereço" value={cl.address} />}
                            {cl.birthday && <Detail label={cl.entity_type === "PJ" ? "Fundação" : "Aniversário"} value={fmtDate(cl.birthday)} />}
                            {cl.notes && <Detail label="Observações" value={cl.notes} colSpan />}
                          </div>
                          {(cl.contacts || []).length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-rose-300 uppercase tracking-wider mb-2">Contatos</p>
                              <div className="flex flex-col gap-1.5">
                                {cl.contacts!.map((ct, i) => (
                                  <div key={i} className="flex items-center gap-3 text-sm font-dm text-[#5C1F2E]">
                                    <User size={13} className="text-rose-300 flex-shrink-0" />
                                    <span className="font-bold">{ct.name}</span>
                                    {ct.role && <span className="text-rose-400">— {ct.role}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Informal clients ── */}
          {filteredInformal.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-rose-50 overflow-hidden">
              <div className="px-6 py-3 border-b border-amber-100 bg-amber-50/60">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-dm font-bold text-amber-600 uppercase tracking-widest">Dos orçamentos — não cadastrados ({filteredInformal.length})</p>
                  <p className="text-[10px] font-dm text-amber-500">Clique em "Cadastrar" para adicionar dados completos</p>
                </div>
              </div>
              <div className="divide-y divide-rose-50">
                {filteredInformal.map(ic => (
                  <div key={ic.name} className="flex items-center gap-4 px-6 py-4 hover:bg-amber-50/20 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <User size={16} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-dm font-bold text-sm text-[#5C1F2E] truncate">{ic.name}</p>
                      <p className="text-[11px] font-dm text-rose-400 mt-0.5">
                        {ic.quote_count} pedido{ic.quote_count !== 1 ? "s" : ""}
                        {ic.last_event ? ` · último evento: ${fmtDate(ic.last_event)}` : ""}
                      </p>
                    </div>
                    {ic.total_spent > 0 && (
                      <div className="hidden md:block text-right flex-shrink-0">
                        <p className="text-[10px] font-dm text-rose-300 uppercase tracking-wider">Total aprovado</p>
                        <p className="font-dm font-bold text-sm text-emerald-600">{fmt(ic.total_spent)}</p>
                      </div>
                    )}
                    <button onClick={() => formalizeClient(ic)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-dm font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all flex-shrink-0">
                      <UserPlus size={12} /> Cadastrar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalCount === 0 && (
            <div className="py-16 text-center text-rose-300 font-dm text-sm">
              {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Helpers ────────────────────────────────────────────────── */
function Field({ label, children, colSpan }: { label: string; children: React.ReactNode; colSpan?: boolean | number }) {
  const span = colSpan ? "col-span-2" : "";
  return (
    <div className={span}>
      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="[&>input]:w-full [&>input]:border [&>input]:border-rose-100 [&>input]:rounded-xl [&>input]:px-3.5 [&>input]:py-2.5 [&>input]:text-sm [&>input]:font-dm [&>input]:text-[#5C1F2E] [&>input]:focus:outline-none [&>input]:focus:border-[#5C1F2E] [&>input]:placeholder:text-rose-200 [&>select]:w-full [&>select]:border [&>select]:border-rose-100 [&>select]:rounded-xl [&>select]:px-3.5 [&>select]:py-2.5 [&>select]:text-sm [&>select]:font-dm [&>select]:text-[#5C1F2E] [&>select]:focus:outline-none [&>select]:focus:border-[#5C1F2E] [&>textarea]:w-full [&>textarea]:border [&>textarea]:border-rose-100 [&>textarea]:rounded-xl [&>textarea]:px-3.5 [&>textarea]:py-2.5 [&>textarea]:text-sm [&>textarea]:font-dm [&>textarea]:text-[#5C1F2E] [&>textarea]:focus:outline-none [&>textarea]:focus:border-[#5C1F2E] [&>textarea]:placeholder:text-rose-200 [&>textarea]:resize-none">
        {children}
      </div>
    </div>
  );
}

function Detail({ label, value, colSpan }: { label: string; value: string; colSpan?: boolean }) {
  return (
    <div className={colSpan ? "col-span-2" : ""}>
      <p className="text-[10px] font-bold text-rose-300 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-[#5C1F2E]">{value}</p>
    </div>
  );
}
