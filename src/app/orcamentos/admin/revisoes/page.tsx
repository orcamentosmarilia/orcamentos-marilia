"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/Notify";
import PageHeader from "@/components/PageHeader";
import {
  Loader2, MessageSquare, ChevronRight, CheckCircle2, XCircle,
  Clock, Send, Sparkles, AlertTriangle, User, X, ChevronDown, ChevronUp
} from "lucide-react";

interface ReasoningItem {
  item: string;
  calculation: string;
  rule_applied: string;
  choice_reason: string;
}

interface Quote {
  id: string;
  client_name: string;
  event_date: string;
  guests: number;
  created_at: string;
  ai_system_prompt: string | null;
  ai_raw_output: string | null;
  ai_rules_snapshot: any[] | null;
  ai_reasoning: ReasoningItem[] | null;
  internal_feedback: string | null;
  internal_feedback_at: string | null;
  status: string;
}

interface Correction {
  id: string;
  quote_id: string;
  admin_message: string;
  ai_suggestion: string | null;
  affected_rule_id: string | null;
  affected_rule_title?: string;
  new_rule_content: string | null;
  status: string;
  created_at: string;
}

interface AISuggestion {
  analysis: string;
  affected_rule_id: string | null;
  affected_rule_title: string;
  new_rule_content: string | null;
  explanation: string;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  rascunho:   { label: "Rascunho",   color: "bg-gray-100 text-gray-500" },
  aguardando: { label: "Aguardando", color: "bg-rose-50 text-rose-500" },
  aprovado:   { label: "Aprovado",   color: "bg-green-50 text-green-600" },
  perdido:    { label: "Perdido",    color: "bg-red-50 text-red-500" },
  realizado:  { label: "Realizado",  color: "bg-blue-50 text-blue-600" },
};

