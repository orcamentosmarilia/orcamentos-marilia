"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import PageHeader from "@/components/PageHeader";
import {
  Save, Loader2, Sparkles, Plus,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight, X, Check, GripVertical, Pencil, Trash2
} from "lucide-react";
import { toast, confirmDialog } from "@/components/Notify";
import SystemRules from "@/components/SystemRules";
import ProductDependencies from "@/components/ProductDependencies";

interface ConfigState {
  ai_provider: string;
  ai_model: string;
  ai_api_key: string;
  ai_global_prompt: string;
  security_master_password: string;
}

export interface CategoryGroup {
  id: string;
  label: string;
  subcategories: string[];
}

interface BusinessRule {
  id: string;
  title: string;
  text: string;
  active: boolean;
}


const DEFAULT_RULES: BusinessRule[] = [
  { id: 'r1', title: 'Variedade de salgados', text: 'Inclua ao menos 3 tipos diferentes de salgados em qualquer cardápio com mais de 30 pessoas. Nunca repita a mesma categoria mais de uma vez.', active: true },
  { id: 'r2', title: 'Proporção doces/salgados', text: 'Para eventos acima de 50 pessoas, reserve entre 15% e 25% das unidades totais para doces. Para eventos menores, doces são opcionais.', active: true },
  { id: 'r3', title: 'Evento matutino (manhã)', text: 'Em eventos de manhã, priorize assados: pão de queijo, empadas, tortas, sanduíches. Minimize frituras. Pastéis crocantes são permitidos.', active: true },
  { id: 'r4', title: 'Bebidas quentes', text: 'Em qualquer evento até 3h, inclua ao menos café. Em eventos de manhã ou acima de 3h, ofereça também chá ou chocolate quente.', active: true },
  { id: 'r5', title: 'Espeto de fruta', text: 'Inclua espeto de fruta apenas se o cliente solicitou explicitamente ou se o evento for Elaborado com mais de 80 pessoas.', active: true },
  { id: 'r6', title: 'Louça e descartáveis', text: 'Se o evento inclui serviço de copo de vidro, remova copos plásticos do cardápio. Se inclui xícara de porcelana, remova copos de café de isopor.', active: true },
];

const DEFAULT_CATEGORY_GROUPS: CategoryGroup[] = [
  { id: 'g1', label: 'Salgados', subcategories: ['Pastéis Fritos', 'Pastéis Crocantes', 'Salgados', 'Folhados', 'Sanduíches'] },
  { id: 'g2', label: 'Doces', subcategories: ['Pastéis Doces', 'Doces', 'Bombons e Trufas'] },
  { id: 'g3', label: 'Tortas', subcategories: ['Tortas Salgadas', 'Tortas Salgadas Congeladas', 'Tortas Doces'] },
  { id: 'g4', label: 'Bebidas', subcategories: ['Bebidas', 'Sucos Naturais'] },
  { id: 'g5', label: 'Extras', subcategories: ['Espetos de Fruta', 'Bolos'] },
  { id: 'g6', label: 'Delivery', subcategories: ['Delivery - Pastéis Grandes', 'Delivery - Pastéis Pequenos', 'Delivery - Porções', 'Delivery - Salgados', 'Delivery - Doces'] },
  { id: 'g7', label: 'Congelados', subcategories: ['Produtos Congelados'] },
];



