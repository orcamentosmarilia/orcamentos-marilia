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

  const [calc, setCalc] = useState<any>(null);
  const [modal, setModal] = useState<any>(null);
  const [comp, setComp] = useState<any>(null);
  const [drinks, setDrinks] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [status, setStatus] = useState<any[]>([]);
  const [aiExcl, setAiExcl] = useState<string[]>([]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const keys = ["calculation_rules", "modalidade_config", "composition_rules", "drink_mappings", "pipeline_stages", "quote_form_config", "status_config", "ai_exclusions"];
    const { data } = await supabase.from("settings").select("key,value").in("key", keys);
    const map: Record<string, any> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value; });
    setCalc(map.calculation_rules || {});
    setModal(map.modalidade_config || { modalidades: [] });
    setComp(map.composition_rules || {});
    setDrinks(Array.isArray(map.drink_mappings) ? map.drink_mappings : []);
    setStages(Array.isArray(map.pipeline_stages) ? map.pipeline_stages : []);
    setForm(map.quote_form_config || {});
    setStatus(Array.isArray(map.status_config) ? map.status_config : []);
    setAiExcl(Array.isArray(map.ai_exclusions) ? map.ai_exclusions : []);
    setLoading(false);
  }

  async function saveAll() {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const rows = [
        { key: "calculation_rules", value: calc, updated_at: now },
        { key: "modalidade_config", value: modal, updated_at: now },
        { key: "composition_rules", value: comp, updated_at: now },
        { key: "drink_mappings", value: drinks, updated_at: now },
        { key: "pipeline_stages", value: stages, updated_at: now },
        { key: "quote_form_config", value: form, updated_at: now },
        { key: "status_config", value: status, updated_at: now },
        { key: "ai_exclusions", value: aiExcl, updated_at: now },
      ];
      const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
      if (error) throw error;
      toast.success("Regras do sistema salvas!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally { setSaving(false); }
  }

  // helpers de atualização imutável
  const setCalcPath = (section: string, key: string, val: any) =>
    setCalc((p: any) => ({ ...p, [section]: { ...(p?.[section] || {}), [key]: val } }));

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
          <div><label className={lbl}>Materiais</label><StrList items={form?.materials || []} onChange={v => setForm((p: any) => ({ ...p, materials: v }))} placeholder="Ex: Louça" /></div>
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
          <div>
            <label className={lbl}>Copo de vidro — palavras no nome do serviço</label>
            <StrList items={form?.cup_replacements?.glass || []} onChange={v => setForm((p: any) => ({ ...p, cup_replacements: { ...(p.cup_replacements || {}), glass: v } }))} placeholder="Ex: vidro" />
          </div>
          <div>
            <label className={lbl}>Xícara de porcelana — palavras no nome do serviço</label>
            <StrList items={form?.cup_replacements?.porcelain || []} onChange={v => setForm((p: any) => ({ ...p, cup_replacements: { ...(p.cup_replacements || {}), porcelain: v } }))} placeholder="Ex: porcelana" />
          </div>
        </div>
      </section>

      {/* CONSUMO POR DURAÇÃO */}
      <section className={card}>
        <div className="mb-5 pb-4 border-b border-[var(--color-brand-pink2)]">
          <h2 className={h2}>Consumo por Duração</h2>
          <p className={sub}>Unidades de comida por pessoa conforme a duração do evento.</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_110px_110px_32px] gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <span>Rótulo</span><span>Até (horas)</span><span>Un/pessoa</span><span></span>
          </div>
          {(calc?.consumption || []).map((c: any, i: number) => (
            <div key={i} className="grid grid-cols-[1fr_110px_110px_32px] gap-2 items-center">
              <Txt value={c.label} onChange={v => setCalc((p: any) => ({ ...p, consumption: p.consumption.map((x: any, j: number) => j === i ? { ...x, label: v } : x) }))} />
              <Num step={0.5} value={c.max_hours} onChange={v => setCalc((p: any) => ({ ...p, consumption: p.consumption.map((x: any, j: number) => j === i ? { ...x, max_hours: v } : x) }))} />
              <Num value={c.units_per_person} onChange={v => setCalc((p: any) => ({ ...p, consumption: p.consumption.map((x: any, j: number) => j === i ? { ...x, units_per_person: v } : x) }))} />
              <button onClick={() => setCalc((p: any) => ({ ...p, consumption: p.consumption.filter((_: any, j: number) => j !== i) }))} className="text-rose-300 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
          ))}
          <button onClick={() => setCalc((p: any) => ({ ...p, consumption: [...(p.consumption || []), { label: "", max_hours: 99, units_per_person: 10 }] }))} className="self-start text-[11px] font-bold text-[var(--color-brand-red)] flex items-center gap-1"><Plus size={13} /> Faixa</button>
        </div>
      </section>

      {/* ARREDONDAMENTOS */}
      <section className={card}>
        <div className="mb-5 pb-4 border-b border-[var(--color-brand-pink2)]">
          <h2 className={h2}>Arredondamentos</h2>
          <p className={sub}>Múltiplos de arredondamento de comida, copos e guardanapos.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className={lbl}>Comida (múltiplo)</label><Num value={calc?.rounding?.food_multiple} onChange={v => setCalcPath("rounding", "food_multiple", v)} /></div>
        </div>
        <p className="text-[11px] text-rose-400 mt-3">Acessórios, descartáveis e bolo agora são configurados em <b>Dependências de Produtos</b> (abaixo).</p>
      </section>

      {/* MODALIDADES */}
      <section className={card}>
        <div className="mb-5 pb-4 border-b border-[var(--color-brand-pink2)]">
          <h2 className={h2}>Modalidades de Cardápio</h2>
          <p className={sub}>Divisão por tier (% Econômico/Elaborado) e exigência de crocante.</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_100px_100px_110px_32px] gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <span>Nome</span><span>% Econ.</span><span>% Elab.</span><span>Crocante</span><span></span>
          </div>
          {(modal?.modalidades || []).map((m: any, i: number) => {
            const upd = (patch: any) => setModal((p: any) => ({ ...p, modalidades: p.modalidades.map((x: any, j: number) => j === i ? { ...x, ...patch } : x) }));
            return (
              <div key={i} className="grid grid-cols-[1fr_100px_100px_110px_32px] gap-2 items-center">
                <Txt value={m.name} onChange={v => upd({ name: v })} />
                <Num value={Math.round((m.tier_split?.["Econômico"] ?? 0) * 100)} onChange={v => upd({ tier_split: { "Econômico": v / 100, "Elaborado": 1 - v / 100 } })} />
                <Num value={Math.round((m.tier_split?.["Elaborado"] ?? 0) * 100)} onChange={v => upd({ tier_split: { "Elaborado": v / 100, "Econômico": 1 - v / 100 } })} />
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!m.requires_crocante} onChange={e => upd({ requires_crocante: e.target.checked })} /> exige</label>
                <button onClick={() => setModal((p: any) => ({ ...p, modalidades: p.modalidades.filter((_: any, j: number) => j !== i) }))} className="text-rose-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            );
          })}
          <button onClick={() => setModal((p: any) => ({ ...p, modalidades: [...(p.modalidades || []), { name: "", tier_split: { "Econômico": 1, "Elaborado": 0 }, requires_crocante: false }] }))} className="self-start text-[11px] font-bold text-[var(--color-brand-red)] flex items-center gap-1"><Plus size={13} /> Modalidade</button>
        </div>
      </section>

      {/* COMPOSIÇÃO MÍNIMA */}
      <section className={card}>
        <div className="mb-5 pb-4 border-b border-[var(--color-brand-pink2)]">
          <h2 className={h2}>Composição Mínima</h2>
          <p className={sub}>Itens/formatos/sabores obrigatórios e restrições por período.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div><label className={lbl}>Itens obrigatórios</label><StrList items={comp?.mandatory_items || []} onChange={v => setComp((p: any) => ({ ...p, mandatory_items: v }))} /></div>
          <div><label className={lbl}>Formatos obrigatórios</label><StrList items={comp?.mandatory_formats || []} onChange={v => setComp((p: any) => ({ ...p, mandatory_formats: v }))} /></div>
          <div><label className={lbl}>Sabores obrigatórios</label><StrList items={comp?.mandatory_flavors || []} onChange={v => setComp((p: any) => ({ ...p, mandatory_flavors: v }))} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm mt-4 font-dm text-[#5C1F2E]">
          <input type="checkbox" checked={!!comp?.include_sandwich} onChange={e => setComp((p: any) => ({ ...p, include_sandwich: e.target.checked }))} /> Incluir sempre ao menos 1 sanduíche
        </label>
        <div className="mt-4">
          <label className={lbl}>Restrições por período</label>
          <div className="flex flex-col gap-2">
            {Object.entries(comp?.period_restrictions || {}).map(([period, text]: any) => (
              <div key={period} className="grid grid-cols-[110px_1fr] gap-2 items-start">
                <span className="text-xs font-bold text-rose-500 pt-2">{period}</span>
                <textarea value={text} rows={2} onChange={e => setComp((p: any) => ({ ...p, period_restrictions: { ...p.period_restrictions, [period]: e.target.value } }))} className={inp} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BEBIDAS */}
      <section className={card}>
        <div className="mb-5 pb-4 border-b border-[var(--color-brand-pink2)]">
          <h2 className={h2}>Mapa de Bebidas</h2>
          <p className={sub}>Bebida → produto do catálogo, quantidade e o que ela dispara.</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_1fr_70px_70px_90px_32px] gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <span>Rótulo</span><span>Produto</span><span>Café?</span><span>Frio?</span><span>1 a cada</span><span></span>
          </div>
          {drinks.map((d, i) => {
            const upd = (patch: any) => setDrinks(prev => prev.map((x, j) => j === i ? { ...x, ...patch } : x));
            return (
              <div key={i} className="grid grid-cols-[1fr_1fr_70px_70px_90px_32px] gap-2 items-center">
                <Txt value={d.label} onChange={v => upd({ label: v })} />
                <Txt value={d.productName} onChange={v => upd({ productName: v })} />
                <input type="checkbox" checked={!!d.counts_as_coffee} onChange={e => upd({ counts_as_coffee: e.target.checked })} className="justify-self-center" />
                <input type="checkbox" checked={!!d.counts_as_cold_drink} onChange={e => upd({ counts_as_cold_drink: e.target.checked })} className="justify-self-center" />
                <Num value={d.guests_per_unit} onChange={v => upd({ guests_per_unit: v })} />
                <button onClick={() => setDrinks(prev => prev.filter((_, j) => j !== i))} className="text-rose-300 hover:text-red-500"><Trash2 size={14} /></button>
              </div>
            );
          })}
          <button onClick={() => setDrinks(prev => [...prev, { id: `drink_${Date.now()}`, label: "", productName: "", counts_as_coffee: false, counts_as_cold_drink: false, guests_per_unit: 10 }])} className="self-start text-[11px] font-bold text-[var(--color-brand-red)] flex items-center gap-1"><Plus size={13} /> Bebida</button>
        </div>
      </section>

      {/* ETAPAS DO KANBAN */}
      <section className={card}>
        <div className="mb-5 pb-4 border-b border-[var(--color-brand-pink2)]">
          <h2 className={h2}>Etapas do Kanban</h2>
          <p className={sub}>Colunas do pipeline (as marcadas como padrão não podem ser removidas).</p>
        </div>
        <div className="flex flex-col gap-2">
          {stages.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_32px] gap-2 items-center">
              <Txt value={s.title} onChange={v => setStages(prev => prev.map((x, j) => j === i ? { ...x, title: v } : x))} />
              {s.isDefault ? <span className="text-[9px] text-rose-300 uppercase">fixa</span> :
                <button onClick={() => setStages(prev => prev.filter((_, j) => j !== i))} className="text-rose-300 hover:text-red-500"><Trash2 size={14} /></button>}
            </div>
          ))}
          <button onClick={() => setStages(prev => [...prev, { id: `stage_${Date.now()}`, title: "" }])} className="self-start text-[11px] font-bold text-[var(--color-brand-red)] flex items-center gap-1"><Plus size={13} /> Etapa</button>
        </div>
      </section>

      {/* STATUS */}
      <section className={card}>
        <div className="mb-5 pb-4 border-b border-[var(--color-brand-pink2)]">
          <h2 className={h2}>Rótulos e Cores de Status</h2>
          <p className={sub}>Como cada status aparece (rótulo, cor e se encerra o funil).</p>
        </div>
        <div className="flex flex-col gap-2">
          {status.map((s, i) => {
            const upd = (patch: any) => setStatus(prev => prev.map((x, j) => j === i ? { ...x, ...patch } : x));
            return (
              <div key={i} className="grid grid-cols-[120px_1fr_60px_110px] gap-2 items-center">
                <span className="text-xs font-mono text-rose-400">{s.id}</span>
                <Txt value={s.label} onChange={v => upd({ label: v })} />
                <input type="color" value={s.color} onChange={e => upd({ color: e.target.value })} className="w-full h-9 rounded-lg border border-rose-100" />
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={!!s.isTerminal} onChange={e => upd({ isTerminal: e.target.checked })} /> encerra</label>
              </div>
            );
          })}
        </div>
      </section>

      {/* EXCLUSÕES DA IA */}
      <section className={card}>
        <div className="mb-5 pb-4 border-b border-[var(--color-brand-pink2)]">
          <h2 className={h2}>Exclusões da IA</h2>
          <p className={sub}>Itens que a IA nunca deve incluir no cardápio (serviços externos já calculados).</p>
        </div>
        <StrList items={aiExcl} onChange={setAiExcl} placeholder="Ex: garçom" />
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
