"use client";

// ──────────────────────────────────────────────────────────────────────────
// Editor de DEPENDÊNCIAS de produtos — v2 (enxuto).
// Cada regra = Produto + Quantidade + (opcional) "Depende de" um produto/categoria.
// O tipo do material (descartável/louça) fica no cadastro do produto.
// Regras de bolo usam cake_rule.
// ──────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/Notify";
import { Loader2, Save, Plus, Trash2, PackagePlus } from "lucide-react";

const card = "bg-white rounded-3xl shadow-sm border border-[var(--color-brand-pink2)] p-8";
const lbl = "text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block";
const inp = "w-full border border-rose-100 rounded-lg px-3 py-2 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[var(--color-brand-red)]";

type Product = { id: string; name: string; category: string; unit: string; unit_price: number };

const QTY_BASES = [
  { v: "per_person", l: "Por pessoa" },
  { v: "per_food_unit", l: "Por unidade de comida" },
  { v: "per_event", l: "Por evento (fixo)" },
];

let tmpId = 0;
const newRule = () => ({
  _local: `tmp_${++tmpId}`, name: "", active: true, sort_order: 0,
  product_id: null, qty_base: "per_person", qty_factor: 1, qty_divisor: null,
  rounding_multiple: null, depends_on_product_id: null, depends_on_category: null, cake_rule: null,
});