export default function SettingsPage() {
  const [configs, setConfigs] = useState<ConfigState>({ ai_provider: "anthropic", ai_model: "claude-3-haiku-20240307", ai_api_key: "", ai_global_prompt: "", security_master_password: "" });
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Category hierarchy
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [allDbCategories, setAllDbCategories] = useState<string[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupLabel, setEditGroupLabel] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState('');

  // Regras de negócio
  const [rules, setRules] = useState<BusinessRule[]>(DEFAULT_RULES);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<BusinessRule | null>(null);
  const [addingRule, setAddingRule] = useState(false);
  const [newRuleDraft, setNewRuleDraft] = useState({ title: '', text: '' });

  useEffect(() => { fetchConfigs(); }, []);

  useEffect(() => {
    if (configs.ai_api_key) {
      const timer = setTimeout(fetchModels, 800);
      return () => clearTimeout(timer);
    }
  }, [configs.ai_provider, configs.ai_api_key]);

  async function fetchModelsWithParams(provider?: string, apiKey?: string) {
    const p = provider || configs.ai_provider;
    const k = apiKey || configs.ai_api_key;
    if (!k) return;
    try {
      setLoadingModels(true);
      const res = await fetch("/api/ai-models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: p, apiKey: k }) });
      const data = await res.json();
      if (data.models) setAvailableModels(data.models);
    } catch { /* ignore */ } finally { setLoadingModels(false); }
  }

  async function fetchModels() { await fetchModelsWithParams(); }

  async function fetchConfigs() {
    try {
      const [{ data: aiData }, { data: catGroupsData }, { data: pwdData }, { data: productsData }, { data: businessRulesData }] = await Promise.all([
        supabase.from("system_config").select("*"),
        supabase.from("settings").select("value").eq("key", "category_order").single(),
        supabase.from("settings").select("value").eq("key", "security_master_password").single(),
        supabase.from("products").select("category").eq("is_active", true),
        supabase.from("settings").select("value").eq("key", "business_rules").single(),
      ]);

      if (aiData?.length) {
        const newConfigs: any = { ...configs };
        aiData.forEach((item: any) => { if (item.key in newConfigs) newConfigs[item.key] = item.value; });
        setConfigs(newConfigs);
        if (newConfigs.ai_api_key) fetchModelsWithParams(newConfigs.ai_provider, newConfigs.ai_api_key);
      }

      if (pwdData?.value) setConfigs(prev => ({ ...prev, security_master_password: pwdData.value }));

      if (businessRulesData?.value && Array.isArray(businessRulesData.value)) {
        setRules(businessRulesData.value as BusinessRule[]);
      }

      // All unique product categories from DB
      const uniqueCats = Array.from(new Set((productsData || []).map((p: any) => p.category).filter(Boolean))) as string[];
      const validCatSet = new Set(uniqueCats);
      setAllDbCategories(uniqueCats.sort());

      // Load category groups — filter subcategories to only those that exist in DB
      const rawCatValue = catGroupsData?.value;
      const filterSubs = (groups: CategoryGroup[]) =>
        groups.map(g => ({ ...g, subcategories: g.subcategories.filter(s => validCatSet.has(s)) }));
      if (rawCatValue && Array.isArray(rawCatValue) && rawCatValue.length > 0) {
        if (typeof rawCatValue[0] === 'object' && rawCatValue[0].subcategories) {
          setCategoryGroups(filterSubs(rawCatValue as CategoryGroup[]));
        } else {
          setCategoryGroups(filterSubs(DEFAULT_CATEGORY_GROUPS));
        }
      } else {
        setCategoryGroups(filterSubs(DEFAULT_CATEGORY_GROUPS));
      }

    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    } finally {
      setLoading(false);
    }
  }

  // ── Business rules helpers ────────────────────────────────────────
  const persistRules = async (updated: BusinessRule[]) => {
    await supabase.from("settings").upsert({ key: "business_rules", value: updated, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  };
  const toggleRuleActive = (id: string) => {
    const updated = rules.map(r => r.id === id ? { ...r, active: !r.active } : r);
    setRules(updated);
    persistRules(updated);
  };
  const startEditRule = (r: BusinessRule) => { setEditingRule(r.id); setEditDraft({ ...r }); };
  const saveEditRule = () => {
    if (!editDraft) return;
    const updated = rules.map(r => r.id === editDraft.id ? editDraft : r);
    setRules(updated);
    persistRules(updated);
    setEditingRule(null);
  };
  const deleteRule = async (id: string) => {
    if (!(await confirmDialog({ message: 'Excluir esta regra?', danger: true, confirmText: 'Excluir' }))) return;
    const updated = rules.filter(r => r.id !== id);
    setRules(updated);
    persistRules(updated);
  };
  const addRule = () => {
    if (!newRuleDraft.title.trim() || !newRuleDraft.text.trim()) return;
    const newRule: BusinessRule = { id: `r-${Date.now()}`, ...newRuleDraft, active: true };
    const updated = [...rules, newRule];
    setRules(updated);
    persistRules(updated);
    setNewRuleDraft({ title: '', text: '' });
    setAddingRule(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setConfigs(prev => ({ ...prev, [name]: value }));
  };

  // ── Category group helpers ────────────────────────────────────────
  const assignedCategories = new Set(categoryGroups.flatMap(g => g.subcategories));
  const ungroupedCategories = allDbCategories.filter(c => !assignedCategories.has(c));

  const moveGroup = (idx: number, dir: 'up' | 'down') => {
    const next = dir === 'up' ? idx - 1 : idx + 1;
    if (next < 0 || next >= categoryGroups.length) return;
    const updated = [...categoryGroups];
    [updated[idx], updated[next]] = [updated[next], updated[idx]];
    setCategoryGroups(updated);
  };

  const moveSubcat = (groupId: string, idx: number, dir: 'up' | 'down') => {
    setCategoryGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const subs = [...g.subcategories];
      const next = dir === 'up' ? idx - 1 : idx + 1;
      if (next < 0 || next >= subs.length) return g;
      [subs[idx], subs[next]] = [subs[next], subs[idx]];
      return { ...g, subcategories: subs };
    }));
  };

  const removeSubcat = (groupId: string, cat: string) => {
    setCategoryGroups(prev => prev.map(g => g.id !== groupId ? g : { ...g, subcategories: g.subcategories.filter(s => s !== cat) }));
  };

  const addSubcatToGroup = (groupId: string, cat: string) => {
    if (!cat) return;
    setCategoryGroups(prev => prev.map(g => g.id !== groupId ? g : { ...g, subcategories: [...g.subcategories, cat] }));
  };

  // Move uma categoria de um grupo para outro (numa única atualização de estado)
  const moveSubcatToGroup = (fromId: string, toId: string, cat: string) => {
    if (!toId || fromId === toId) return;
    setCategoryGroups(prev => prev.map(g => {
      if (g.id === fromId) return { ...g, subcategories: g.subcategories.filter(s => s !== cat) };
      if (g.id === toId)   return { ...g, subcategories: [...g.subcategories, cat] };
      return g;
    }));
  };

  const deleteGroup = async (id: string) => {
    if (!(await confirmDialog({ message: 'Excluir este grupo? As categorias voltarão para "Não agrupadas".', danger: true, confirmText: 'Excluir' }))) return;
    setCategoryGroups(prev => prev.filter(g => g.id !== id));
    if (expandedGroupId === id) setExpandedGroupId(null);
  };

  const saveGroupLabel = (id: string) => {
    setCategoryGroups(prev => prev.map(g => g.id !== id ? g : { ...g, label: editGroupLabel }));
    setEditingGroupId(null);
  };

  const addGroup = () => {
    if (!newGroupLabel.trim()) return;
    const g: CategoryGroup = { id: `g-${Date.now()}`, label: newGroupLabel.trim(), subcategories: [] };
    setCategoryGroups(prev => [...prev, g]);
    setNewGroupLabel('');
    setAddingGroup(false);
    setExpandedGroupId(g.id);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const configUpdates = Object.keys(configs).map(key => ({ key, value: configs[key as keyof ConfigState], updated_at: new Date().toISOString() }));
      await supabase.from("system_config").upsert(configUpdates);
      await supabase.from("settings").upsert({ key: "security_master_password", value: configs.security_master_password, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      await supabase.from("settings").upsert({ key: "category_order", value: categoryGroups, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      await supabase.from("settings").upsert({ key: "business_rules", value: rules, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      toast.success("Configurações salvas com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-center text-rose-300 font-dm text-xl">Carregando configurações...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Configurações"
        description="Personalize o comportamento da IA e a organização visual dos orçamentos."
      />

      <div className="grid grid-cols-1 gap-8">

        {/* INTELIGÊNCIA ARTIFICIAL */}
        <section className="bg-white rounded-3xl shadow-sm border border-[var(--color-brand-pink2)] p-8">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--color-brand-pink2)]">
            <span className="material-symbols-outlined text-[var(--color-brand-red)] text-2xl">auto_awesome</span>
            <div>
              <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">Inteligência Artificial</h2>
              <p className="text-xs text-rose-400 mt-0.5">Configure o provedor, modelo e chave de API para geração de orçamentos.</p>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-2 block">Provedor</label>
                <select name="ai_provider" value={configs.ai_provider} onChange={handleChange} className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] bg-white font-dm">
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai">OpenAI (ChatGPT)</option>
                  <option value="google">Google Gemini</option>
                  <option value="groq">Groq</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Modelo</span>
                  {loadingModels && <Loader2 size={12} className="animate-spin text-[var(--color-brand-red)]" />}
                </label>
                <select name="ai_model" value={configs.ai_model} onChange={handleChange} disabled={loadingModels || availableModels.length === 0} className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] bg-white font-dm disabled:bg-gray-50">
                  <option value="">{loadingModels ? "Buscando..." : availableModels.length > 0 ? "Selecione" : "Insira a chave para carregar"}</option>
                  {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
                  {configs.ai_model && !availableModels.includes(configs.ai_model) && <option value={configs.ai_model}>{configs.ai_model}</option>}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-2 block">Chave de API</label>
              <div className="relative">
                <input type="password" name="ai_api_key" value={configs.ai_api_key} onChange={handleChange} className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-3 pr-32 text-sm focus:outline-none focus:border-[var(--color-brand-red)] font-mono" placeholder="sk-..." />
                {configs.ai_api_key && (
                  <button type="button" onClick={fetchModels} disabled={loadingModels} className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--color-brand-red)] bg-rose-50 hover:bg-rose-100 border border-rose-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1">
                    {loadingModels && <Loader2 size={10} className="animate-spin" />}
                    {loadingModels ? 'Carregando...' : 'Listar Modelos'}
                  </button>
                )}
              </div>
            </div>
            <div className="pt-4 border-t border-[var(--color-brand-pink)]">
              <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-2">
                <Sparkles size={14} className="text-[var(--color-brand-red)]" /> Instruções Globais Adicionais
              </label>
              <textarea name="ai_global_prompt" value={configs.ai_global_prompt} onChange={handleChange} rows={4} className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-4 text-sm focus:outline-none focus:border-[var(--color-brand-red)] font-dm leading-relaxed" placeholder="Instruções extras que a IA sempre deve seguir..." />
            </div>
          </div>
        </section>


        {/* HIERARQUIA DE CATEGORIAS */}
        <section className="bg-white rounded-3xl shadow-sm border border-[var(--color-brand-pink2)] p-8">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--color-brand-pink2)]">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[var(--color-brand-red)] text-2xl">format_list_numbered</span>
              <div>
                <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">Hierarquia de Categorias</h2>
                <p className="text-xs text-rose-400 mt-0.5">Agrupe categorias de produto em grupos visuais. A ordem define como aparecem na proposta.</p>
              </div>
            </div>
            <button onClick={() => setAddingGroup(true)} className="flex items-center gap-2 text-sm font-bold text-[var(--color-brand-red)] bg-rose-50 hover:bg-rose-100 border border-rose-100 px-4 py-2 rounded-xl transition-colors">
              <Plus size={16} /> Novo Grupo
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {categoryGroups.map((group, gIdx) => {
              const isExpanded = expandedGroupId === group.id;
              const isEditing = editingGroupId === group.id;
              const available = ungroupedCategories; // categories not yet in any group

              return (
                <div key={group.id} className="border border-[var(--color-brand-pink2)] rounded-2xl overflow-hidden">
                  {/* Group header */}
                  <div className="flex items-center gap-3 px-5 py-4 bg-[#FAF5F3]">
                    <GripVertical size={16} className="text-rose-200 flex-shrink-0" />
                    <span className="text-xs font-bold text-rose-200 bg-white w-6 h-6 rounded-full flex items-center justify-center border border-rose-100 flex-shrink-0">{gIdx + 1}</span>

                    {isEditing ? (
                      <input
                        autoFocus
                        type="text"
                        value={editGroupLabel}
                        onChange={e => setEditGroupLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveGroupLabel(group.id); if (e.key === 'Escape') setEditingGroupId(null); }}
                        className="flex-1 border-b border-[var(--color-brand-red)] bg-transparent text-sm font-bold text-[#5C1F2E] focus:outline-none py-0.5"
                      />
                    ) : (
                      <span className="font-lora font-bold text-[#5C1F2E] flex-1">{group.label}</span>
                    )}

                    <span className="text-[10px] text-rose-300 font-dm">{group.subcategories.length} subcategoria(s)</span>

                    <div className="flex items-center gap-0.5">
                      {isEditing ? (
                        <>
                          <button onClick={() => saveGroupLabel(group.id)} className="p-1.5 text-[var(--color-brand-red)] hover:bg-rose-50 rounded-lg transition-colors"><Check size={15} /></button>
                          <button onClick={() => setEditingGroupId(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors"><X size={15} /></button>
                        </>
                      ) : (
                        <button onClick={() => { setEditingGroupId(group.id); setEditGroupLabel(group.label); }} className="p-1.5 text-rose-300 hover:text-[var(--color-brand-red)] transition-colors"><Pencil size={14} /></button>
                      )}
                      <button onClick={() => moveGroup(gIdx, 'up')} disabled={gIdx === 0} className="p-1.5 text-rose-300 hover:text-[var(--color-brand-red)] disabled:opacity-20 transition-colors"><ChevronUp size={16} /></button>
                      <button onClick={() => moveGroup(gIdx, 'down')} disabled={gIdx === categoryGroups.length - 1} className="p-1.5 text-rose-300 hover:text-[var(--color-brand-red)] disabled:opacity-20 transition-colors"><ChevronDown size={16} /></button>
                      <button onClick={() => deleteGroup(group.id)} className="p-1.5 text-rose-200 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                      <button onClick={() => setExpandedGroupId(isExpanded ? null : group.id)} className="p-1.5 text-rose-300 hover:text-[var(--color-brand-red)] transition-colors ml-1">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Subcategory pills (always visible as summary) — editáveis direto */}
                  {!isExpanded && group.subcategories.length > 0 && (
                    <div className="px-5 py-3 flex flex-wrap gap-1.5 bg-white border-t border-[var(--color-brand-pink)]/50">
                      {group.subcategories.map(cat => (
                        <div key={cat} className="flex items-center gap-1 bg-rose-50 border border-rose-100 rounded-full pl-2.5 pr-1 py-0.5">
                          <span className="text-[11px] font-dm text-rose-500">{cat}</span>
                          <select
                            value=""
                            onChange={e => {
                              if (e.target.value === '__remove__') removeSubcat(group.id, cat);
                              else if (e.target.value) moveSubcatToGroup(group.id, e.target.value, cat);
                            }}
                            className="text-[10px] font-bold text-rose-400 bg-transparent rounded px-0.5 py-0.5 focus:outline-none cursor-pointer hover:text-[var(--color-brand-red)]"
                            title="Mover ou remover desta categoria"
                          >
                            <option value="">⋯</option>
                            {categoryGroups.filter(g => g.id !== group.id).length > 0 && (
                              <optgroup label="Mover para">
                                {categoryGroups.filter(g => g.id !== group.id).map(g => (
                                  <option key={g.id} value={g.id}>{g.label}</option>
                                ))}
                              </optgroup>
                            )}
                            <option value="__remove__">✕ Remover do grupo</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Expanded: full subcategory management */}
                  {isExpanded && (
                    <div className="px-5 py-4 bg-white border-t border-[var(--color-brand-pink)]">
                      <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-3">Subcategorias</p>

                      {group.subcategories.length === 0 && (
                        <p className="text-xs text-rose-300 italic mb-3">Nenhuma subcategoria. Adicione abaixo.</p>
                      )}

                      <div className="flex flex-col gap-1.5 mb-4">
                        {group.subcategories.map((cat, sIdx) => (
                          <div key={cat} className="flex items-center gap-2 px-3 py-2 bg-[#FAF5F3] rounded-xl border border-[var(--color-brand-pink)]/50">
                            <GripVertical size={14} className="text-rose-200 flex-shrink-0" />
                            <span className="text-sm font-dm text-[#5C1F2E] flex-1">{cat}</span>
                            <div className="flex gap-0.5">
                              <button onClick={() => moveSubcat(group.id, sIdx, 'up')} disabled={sIdx === 0} className="p-1 text-rose-200 hover:text-[var(--color-brand-red)] disabled:opacity-20 transition-colors"><ChevronUp size={13} /></button>
                              <button onClick={() => moveSubcat(group.id, sIdx, 'down')} disabled={sIdx === group.subcategories.length - 1} className="p-1 text-rose-200 hover:text-[var(--color-brand-red)] disabled:opacity-20 transition-colors"><ChevronDown size={13} /></button>
                              <button onClick={() => removeSubcat(group.id, cat)} className="p-1 text-rose-200 hover:text-red-400 transition-colors ml-1"><X size={13} /></button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add subcategory dropdown */}
                      {available.length > 0 && (
                        <div className="flex items-center gap-2">
                          <select
                            defaultValue=""
                            onChange={e => { addSubcatToGroup(group.id, e.target.value); e.target.value = ''; }}
                            className="flex-1 border border-dashed border-[var(--color-brand-red)]/40 rounded-xl p-2.5 text-sm text-rose-400 bg-rose-50/50 focus:outline-none focus:border-[var(--color-brand-red)] font-dm"
                          >
                            <option value="">+ Adicionar categoria ao grupo...</option>
                            {available.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      )}
                      {available.length === 0 && (
                        <p className="text-[10px] text-rose-300 italic">Todas as categorias já estão agrupadas.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add new group form */}
            {addingGroup && (
              <div className="border-2 border-dashed border-[var(--color-brand-red)]/30 rounded-2xl p-4 bg-rose-50/50 flex items-center gap-3">
                <input
                  autoFocus
                  type="text"
                  value={newGroupLabel}
                  onChange={e => setNewGroupLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') setAddingGroup(false); }}
                  className="flex-1 border border-[var(--color-brand-pink2)] rounded-xl p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] font-dm"
                  placeholder="Nome do grupo (ex: Salgados, Bebidas...)"
                />
                <button onClick={addGroup} disabled={!newGroupLabel.trim()} className="flex items-center gap-1.5 text-sm px-4 py-3 bg-[var(--color-brand-red)] text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-40"><Check size={14} /></button>
                <button onClick={() => { setAddingGroup(false); setNewGroupLabel(''); }} className="p-3 text-gray-400 hover:bg-gray-100 rounded-xl"><X size={14} /></button>
              </div>
            )}
          </div>

          {/* Ungrouped categories */}
          {ungroupedCategories.length > 0 && (
            <div className="mt-6 pt-6 border-t border-[var(--color-brand-pink)]">
              <p className="text-[11px] font-bold text-rose-400 uppercase tracking-wider mb-3">Não agrupadas ({ungroupedCategories.length})</p>
              <div className="flex flex-wrap gap-2">
                {ungroupedCategories.map(cat => (
                  <div key={cat} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full pl-3 pr-1 py-1">
                    <span className="text-xs font-dm text-gray-500">{cat}</span>
                    <select
                      value=""
                      onChange={e => { if (e.target.value) addSubcatToGroup(e.target.value, cat); }}
                      className="text-[11px] font-bold text-[var(--color-brand-red)] bg-white border border-rose-100 rounded-full px-2 py-1 focus:outline-none focus:border-[var(--color-brand-red)] cursor-pointer"
                      title="Adicionar a um grupo"
                    >
                      <option value="">+ grupo</option>
                      {categoryGroups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-rose-300 mt-2 italic">Clique em &quot;+ grupo&quot; em cada categoria para incluí-la num grupo. Não esqueça de <b>Salvar Configurações</b>.</p>
            </div>
          )}
        </section>

        {/* REGRAS DO SISTEMA — todas as regras de cálculo, seleções e exibição */}
        <SystemRules />

        {/* DEPENDÊNCIAS DE PRODUTOS — acessórios, itens dependentes e bolo */}
        <ProductDependencies />

        {/* REGRAS DE NEGÓCIO */}
        <section className="bg-white rounded-3xl shadow-sm border border-[var(--color-brand-pink2)] p-8">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--color-brand-pink2)]">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[var(--color-brand-red)] text-2xl">rule</span>
              <div>
                <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">Regras de Negócio</h2>
                <p className="text-xs text-rose-400 mt-0.5">Regras em texto livre que a IA lê e segue ao montar o orçamento. Ative, edite, crie ou remova conforme necessário.</p>
              </div>
            </div>
            <button onClick={() => setAddingRule(true)} disabled={addingRule} className="flex items-center gap-2 text-sm font-bold text-[var(--color-brand-red)] bg-rose-50 hover:bg-rose-100 border border-rose-100 px-4 py-2 rounded-xl transition-colors disabled:opacity-40">
              <Plus size={14} /> Nova Regra
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {rules.map(rule => (
              <div key={rule.id} className={`rounded-2xl border p-4 transition-all ${rule.active ? 'bg-[#FAF5F3] border-[var(--color-brand-pink)]/60' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                {editingRule === rule.id && editDraft ? (
                  <div className="flex flex-col gap-3">
                    <input
                      type="text"
                      value={editDraft.title}
                      onChange={e => setEditDraft({ ...editDraft, title: e.target.value })}
                      className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-2.5 text-sm font-bold focus:outline-none focus:border-[var(--color-brand-red)] font-dm"
                      placeholder="Título da regra"
                    />
                    <textarea
                      value={editDraft.text}
                      onChange={e => setEditDraft({ ...editDraft, text: e.target.value })}
                      rows={3}
                      className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-2.5 text-sm focus:outline-none focus:border-[var(--color-brand-red)] font-dm leading-relaxed"
                      placeholder="Descreva a regra em linguagem natural..."
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditingRule(null)} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
                      <button onClick={saveEditRule} className="px-4 py-1.5 text-xs font-bold bg-[var(--color-brand-red)] text-white rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5"><Check size={12} /> Salvar</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleRuleActive(rule.id)} className="mt-0.5 flex-shrink-0 text-[var(--color-brand-red)]">
                      {rule.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} className="text-gray-400" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-dm font-bold text-sm text-[#5C1F2E] mb-1">{rule.title}</p>
                      <p className="text-sm text-[var(--color-brand-gray)] leading-relaxed">{rule.text}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => startEditRule(rule)} className="p-1.5 text-rose-300 hover:text-[var(--color-brand-red)] transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => deleteRule(rule.id)} className="p-1.5 text-rose-200 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {rules.length === 0 && !addingRule && (
              <p className="text-sm text-rose-300 italic text-center py-4">Nenhuma regra cadastrada. Clique em "Nova Regra" para começar.</p>
            )}

            {addingRule && (
              <div className="rounded-2xl border-2 border-dashed border-[var(--color-brand-red)]/40 p-4 bg-rose-50/50 flex flex-col gap-3">
                <input
                  autoFocus
                  type="text"
                  value={newRuleDraft.title}
                  onChange={e => setNewRuleDraft(d => ({ ...d, title: e.target.value }))}
                  className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-2.5 text-sm font-bold focus:outline-none focus:border-[var(--color-brand-red)] font-dm"
                  placeholder="Título da regra (ex: Evento matutino)"
                />
                <textarea
                  value={newRuleDraft.text}
                  onChange={e => setNewRuleDraft(d => ({ ...d, text: e.target.value }))}
                  rows={3}
                  className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-2.5 text-sm focus:outline-none focus:border-[var(--color-brand-red)] font-dm leading-relaxed"
                  placeholder="Descreva a regra em linguagem natural que a IA deve seguir..."
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setAddingRule(false); setNewRuleDraft({ title: '', text: '' }); }} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancelar</button>
                  <button onClick={addRule} disabled={!newRuleDraft.title.trim() || !newRuleDraft.text.trim()} className="px-4 py-1.5 text-xs font-bold bg-[var(--color-brand-red)] text-white rounded-xl hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1.5"><Plus size={12} /> Adicionar</button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SEGURANÇA */}
        <section className="bg-white rounded-3xl shadow-sm border border-[var(--color-brand-pink2)] p-8">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--color-brand-pink2)]">
            <span className="material-symbols-outlined text-[var(--color-brand-red)] text-2xl">security</span>
            <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">Segurança</h2>
          </div>
          <div>
            <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-2 block">Senha Mestra para Exclusões</label>
            <input type="password" name="security_master_password" value={configs.security_master_password} onChange={handleChange} className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)]" placeholder="Senha para apagar orçamentos" />
          </div>
        </section>

        <div className="sticky bottom-8 flex justify-center">
          <button onClick={handleSave} disabled={saving} className="bg-[var(--color-brand-wine)] hover:bg-[#4A1926] disabled:opacity-50 text-white px-12 py-4 rounded-2xl font-dm font-bold text-base flex items-center gap-3 shadow-2xl transition-all hover:scale-105 active:scale-95">
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {saving ? "Salvando..." : "Salvar Configurações"}
          </button>
        </div>
      </div>
    </div>
  );
}