export default function RevisoesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Quote | null>(null);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [adminMessage, setAdminMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<{ correctionId: string; suggestion: AISuggestion } | null>(null);
  const [applying, setApplying] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showRawOutput, setShowRawOutput] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);

  useEffect(() => { fetchQuotes(); }, []);

  async function fetchQuotes() {
    const { data } = await supabase
      .from("quotes")
      .select("id,client_name,event_date,guests,created_at,status,ai_system_prompt,ai_raw_output,ai_rules_snapshot,ai_reasoning,internal_feedback,internal_feedback_at")
      .not("ai_raw_output", "is", null)
      .order("created_at", { ascending: false });
    setQuotes(data || []);
    setLoading(false);
  }

  async function fetchCorrections(quoteId: string) {
    const { data } = await supabase
      .from("ai_corrections")
      .select("*")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: true });
    setCorrections(data || []);
  }

  function selectQuote(q: Quote) {
    setSelected(q);
    setPendingSuggestion(null);
    setAdminMessage("");
    setShowRules(false);
    setShowRawOutput(false);
    setShowReasoning(true);
    fetchCorrections(q.id);
  }

  async function sendCorrection() {
    if (!selected || !adminMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: selected.id, admin_message: adminMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPendingSuggestion({ correctionId: data.correction_id, suggestion: data.suggestion });
      setAdminMessage("");
      fetchCorrections(selected.id);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally { setSending(false); }
  }

  async function applyCorrection(correctionId: string) {
    setApplying(true);
    try {
      const res = await fetch("/api/correction", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correction_id: correctionId }),
      });
      if (!res.ok) throw new Error("Erro ao aplicar correção");
      setPendingSuggestion(null);
      fetchCorrections(selected!.id);
      toast.success("Regra atualizada com sucesso!");
    } catch (err: any) { toast.error(err.message); }
    finally { setApplying(false); }
  }

  async function rejectCorrection(correctionId: string) {
    await fetch("/api/correction", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correction_id: correctionId }),
    });
    setPendingSuggestion(null);
    fetchCorrections(selected!.id);
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader
        title="Revisões de IA"
        description="Analise gerações, corrija erros e aprove melhorias nas regras de negócio."
      />

      <div className="flex gap-6 h-[calc(100vh-210px)]">

        {/* ── Lista de orçamentos gerados ── */}
        <div className="w-80 flex-shrink-0 bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-rose-50">
            <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
              Gerados pela IA ({quotes.length})
            </p>
          </div>
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            {loading ? (
              <div className="flex items-center justify-center p-8"><Loader2 className="animate-spin text-rose-300" size={24} /></div>
            ) : quotes.length === 0 ? (
              <p className="text-sm text-rose-300 text-center p-8 font-dm">Nenhum orçamento gerado pela IA ainda.</p>
            ) : quotes.map(q => (
              <button
                key={q.id}
                onClick={() => selectQuote(q)}
                className={`w-full text-left px-4 py-3.5 border-b border-rose-50 hover:bg-rose-50/50 transition-colors ${selected?.id === q.id ? "bg-rose-50 border-l-2 border-l-[#D14237]" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-[#5C1F2E] truncate">{q.client_name}</p>
                    <p className="text-[11px] text-rose-400 mt-0.5">{fmtDate(q.event_date)} · {q.guests} pax</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${STATUS_LABEL[q.status]?.color || "bg-gray-100 text-gray-400"}`}>
                      {STATUS_LABEL[q.status]?.label || q.status}
                    </span>
                    {q.internal_feedback && (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">
                        <MessageSquare size={9} /> Feedback
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Painel de revisão ── */}
        {!selected ? (
          <div className="flex-1 bg-white rounded-2xl border border-rose-100 shadow-sm flex items-center justify-center">
            <div className="text-center">
              <Sparkles className="text-rose-200 mx-auto mb-3" size={40} />
              <p className="font-dm text-rose-300 text-sm">Selecione um orçamento para revisar</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">

            {/* Cabeçalho do orçamento */}
            <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-lora text-lg font-bold text-[#5C1F2E]">{selected.client_name}</h2>
                  <p className="text-xs text-rose-400 font-dm mt-0.5">
                    {fmtDate(selected.event_date)} · {selected.guests} convidados · Gerado em {fmtDate(selected.created_at)} às {fmtTime(selected.created_at)}
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="text-rose-200 hover:text-rose-400 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Feedback interno do usuário */}
              {selected.internal_feedback && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <User size={14} className="text-amber-600" />
                    <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Feedback Interno</p>
                    {selected.internal_feedback_at && (
                      <span className="text-[10px] text-amber-500 ml-auto">{fmtDate(selected.internal_feedback_at)} {fmtTime(selected.internal_feedback_at)}</span>
                    )}
                  </div>
                  <p className="text-sm text-amber-900 font-dm leading-relaxed">{selected.internal_feedback}</p>
                </div>
              )}

              {/* Raciocínio da IA por item */}
              {selected.ai_reasoning && selected.ai_reasoning.length > 0 && (
                <div className="mt-4">
                  <button onClick={() => setShowReasoning(v => !v)} className="flex items-center gap-2 text-[11px] font-bold text-rose-400 hover:text-[#5C1F2E] transition-colors uppercase tracking-wider">
                    {showReasoning ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    Raciocínio da IA ({selected.ai_reasoning.length} itens)
                  </button>
                  {showReasoning && (
                    <div className="mt-3 space-y-2">
                      {selected.ai_reasoning.map((r, i) => (
                        <div key={i} className="p-3 rounded-xl border border-rose-100 bg-[#FAF5F3] flex gap-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-[#5C1F2E] flex items-center justify-center text-[11px] font-bold font-dm">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold font-dm text-[12px] text-[#5C1F2E] mb-1">{r.item}</p>
                            {r.calculation && (
                              <pre className="text-[11px] font-mono text-rose-700/90 leading-relaxed mb-1.5 whitespace-pre-wrap break-words bg-white/60 rounded-lg p-2 border border-rose-50">{r.calculation}</pre>
                            )}
                            {r.choice_reason && (
                              <p className="text-[11px] text-rose-500/70 font-dm italic leading-relaxed">{r.choice_reason}</p>
                            )}
                            {r.rule_applied && (
                              <p className="text-[10px] text-rose-300 mt-1.5 font-dm uppercase tracking-wide">Regra: {r.rule_applied}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Regras usadas — colapsável */}
              {selected.ai_rules_snapshot && selected.ai_rules_snapshot.length > 0 && (
                <div className="mt-3">
                  <button onClick={() => setShowRules(v => !v)} className="flex items-center gap-2 text-[11px] font-bold text-rose-400 hover:text-[#5C1F2E] transition-colors uppercase tracking-wider">
                    {showRules ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    Regras usadas ({selected.ai_rules_snapshot.length})
                  </button>
                  {showRules && (
                    <div className="mt-3 space-y-2">
                      {selected.ai_rules_snapshot.map((r: any) => (
                        <div key={r.id} className={`p-3 rounded-xl border text-xs font-mono leading-relaxed ${r.active ? "bg-[#FAF5F3] border-rose-100 text-[#5C1F2E]/80" : "bg-gray-50 border-gray-100 text-gray-400 opacity-60"}`}>
                          <p className="font-bold font-dm text-[11px] mb-1 uppercase tracking-wide">{r.title}{!r.active && " (inativa)"}</p>
                          <pre className="whitespace-pre-wrap">{r.content}</pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Output bruto — colapsável */}
              {selected.ai_raw_output && (
                <div className="mt-3">
                  <button onClick={() => setShowRawOutput(v => !v)} className="flex items-center gap-2 text-[11px] font-bold text-rose-400 hover:text-[#5C1F2E] transition-colors uppercase tracking-wider">
                    {showRawOutput ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    Output bruto da IA
                  </button>
                  {showRawOutput && (
                    <pre className="mt-3 p-3 bg-gray-50 border border-gray-100 rounded-xl text-[11px] font-mono text-gray-600 whitespace-pre-wrap overflow-x-auto leading-relaxed">
                      {selected.ai_raw_output}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Histórico de correções */}
            {corrections.length > 0 && (
              <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
                <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider mb-3">Histórico de Correções</p>
                <div className="space-y-3">
                  {corrections.map(c => (
                    <div key={c.id} className="border border-rose-50 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-[#FAF5F3]">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-dm text-[#5C1F2E] leading-relaxed">{c.admin_message}</p>
                          <span className={`flex-shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
                            c.status === "approved" ? "bg-green-50 text-green-600 border border-green-100" :
                            c.status === "rejected" ? "bg-red-50 text-red-500 border border-red-100" :
                            "bg-amber-50 text-amber-600 border border-amber-100"
                          }`}>
                            {c.status === "approved" ? <CheckCircle2 size={10} /> : c.status === "rejected" ? <XCircle size={10} /> : <Clock size={10} />}
                            {c.status === "approved" ? "Aprovada" : c.status === "rejected" ? "Rejeitada" : "Pendente"}
                          </span>
                        </div>
                      </div>
                      {c.ai_suggestion && (
                        <div className="px-4 py-3 bg-white text-xs text-rose-500/80 font-dm leading-relaxed border-t border-rose-50">
                          <span className="font-bold text-rose-400">IA: </span>{c.ai_suggestion}
                          {c.affected_rule_id && <span className="ml-2 text-[10px] bg-rose-50 text-rose-400 px-1.5 py-0.5 rounded-md border border-rose-100">Regra {c.affected_rule_id}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sugestão pendente de aprovação */}
            {pendingSuggestion && (
              <div className="bg-white rounded-2xl border-2 border-[#D14237]/20 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-[#D14237]" />
                  <p className="text-[12px] font-bold text-[#5C1F2E] uppercase tracking-wider">Sugestão da IA</p>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-rose-50/50 rounded-xl">
                    <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Análise</p>
                    <p className="text-sm font-dm text-[#5C1F2E] leading-relaxed">{pendingSuggestion.suggestion.analysis}</p>
                  </div>

                  {pendingSuggestion.suggestion.affected_rule_id && (
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">
                        Regra afetada: {pendingSuggestion.suggestion.affected_rule_title || `Regra ${pendingSuggestion.suggestion.affected_rule_id}`}
                      </p>
                      <p className="text-[11px] font-dm text-amber-800 leading-relaxed">{pendingSuggestion.suggestion.explanation}</p>
                    </div>
                  )}

                  {pendingSuggestion.suggestion.new_rule_content && (
                    <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
                      <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-2">Novo conteúdo proposto</p>
                      <pre className="text-[11px] font-mono text-green-800 whitespace-pre-wrap leading-relaxed">{pendingSuggestion.suggestion.new_rule_content}</pre>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => rejectCorrection(pendingSuggestion.correctionId)}
                      className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                    >
                      <XCircle size={15} /> Rejeitar
                    </button>
                    <button
                      onClick={() => applyCorrection(pendingSuggestion.correctionId)}
                      disabled={applying || !pendingSuggestion.suggestion.new_rule_content}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#5C1F2E] hover:bg-[#4A1925] disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors"
                    >
                      {applying ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                      {applying ? "Aplicando..." : "Aprovar e atualizar regra"}
                    </button>
                  </div>

                  {!pendingSuggestion.suggestion.new_rule_content && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                      <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                      <p className="text-xs font-dm text-amber-700">A IA não conseguiu gerar uma sugestão específica. Considere ajustar a regra manualmente nas Configurações.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Input de nova correção */}
            <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
              <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider mb-3">Enviar correção para a IA</p>
              <p className="text-xs font-dm text-rose-300 mb-3 leading-relaxed">
                Descreva o que está errado no orçamento e por quê. A IA vai analisar e sugerir uma melhoria na regra correspondente.
              </p>
              <textarea
                value={adminMessage}
                onChange={e => setAdminMessage(e.target.value)}
                rows={4}
                className="w-full border border-rose-100 rounded-xl p-3 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#D14237] leading-relaxed placeholder:text-rose-200 resize-none"
                placeholder="Ex: A IA adicionou bolo para 30 pessoas, mas pela Regra 6 o bolo extra só é necessário quando o resto é ≥ 13. Para 30 pessoas: n_grandes=0, resto=30, portanto seria +1 bolo 650g, não 2 bolos..."
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={sendCorrection}
                  disabled={sending || !adminMessage.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#D14237] hover:bg-[#B83530] disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors"
                >
                  {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {sending ? "Analisando..." : "Enviar para IA"}
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
