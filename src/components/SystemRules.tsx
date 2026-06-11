"use client";

// ──────────────────────────────────────────────────────────────────────────
// Editor único de TODAS as regras do sistema (tabela settings).
// Centraliza o que antes estava escondido no banco ou chumbado no código.
// Carrega e salva: calculation_rules (consumo/arredondamento/bolo/acessórios),
// modalidade_config, composition_rules, drink_mappings, pipeline_stages,
// quote_form_config, status_config, ai_exclusions.
// ──────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/Notify";
import { Loader2, Save, Plus, Trash2 } from "lucide-react";

const card = "bg-white rounded-3xl shadow-sm border border-[var(--color-brand-pink2)] p-8";
const h2 = "font-lora text-xl font-bold text-[#5C1F2E]";
const sub = "text-xs text-rose-400 mt-0.5";
const lbl = "text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block";
const inp = "w-full border border-rose-100 rounded-lg px-3 py-2 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[var(--color-brand-red)]";

function Num({ value, onChange, step = 1, min }: { value: any; onChange: (n: number) => void; step?: number; min?: number }) {
  return (
    <input type="number" step={step} min={min} value={value ?? ""} onChange={e => onChange(parseFloat(e.target.value) || 0)} className={inp} />
  );
}

function Txt({ value, onChange, placeholder }: { value: any; onChange: (s: string) => void; placeholder?: string }) {
  return <input type="text" value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} className={inp} />;
}

// Editor de lista de strings (períodos, materiais, fontes, exclusões…)
function StrList({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {items.map((it, i) => (
          <span key={i} className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-full pl-3 pr-1 py-1 text-xs font-dm text-rose-600">
            {it}
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-rose-300 hover:text-red-500"><Trash2 size={12} /></button>
          </span>
        ))}
        {items.length === 0 && <span className="text-xs text-rose-300 italic">Nenhum item.</span>}
      </div>
      <div className="flex gap-2">
        <input value={draft} placeholder={placeholder} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && draft.trim()) { onChange([...items, draft.trim()]); setDraft(""); } }}
          className={inp} />
        <button onClick={() => { if (draft.trim()) { onChange([...items, draft.trim()]); setDraft(""); } }}
          className="px-3 py-2 bg-rose-50 text-[var(--color-brand-red)] rounded-lg border border-rose-100 hover:bg-rose-100"><Plus size={14} /></button>
      </div>
    </div>
  );
}

export default function SystemRules() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<any>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("settings").select("value").eq("key", "quote_form_config").single();
    setForm(data?.value || {});
    setLoading(false);
  }

  async function saveAll() {
    setSaving(true);
    try {
      const { error } = await supabase.from("settings").upsert(
        { key: "quote_form_config", value: form, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) throw error;
      toast.success("Regras do sistema salvas!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally { setSaving(false); }
  }

  if (loading) return <div className="p-8 text-center text-rose-300 font-dm">Carregando regras…</div>;

  return (
    <div className="flex flex-col gap-8">

      {/* SELEÇÕES DO ORÇAMENTO */}
      <section className={card}>
        <div className="mb-5 pb-4 border-b border-[var(--color-brand-pink2)]">
          <h2 className={h2}>Seleções do Orçamento</h2>
          <p className={sub}>Opções e limites de tudo que é selecionável ao criar um orçamento.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div><label className={lbl}>Períodos</label><StrList items={form?.periods || []} onChange={v => setForm((p: any) => ({ ...p, periods: v }))} placeholder="Ex: Manhã" /></div>
          <div><label className={lbl}>Materiais (Descartável/Louça)</label><StrList items={form?.materials || []} onChange={v => setForm((p: any) => ({ ...p, materials: v }))} placeholder="Ex: Louça" /></div>
          <div className="md:col-span-2"><label className={lbl}>Modalidades de cardápio (o que cada uma significa fica em Regras de Negócio)</label><StrList items={form?.modalidades || []} onChange={v => setForm((p: any) => ({ ...p, modalidades: v }))} placeholder="Ex: Econômico" /></div>
          <div className="md:col-span-2"><label className={lbl}>Fontes de Lead</label><StrList items={form?.lead_sources || []} onChange={v => setForm((p: any) => ({ ...p, lead_sources: v }))} placeholder="Ex: WhatsApp" /></div>
          <div>
            <label className={lbl}>Nº de pessoas (mín / máx / padrão)</label>
            <div className="grid grid-cols-3 gap-2">
              <Num value={form?.guests?.min} onChange={n => setForm((p: any) => ({ ...p, guests: { ...p.guests, min: n } }))} />
              <Num value={form?.guests?.max} onChange={n => setForm((p: any) => ({ ...p, guests: { ...p.guests, max: n } }))} />
              <Num value={form?.guests?.default} onChange={n => setForm((p: any) => ({ ...p, guests: { ...p.guests, default: n } }))} />
            </div>
          </div>
          <div>
            <label className={lbl}>Duração h (mín / máx / padrão)</label>
            <div className="grid grid-cols-3 gap-2">
              <Num step={0.5} value={form?.duration?.min} onChange={n => setForm((p: any) => ({ ...p, duration: { ...p.duration, min: n } }))} />
              <Num step={0.5} value={form?.duration?.max} onChange={n => setForm((p: any) => ({ ...p, duration: { ...p.duration, max: n } }))} />
              <Num step={0.5} value={form?.duration?.default} onChange={n => setForm((p: any) => ({ ...p, duration: { ...p.duration, default: n } }))} />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className={lbl}>Opções de Espeto (rótulo / preço / qtd por pessoa)</label>
            <div className="flex flex-col gap-2">
              {(form?.skewer_options || []).map((s: any, i: number) => (
                <div key={i} className="grid grid-cols-[1fr_90px_90px_32px] gap-2 items-center">
                  <Txt value={s.label} onChange={v => setForm((p: any) => ({ ...p, skewer_options: p.skewer_options.map((x: any, j: number) => j === i ? { ...x, label: v } : x) }))} />
                  <Num step={0.5} value={s.price} onChange={v => setForm((p: any) => ({ ...p, skewer_options: p.skewer_options.map((x: any, j: number) => j === i ? { ...x, price: v } : x) }))} />
                  <Num step={0.5} value={s.qty_per_person} onChange={v => setForm((p: any) => ({ ...p, skewer_options: p.skewer_options.map((x: any, j: number) => j === i ? { ...x, qty_per_person: v } : x) }))} />
                  <button onClick={() => setForm((p: any) => ({ ...p, skewer_options: p.skewer_options.filter((_: any, j: number) => j !== i) }))} className="text-rose-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              ))}
              <button onClick={() => setForm((p: any) => ({ ...p, skewer_options: [...(p.skewer_options || []), { value: `opt_${Date.now()}`, label: "", price: 0, qty_per_person: 1 }] }))} className="self-start text-[11px] font-bold text-[var(--color-brand-red)] flex items-center gap-1"><Plus size={13} /> Opção</button>
            </div>
          </div>
        </div>
      </section>

      {/* SALVAR */}
      <div className="sticky bottom-8 flex justify-center">
        <button onClick={saveAll} disabled={saving} className="bg-[var(--color-brand-wine)] hover:bg-[#4A1926] disabled:opacity-50 text-white px-12 py-4 rounded-2xl font-dm font-bold text-base flex items-center gap-3 shadow-2xl transition-all hover:scale-105 active:scale-95">
          {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          {saving ? "Salvando..." : "Salvar Regras do Sistema"}
        </button>
      </div>
    </div>
  );
}
