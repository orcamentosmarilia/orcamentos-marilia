"use client";

import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import {
  Trash2, AlertTriangle, ShieldCheck, Loader2,
  X, Settings, Plus, CheckCircle, XCircle,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";

/* ─── Types ────────────────────────────────────────────────── */
interface Quote {
  id: string;
  client_name: string;
  status: string;
  event_date: string;
  guests: number;
  created_by?: string;
  lead_source?: string;
  total_value?: number;
}

interface Stage {
  id: string;
  title: string;
  isDefault?: boolean;
}

/* ─── Constants ─────────────────────────────────────────────── */
const TERMINAL = ["aprovado", "perdido", "pago", "realizado"];

const DEFAULT_STAGES: Stage[] = [
  { id: "rascunho",   title: "Rascunho",   isDefault: true },
  { id: "aguardando", title: "Aguardando",  isDefault: true },
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function stageDot(id: string) {
  if (id === "rascunho")   return "#9E9E9E";
  if (id === "aguardando") return "#D14237";
  return "#7C3AED";
}

function stageCls(id: string) {
  if (id === "rascunho")   return "bg-gray-50 border-[#C4ABA8]/50";
  if (id === "aguardando") return "bg-[#FAE8E6] border-brand-pink2";
  return "bg-violet-50 border-violet-200";
}

function creatorLabel(name: string | undefined) {
  if (!name) return "—";
  const first = name.split(" ")[0];
  return first.length > 12 ? first.slice(0, 11) + "…" : first;
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function PipelinePage() {
  const [quotes, setQuotes]         = useState<Quote[]>([]);
  const [stages, setStages]         = useState<Stage[]>(DEFAULT_STAGES);
  const [loading, setLoading]       = useState(true);
  const [draggedId, setDraggedId]   = useState<string | null>(null);

  // Delete modal
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; quoteId: string | null; quoteName: string | null }>({ open: false, quoteId: null, quoteName: null });
  const [password, setPassword]     = useState("");
  const [deleting, setDeleting]     = useState(false);
  const [masterPassword, setMasterPassword] = useState("");

  // Loss reason modal
  const [lostModal, setLostModal]   = useState<{ open: boolean; quoteId: string | null }>({ open: false, quoteId: null });
  const [lossReasons, setLossReasons] = useState<{ id: string; reason: string }[]>([]);
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason]     = useState("");
  const [savingLost, setSavingLost] = useState(false);

  // Stage settings modal
  const [showSettings, setShowSettings] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [savingStage, setSavingStage]   = useState(false);

  useEffect(() => {
    fetchStages();
    fetchQuotes();
    fetchMasterPassword();
    fetchLossReasons();
  }, []);

  /* ── Stages ── */
  async function fetchStages() {
    const { data } = await supabase.from("settings").select("value").eq("key", "pipeline_stages").single();
    if (Array.isArray(data?.value) && data.value.length > 0) setStages(data.value);
  }

  async function persistStages(next: Stage[]) {
    setStages(next);
    await supabase.from("settings").upsert({ key: "pipeline_stages", value: next }, { onConflict: "key" });
  }

  async function addStage() {
    const title = newStageName.trim();
    if (!title) return;
    setSavingStage(true);
    const id = title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!stages.find(s => s.id === id)) await persistStages([...stages, { id, title }]);
    setNewStageName("");
    setSavingStage(false);
  }

  async function removeStage(id: string) {
    await persistStages(stages.filter(s => s.id !== id));
  }

  /* ── Data ── */
  async function fetchMasterPassword() {
    const { data } = await supabase.from("settings").select("value").eq("key", "security_master_password").single();
    if (data) setMasterPassword(data.value);
  }

  async function fetchLossReasons() {
    const { data } = await supabase.from("loss_reasons").select("id, reason").eq("is_active", true).order("reason");
    setLossReasons(data || []);
  }

  async function fetchQuotes() {
    try {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, client_name, status, event_date, guests, created_by, lead_source, total_value")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setQuotes((data || []).map((q: any) => ({ ...q, status: q.status?.toLowerCase() ?? "rascunho" })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /* ── Active quotes (non-terminal only) ── */
  const activeQuotes = useMemo(
    () => quotes.filter(q => !TERMINAL.includes(q.status?.toLowerCase() ?? "")),
    [quotes],
  );

  /* ── Drag & drop ── */
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const quoteId = e.dataTransfer.getData("text/plain");
    setDraggedId(null);
    if (!quoteId) return;
    const q = activeQuotes.find(x => x.id === quoteId);
    if (!q || q.status === newStatus) return;
    setQuotes(prev => prev.map(x => x.id === quoteId ? { ...x, status: newStatus } : x));
    try {
      await supabase.from("quotes").update({ status: newStatus }).eq("id", quoteId);
    } catch {
      fetchQuotes();
    }
  };

  /* ── Win / Lose ── */
  async function markGanho(quoteId: string) {
    setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, status: "aprovado" } : q));
    await supabase.from("quotes").update({ status: "aprovado", approved_at: new Date().toISOString() }).eq("id", quoteId);
  }

  async function confirmLost() {
    const reason = selectedReason || customReason.trim();
    if (!reason || !lostModal.quoteId) return;
    setSavingLost(true);
    try {
      setQuotes(prev => prev.map(q => q.id === lostModal.quoteId ? { ...q, status: "perdido" } : q));
      await supabase.from("quotes").update({
        status: "perdido",
        lost_at: new Date().toISOString(),
        lost_reason: reason,
      }).eq("id", lostModal.quoteId);
      setLostModal({ open: false, quoteId: null });
    } catch {
      fetchQuotes();
    } finally {
      setSavingLost(false);
    }
  }

  /* ── Delete ── */
  async function handleDelete() {
    if (password !== masterPassword) { alert("Senha incorreta!"); return; }
    setDeleting(true);
    try {
      const { data: qd } = await supabase.from("quotes").select("*").eq("id", deleteModal.quoteId).single();
      const { error } = await supabase.from("quotes").delete().eq("id", deleteModal.quoteId);
      if (error) throw error;
      await supabase.from("admin_logs").insert([{
        action: "DELETE_QUOTE",
        details: `Orçamento de ${deleteModal.quoteName} (via Pipeline)`,
        metadata: qd,
        user_id: JSON.parse(localStorage.getItem("marilia_admin_session") || "{}").email || "admin",
      }]);
      setDeleteModal({ open: false, quoteId: null, quoteName: null });
      setPassword("");
      fetchQuotes();
    } catch (err: any) {
      alert("Erro: " + err.message);
    } finally {
      setDeleting(false);
    }
  }

  /* ─────────────────────── RENDER ─────────────────────────── */
  if (loading) return <div className="p-8 text-center font-dm text-rose-300 animate-pulse">Carregando...</div>;

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-140px)] flex flex-col">

      {/* ══ DELETE MODAL ══ */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-[#5C1F2E]/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-brand-pink2">
            <div className="p-6 text-center font-dm">
              <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
                <AlertTriangle className="text-red-500" size={28} />
              </div>
              <h2 className="font-lora text-xl font-bold text-[#5C1F2E] mb-2">Confirmar Exclusão</h2>
              <p className="text-rose-400 text-sm mb-5">Apagar orçamento de <strong>{deleteModal.quoteName}</strong>? Irreversível.</p>
              <div className="text-left mb-5">
                <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  <ShieldCheck size={13} className="text-red-500" /> Senha de Segurança
                </label>
                <input type="password" autoFocus value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleDelete()}
                  className="w-full border border-brand-pink2 rounded-xl p-3 text-sm focus:outline-none focus:border-red-400" placeholder="Senha mestra..." />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setDeleteModal({ open: false, quoteId: null, quoteName: null }); setPassword(""); }} className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 border border-gray-100">Cancelar</button>
                <button onClick={handleDelete} disabled={deleting || !password} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                  {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />} Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ LOSS REASON MODAL ══ */}
      {lostModal.open && (
        <div className="fixed inset-0 bg-[#5C1F2E]/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">Motivo da Perda</h2>
                <button onClick={() => setLostModal({ open: false, quoteId: null })} className="text-rose-300 hover:text-[#D14237]"><X size={18} /></button>
              </div>
              <p className="text-sm font-dm text-rose-400 mb-4">Por que este orçamento foi perdido?</p>
              <div className="flex flex-col gap-2 mb-4">
                {lossReasons.map(r => (
                  <button key={r.id} onClick={() => { setSelectedReason(r.reason); setCustomReason(""); }}
                    className={`text-left px-4 py-2.5 rounded-xl border text-sm font-dm transition-all ${selectedReason === r.reason ? "bg-slate-700 text-white border-slate-700 font-bold" : "bg-white text-[#5C1F2E] border-rose-100 hover:border-slate-300"}`}>
                    {r.reason}
                  </button>
                ))}
              </div>
              <input type="text" placeholder="Outro motivo..." value={customReason} onChange={e => { setCustomReason(e.target.value); setSelectedReason(""); }}
                className="w-full border border-rose-100 rounded-xl px-4 py-2.5 text-sm font-dm focus:outline-none focus:border-slate-400 text-[#5C1F2E] mb-5" />
              <div className="flex gap-3">
                <button onClick={() => setLostModal({ open: false, quoteId: null })} className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 border border-gray-100">Cancelar</button>
                <button onClick={confirmLost} disabled={savingLost || (!selectedReason && !customReason.trim())} className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                  {savingLost && <Loader2 size={15} className="animate-spin" />} Confirmar Perda
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ STAGE SETTINGS MODAL ══ */}
      {showSettings && (
        <div className="fixed inset-0 bg-[#5C1F2E]/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-rose-50">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">Etapas do Kanban</h2>
                <button onClick={() => setShowSettings(false)} className="text-rose-300 hover:text-[#D14237]"><X size={18} /></button>
              </div>
              <p className="text-xs font-dm text-rose-400 mb-4">As colunas Aprovado e Perdido ficam apenas na Lista Geral.</p>

              <div className="flex flex-col gap-2 mb-5">
                {stages.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-rose-50 bg-rose-50/30">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stageDot(s.id) }} />
                      <span className="text-sm font-dm font-bold text-[#5C1F2E]">{s.title}</span>
                      {s.isDefault && <span className="text-[9px] font-dm text-rose-300 uppercase tracking-wider">padrão</span>}
                    </div>
                    {!s.isDefault && (
                      <button onClick={() => removeStage(s.id)} className="text-rose-200 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <input type="text" placeholder="Nome da nova etapa..." value={newStageName} onChange={e => setNewStageName(e.target.value)} onKeyDown={e => e.key === "Enter" && addStage()}
                  className="flex-1 border border-rose-100 rounded-xl px-3 py-2.5 text-sm font-dm focus:outline-none focus:border-[#5C1F2E] text-[#5C1F2E] placeholder:text-rose-200" />
                <button onClick={addStage} disabled={savingStage || !newStageName.trim()} className="bg-[#5C1F2E] hover:bg-[#4A1925] disabled:opacity-40 text-white px-4 py-2.5 rounded-xl font-dm font-bold text-sm flex items-center gap-1.5 transition-all">
                  {savingStage ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="Kanban de Vendas"
        description="Leads ativos. Arraste para mover entre etapas."
        actions={
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-dm font-bold text-rose-400 hover:text-[#5C1F2E] border border-rose-100 rounded-xl hover:border-rose-300 transition-all bg-white shadow-sm">
            <Settings size={14} /> Configurar etapas
          </button>
        }
      />

      {/* ── Board ── */}
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {stages.map(col => {
          const colQuotes = activeQuotes.filter(q => q.status === col.id);
          const colTotal  = colQuotes.reduce((s, q) => s + (Number(q.total_value) || 0), 0);

          return (
            <div
              key={col.id}
              className={`flex-1 min-w-[240px] flex flex-col rounded-2xl border ${stageCls(col.id)} bg-white/50`}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, col.id)}
            >
              {/* Column header */}
              <div className={`px-4 py-3 rounded-t-2xl border-b ${stageCls(col.id)}`}>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: stageDot(col.id) }} />
                  <h3 className="font-lora font-bold text-[#5C1F2E] text-sm">{col.title}</h3>
                </div>
                <div className="flex items-center justify-between pl-4 mt-0.5">
                  <p className="text-[10px] font-dm text-rose-400 uppercase tracking-widest">
                    {colQuotes.length} lead{colQuotes.length !== 1 ? "s" : ""}
                  </p>
                  {colTotal > 0 && (
                    <p className="text-[10px] font-dm font-bold" style={{ color: stageDot(col.id) }}>
                      {fmt(colTotal)}
                    </p>
                  )}
                </div>
              </div>

              {/* Cards */}
              <div className="p-3 flex-1 overflow-y-auto flex flex-col gap-2">
                {colQuotes.map(quote => (
                  <div
                    key={quote.id}
                    draggable
                    onDragStart={e => handleDragStart(e, quote.id)}
                    className={`bg-white px-3.5 py-2.5 rounded-xl border border-brand-pink2 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${draggedId === quote.id ? "opacity-40 border-dashed" : ""}`}
                  >
                    {/* Name + actions */}
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="font-dm font-bold text-sm text-[#5C1F2E] truncate leading-tight">{quote.client_name}</h4>
                      <div className="flex items-center flex-shrink-0 -mr-1.5 -mt-0.5">
                        <Link href={`/orcamentos/${quote.id}/revisao`} className="p-1 text-rose-200 hover:text-[#D14237]">
                          <span className="material-symbols-outlined text-[13px]">edit</span>
                        </Link>
                        <Link href={`/proposta/${quote.id}`} target="_blank" className="p-1 text-rose-200 hover:text-[#D14237]">
                          <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                        </Link>
                        <button onClick={() => setDeleteModal({ open: true, quoteId: quote.id, quoteName: quote.client_name })} className="p-1 text-rose-100 hover:text-red-500">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Value */}
                    {Number(quote.total_value) > 0
                      ? <p className="font-lora font-bold text-[#D14237] text-sm leading-tight">{fmt(Number(quote.total_value))}</p>
                      : <p className="text-[10px] text-rose-200 italic">Valor não calculado</p>
                    }

                    {/* Meta row */}
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] font-dm text-rose-400">
                      <span className="flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[11px]">calendar_today</span>
                        {quote.event_date ? new Date(quote.event_date + "T00:00:00").toLocaleDateString("pt-BR").slice(0, 5) : "—"}
                      </span>
                      {quote.event_date && (() => {
                        const days = Math.ceil((new Date(quote.event_date + "T00:00:00").getTime() - Date.now()) / 86400000);
                        const cls = days < 0 ? "text-gray-300" : days <= 7 ? "text-red-500 font-bold" : days <= 30 ? "text-amber-500 font-bold" : "text-rose-400";
                        return (
                          <span className={`flex items-center gap-0.5 ${cls}`}>
                            <span className="material-symbols-outlined text-[11px]">schedule</span>
                            {days < 0 ? `${Math.abs(days)}d atrás` : days === 0 ? "hoje" : `${days}d`}
                          </span>
                        );
                      })()}
                      <span className="flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[11px]">groups</span>
                        {quote.guests}
                      </span>
                      <span className="ml-auto font-medium text-rose-300 truncate max-w-[60px]">
                        {creatorLabel(quote.created_by)}
                      </span>
                    </div>

                    {/* Win / Lose buttons */}
                    <div className="flex gap-1.5 mt-2 pt-2 border-t border-rose-50">
                      <button
                        onClick={() => markGanho(quote.id)}
                        className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-bold font-dm text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-100 transition-all"
                      >
                        <CheckCircle size={10} /> Ganho
                      </button>
                      <button
                        onClick={() => { setLostModal({ open: true, quoteId: quote.id }); setSelectedReason(""); setCustomReason(""); }}
                        className="flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-bold font-dm text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-100 transition-all"
                      >
                        <XCircle size={10} /> Perdido
                      </button>
                    </div>
                  </div>
                ))}

                {colQuotes.length === 0 && (
                  <div className="h-16 border-2 border-dashed border-rose-100 rounded-xl flex items-center justify-center text-rose-200 text-xs font-dm">
                    Solte aqui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

}
