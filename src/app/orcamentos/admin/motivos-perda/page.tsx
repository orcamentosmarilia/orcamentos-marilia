"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Trash2, Loader2, TrendingDown } from "lucide-react";
import PageHeader from "@/components/PageHeader";

interface LossReason {
  id: string;
  reason: string;
  is_active: boolean;
  created_at: string;
  count?: number;
}

export default function MotivosPerda() {
  const [reasons, setReasons] = useState<LossReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [newReason, setNewReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [{ data: reasonsData }, { data: quotesData }] = await Promise.all([
        supabase.from("loss_reasons").select("*").order("reason"),
        supabase.from("quotes").select("lost_reason").eq("status", "perdido"),
      ]);

      const counts: Record<string, number> = {};
      (quotesData || []).forEach((q: any) => {
        if (q.lost_reason) counts[q.lost_reason] = (counts[q.lost_reason] || 0) + 1;
      });

      setReasons((reasonsData || []).map((r: any) => ({ ...r, count: counts[r.reason] || 0 })));
    } finally {
      setLoading(false);
    }
  }

  async function addReason() {
    const text = newReason.trim();
    if (!text) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("loss_reasons").insert({ reason: text });
      if (error) throw error;
      setNewReason("");
      fetchData();
    } catch (err: any) {
      alert("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleReason(id: string, current: boolean) {
    await supabase.from("loss_reasons").update({ is_active: !current }).eq("id", id);
    fetchData();
  }

  async function deleteReason(id: string) {
    if (!confirm("Remover este motivo permanentemente?")) return;
    await supabase.from("loss_reasons").delete().eq("id", id);
    fetchData();
  }

  // Stats from all lost quotes
  const total = reasons.reduce((s, r) => s + (r.count || 0), 0);

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      <PageHeader
        title="Motivos de Perda"
        description="Gerencie os motivos registrados quando um orçamento é marcado como perdido."
      />

      {/* Add new */}
      <div className="bg-white rounded-2xl shadow-sm border border-rose-50 p-6">
        <h2 className="font-lora text-lg font-bold text-[#5C1F2E] mb-4">Adicionar motivo</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={newReason}
            onChange={e => setNewReason(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addReason()}
            placeholder="Ex.: Preço fora do orçamento do cliente..."
            className="flex-1 border border-rose-100 rounded-xl px-4 py-2.5 text-sm font-dm focus:outline-none focus:border-[#5C1F2E] text-[#5C1F2E] placeholder:text-rose-200"
          />
          <button
            onClick={addReason}
            disabled={saving || !newReason.trim()}
            className="bg-[#5C1F2E] hover:bg-[#4A1925] disabled:opacity-40 text-white px-5 py-2.5 rounded-xl font-dm font-bold text-sm flex items-center gap-2 transition-all"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Adicionar
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-rose-50 overflow-hidden">
        <div className="px-6 py-4 border-b border-rose-50 flex items-center justify-between">
          <h2 className="font-lora text-lg font-bold text-[#5C1F2E]">Motivos cadastrados</h2>
          {total > 0 && (
            <span className="text-xs font-dm text-rose-400">{total} perda{total !== 1 ? "s" : ""} registrada{total !== 1 ? "s" : ""}</span>
          )}
        </div>

        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-rose-300" size={24} /></div>
        ) : reasons.length === 0 ? (
          <div className="p-10 text-center text-rose-300 font-dm text-sm">Nenhum motivo cadastrado.</div>
        ) : (
          <div className="divide-y divide-rose-50">
            {reasons.map(r => {
              const pct = total > 0 ? Math.round(((r.count || 0) / total) * 100) : 0;
              return (
                <div key={r.id} className={`flex items-center gap-4 px-6 py-4 ${!r.is_active ? "opacity-40" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-dm font-bold text-sm text-[#5C1F2E] truncate">{r.reason}</p>
                    {r.count ? (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 bg-rose-50 rounded-full overflow-hidden w-32">
                          <div className="h-full bg-slate-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] font-dm text-rose-400">{r.count}× ({pct}%)</span>
                      </div>
                    ) : (
                      <p className="text-[11px] font-dm text-rose-200 mt-0.5">Nunca usado</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleReason(r.id, r.is_active)}
                      className={`text-[10px] font-dm font-bold px-3 py-1.5 rounded-lg border transition-all ${
                        r.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {r.is_active ? "Ativo" : "Inativo"}
                    </button>
                    <button
                      onClick={() => deleteReason(r.id)}
                      className="p-2 text-rose-200 hover:text-red-500 hover:bg-rose-50 rounded-lg transition-all"
                      title="Excluir permanentemente"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Frequency chart */}
      {total > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-rose-50 p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingDown size={18} className="text-slate-500" />
            <h2 className="font-lora text-lg font-bold text-[#5C1F2E]">Frequência de perdas</h2>
          </div>
          <div className="flex flex-col gap-3">
            {[...reasons]
              .filter(r => (r.count || 0) > 0)
              .sort((a, b) => (b.count || 0) - (a.count || 0))
              .map(r => {
                const pct = Math.round(((r.count || 0) / total) * 100);
                return (
                  <div key={r.id}>
                    <div className="flex justify-between text-xs font-dm mb-1">
                      <span className="text-[#5C1F2E] font-medium truncate pr-4">{r.reason}</span>
                      <span className="text-rose-400 flex-shrink-0">{r.count}× — {pct}%</span>
                    </div>
                    <div className="h-2 bg-rose-50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: "#64748B" }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