export default function ProductDependencies() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<any[]>([]);
  const [deleted, setDeleted] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [draftProd, setDraftProd] = useState({ name: "", unit: "unidade", unit_price: 0 });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [dep, prod] = await Promise.all([
      supabase.from("product_dependencies").select("*").order("sort_order"),
      supabase.from("products").select("id,name,category,unit,unit_price").eq("is_active", true).order("name"),
    ]);
    if (dep.error) { setTableMissing(true); setLoading(false); return; }
    setRules((dep.data || []).map((r: any) => ({ ...r })));
    setProducts(prod.data || []);
    setCategories(Array.from(new Set((prod.data || []).map(p => p.category).filter(Boolean))).sort());
    setLoading(false);
  }

  const upd = (key: string, patch: any) =>
    setRules(prev => prev.map(r => (r.id || r._local) === key ? { ...r, ...patch } : r));

  // "Depende de" combinado: valor "prod:<id>" | "cat:<nome>" | ""
  const dependsValue = (r: any) => r.depends_on_product_id ? `prod:${r.depends_on_product_id}` : (r.depends_on_category ? `cat:${r.depends_on_category}` : "");
  const setDepends = (key: string, val: string) => {
    if (val.startsWith("prod:")) upd(key, { depends_on_product_id: val.slice(5), depends_on_category: null });
    else if (val.startsWith("cat:")) upd(key, { depends_on_category: val.slice(4), depends_on_product_id: null });
    else upd(key, { depends_on_product_id: null, depends_on_category: null });
  };

  async function createProduct(ruleKey: string) {
    if (!draftProd.name.trim()) { toast.error("Informe o nome do produto."); return; }
    const { data, error } = await supabase.from("products")
      .insert({ name: draftProd.name.trim(), category: "Materiais", unit: draftProd.unit || "unidade", unit_price: draftProd.unit_price || 0, is_active: true })
      .select("id,name,category,unit,unit_price").single();
    if (error) { toast.error("Erro ao criar produto: " + error.message); return; }
    setProducts(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    upd(ruleKey, { product_id: data.id });
    setCreatingFor(null);
    setDraftProd({ name: "", unit: "unidade", unit_price: 0 });
    toast.success("Produto criado e associado.");
  }

  async function saveAll() {
    setSaving(true);
    try {
      if (deleted.length) {
        const { error } = await supabase.from("product_dependencies").delete().in("id", deleted);
        if (error) throw error;
      }
      const clean = (r: any) => {
        const { _local, ...rest } = r;
        return rest;
      };
      const toInsert = rules.filter(r => !r.id).map(clean);
      const toUpdate = rules.filter(r => r.id).map(clean);
      if (toInsert.length) { const { error } = await supabase.from("product_dependencies").insert(toInsert); if (error) throw error; }
      if (toUpdate.length) { const { error } = await supabase.from("product_dependencies").upsert(toUpdate, { onConflict: "id" }); if (error) throw error; }
      setDeleted([]);
      toast.success("Materiais salvos!");
      load();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally { setSaving(false); }
  }

  function removeRule(key: string) {
    const r = rules.find(x => (x.id || x._local) === key);
    if (r?.id) setDeleted(prev => [...prev, r.id]);
    setRules(prev => prev.filter(x => (x.id || x._local) !== key));
  }

  if (loading) return <div className="p-8 text-center text-rose-300 font-dm">Carregando materiais…</div>;

  if (tableMissing) return (
    <section className={card}>
      <h2 className="font-lora text-xl font-bold text-[#5C1F2E] mb-2">Materiais e Acessórios</h2>
      <p className="text-sm text-rose-400 font-dm">A tabela <b>product_dependencies</b> ainda não existe. Rode a migration no SQL Editor do Supabase e recarregue.</p>
    </section>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">Materiais e Acessórios</h2>
          <p className="text-xs text-rose-400 mt-0.5">Cada material é um produto + uma regra de quantidade. Descartável/Louça fica no cadastro do produto.</p>
        </div>
        <button onClick={() => setRules(prev => [...prev, newRule()])} className="flex items-center gap-2 text-sm font-bold text-[var(--color-brand-red)] bg-rose-50 hover:bg-rose-100 border border-rose-100 px-4 py-2 rounded-xl"><Plus size={15} /> Novo material</button>
      </div>

      <div className="flex flex-col gap-4">
        {rules.length === 0 && <p className="text-sm text-rose-300 italic text-center py-4">Nenhum material. Clique em “Novo material”.</p>}

        {rules.map(r => {
          const key = r.id || r._local;
          const isCake = !!r.cake_rule;
          return (
            <div key={key} className={`rounded-2xl border p-4 ${r.active ? "border-[var(--color-brand-pink)]/60 bg-[#FAF5F3]" : "border-gray-200 bg-gray-50 opacity-70"}`}>
              <div className="flex items-center gap-2 mb-3">
                <input value={r.name} onChange={e => upd(key, { name: e.target.value })} placeholder="Nome da regra (ex: Guardanapos)" className={`${inp} font-bold flex-1`} />
                <label className="flex items-center gap-1 text-[11px] font-bold text-rose-500"><input type="checkbox" checked={r.active} onChange={e => upd(key, { active: e.target.checked })} /> ativa</label>
                <button onClick={() => removeRule(key)} className="text-rose-300 hover:text-red-500 p-1"><Trash2 size={15} /></button>
              </div>

              {isCake ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="md:col-span-3 text-[11px] font-bold text-[var(--color-brand-red)] uppercase">Regra de bolo</div>
                  <div><label className={lbl}>Pessoas/bolo grande</label><input type="number" value={r.cake_rule?.guests_per_large ?? ""} onChange={e => upd(key, { cake_rule: { ...r.cake_rule, guests_per_large: parseFloat(e.target.value) || 0 } })} className={inp} /></div>
                  <div><label className={lbl}>Extra grande (resto ≥)</label><input type="number" value={r.cake_rule?.extra_large_min ?? ""} onChange={e => upd(key, { cake_rule: { ...r.cake_rule, extra_large_min: parseFloat(e.target.value) || 0 } })} className={inp} /></div>
                  <div><label className={lbl}>Extra pequeno (resto ≥)</label><input type="number" value={r.cake_rule?.extra_small_min ?? ""} onChange={e => upd(key, { cake_rule: { ...r.cake_rule, extra_small_min: parseFloat(e.target.value) || 0 } })} className={inp} /></div>
                  <div><label className={lbl}>Produto bolo grande</label>
                    <select value={r.cake_rule?.large_product_id || ""} onChange={e => upd(key, { cake_rule: { ...r.cake_rule, large_product_id: e.target.value } })} className={inp}>
                      <option value="">—</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div><label className={lbl}>Produto bolo pequeno</label>
                    <select value={r.cake_rule?.small_product_id || ""} onChange={e => upd(key, { cake_rule: { ...r.cake_rule, small_product_id: e.target.value || null } })} className={inp}>
                      <option value="">—</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <>
                  {/* PRODUTO */}
                  <div className="mb-3">
                    <label className={lbl}>Produto</label>
                    <div className="flex gap-2">
                      <select value={r.product_id || ""} onChange={e => upd(key, { product_id: e.target.value })} className={inp}>
                        <option value="">— selecione —</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
                      </select>
                      <button onClick={() => { setCreatingFor(key); setDraftProd({ name: "", unit: "unidade", unit_price: 0 }); }} className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-brand-red)] bg-rose-50 border border-rose-100 px-3 rounded-lg whitespace-nowrap"><PackagePlus size={14} /> Criar</button>
                    </div>
                    {creatingFor === key && (
                      <div className="mt-2 grid grid-cols-[1fr_90px_90px_auto] gap-2 items-end bg-white border border-rose-100 rounded-xl p-3">
                        <div><label className={lbl}>Nome</label><input value={draftProd.name} onChange={e => setDraftProd(d => ({ ...d, name: e.target.value }))} className={inp} /></div>
                        <div><label className={lbl}>Unidade</label><input value={draftProd.unit} onChange={e => setDraftProd(d => ({ ...d, unit: e.target.value }))} className={inp} /></div>
                        <div><label className={lbl}>Preço</label><input type="number" step="0.01" value={draftProd.unit_price} onChange={e => setDraftProd(d => ({ ...d, unit_price: parseFloat(e.target.value) || 0 }))} className={inp} /></div>
                        <button onClick={() => createProduct(key)} className="bg-[var(--color-brand-wine)] text-white px-3 py-2 rounded-lg text-xs font-bold">Criar</button>
                      </div>
                    )}
                  </div>

                  {/* QUANTIDADE */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                    <div><label className={lbl}>Base</label>
                      <select value={r.qty_base} onChange={e => upd(key, { qty_base: e.target.value })} className={inp}>{QTY_BASES.map(q => <option key={q.v} value={q.v}>{q.l}</option>)}</select>
                    </div>
                    {r.qty_base === "per_food_unit"
                      ? <div><label className={lbl}>1 a cada N un. de comida</label><input type="number" value={r.qty_divisor ?? ""} onChange={e => upd(key, { qty_divisor: parseFloat(e.target.value) || null })} className={inp} /></div>
                      : <div><label className={lbl}>Quantidade</label><input type="number" step="0.5" value={r.qty_factor ?? ""} onChange={e => upd(key, { qty_factor: parseFloat(e.target.value) || 0 })} className={inp} /></div>}
                    <div><label className={lbl}>Arredondar ao múltiplo de (opcional)</label><input type="number" value={r.rounding_multiple ?? ""} onChange={e => upd(key, { rounding_multiple: parseFloat(e.target.value) || null })} placeholder="ex: 50" className={inp} /></div>
                  </div>

                  {/* DEPENDE DE */}
                  <div>
                    <label className={lbl}>Depende de (opcional) — só entra se isto estiver no orçamento</label>
                    <select value={dependsValue(r)} onChange={e => setDepends(key, e.target.value)} className={inp}>
                      <option value="">— sempre (não depende) —</option>
                      <optgroup label="Produtos">
                        {products.map(p => <option key={p.id} value={`prod:${p.id}`}>{p.name}</option>)}
                      </optgroup>
                      <optgroup label="Categorias">
                        {categories.map(c => <option key={c} value={`cat:${c}`}>{c}</option>)}
                      </optgroup>
                    </select>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end mt-6">
        <button onClick={saveAll} disabled={saving} className="bg-[var(--color-brand-wine)] hover:bg-[#4A1926] disabled:opacity-50 text-white px-8 py-3 rounded-2xl font-dm font-bold flex items-center gap-2">
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Salvar Materiais
        </button>
      </div>
    </div>
  );
}
