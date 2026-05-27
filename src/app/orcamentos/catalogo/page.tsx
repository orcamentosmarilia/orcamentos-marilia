"use client";

import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Search, Plus, Edit2, Trash2, X, Save, ImagePlus, Loader2, FolderInput } from "lucide-react";
import PageHeader from "@/components/PageHeader";

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  unit_price: number;
  is_active: boolean;
  is_multiple_of_25: boolean;
  tier?: 'Econômico' | 'Elaborado' | null;
  image_url?: string;
}

interface Category {
  id: string;
  name: string;
}

export default function CatalogoPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [dbCategories, setDbCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedTier, setSelectedTier] = useState<string>("Todas");
  
  // Category Modal State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    unit: "unidade",
    unit_price: "",
    is_active: true,
    is_multiple_of_25: false,
    tier: null as 'Econômico' | 'Elaborado' | null,
    image_url: "" as string | undefined,
  });
  const [saving, setSaving] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkTier, setBulkTier] = useState<string>("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredProducts.forEach(p => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filteredProducts.forEach(p => next.add(p.id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    if (!confirm(`Tem certeza que deseja apagar ${selectedIds.size} produto(s)?`)) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      await supabase.storage.from("product-images").remove(
        ids.flatMap(id => ['jpg','jpeg','png','webp'].map(ext => `${id}.${ext}`))
      );
      const { error } = await supabase.from("products").delete().in("id", ids);
      if (error) throw error;
      clearSelection();
      fetchProducts();
    } catch (err: any) {
      alert("Erro ao apagar: " + err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkChangeCategory = async () => {
    if (!bulkCategory) return;
    setBulkLoading(true);
    try {
      const { error } = await supabase.from("products")
        .update({ category: bulkCategory })
        .in("id", Array.from(selectedIds));
      if (error) throw error;
      clearSelection();
      setBulkCategory("");
      fetchProducts();
    } catch (err: any) {
      alert("Erro ao mover categoria: " + err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkChangeTier = async () => {
    setBulkLoading(true);
    try {
      const { error } = await supabase.from("products")
        .update({ tier: bulkTier || null })
        .in("id", Array.from(selectedIds));
      if (error) throw error;
      clearSelection();
      setBulkTier("");
      fetchProducts();
    } catch (err: any) {
      alert("Erro ao definir modalidade: " + err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  // Image upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  async function fetchCategories() {
    const { data, error } = await supabase
      .from("product_categories")
      .select("*")
      .order("name", { ascending: true });
    
    if (error) {
      console.error("Erro ao buscar categorias:", error);
    } else {
      setDbCategories(data || []);
    }
  }

  async function fetchProducts() {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Erro ao buscar catálogo:", error);
    } finally {
      setLoading(false);
    }
  }

  const categories = ["Todas", ...dbCategories.map(c => c.name)];

  const filteredProducts = products.filter(p => {
    const matchCat = selectedCategory === "Todas" || p.category === selectedCategory;
    const matchTier = selectedTier === "Todas" || (selectedTier === "Sem modalidade" ? !p.tier : p.tier === selectedTier);
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchCat && matchTier && matchSearch;
  });

  const allVisibleSelected = filteredProducts.length > 0 && filteredProducts.every(p => selectedIds.has(p.id));
  const someSelected = selectedIds.size > 0;

  const openModal = (product?: Product) => {
    if (product) {
      setEditingId(product.id);
      setFormData({
        name: product.name,
        description: product.description || "",
        category: product.category,
        unit: product.unit,
        unit_price: product.unit_price.toString(),
        is_active: product.is_active,
        is_multiple_of_25: !!product.is_multiple_of_25,
        tier: product.tier ?? null,
        image_url: product.image_url || "",
      });
      setImagePreview(product.image_url || null);
    } else {
      setEditingId(null);
      setFormData({
        name: "",
        description: "",
        category: "",
        unit: "unidade",
        unit_price: "",
        is_active: true,
        is_multiple_of_25: false,
        tier: null,
        image_url: "",
      });
      setImagePreview(null);
    }
    setPendingFile(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setPendingFile(null);
    setImagePreview(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Preview local
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    
    setPendingFile(file);
  };

  const uploadImage = async (productId: string): Promise<string | null> => {
    if (!pendingFile) return formData.image_url || null;
    
    setUploadingImage(true);
    try {
      const ext = pendingFile.name.split(".").pop();
      const path = `${productId}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, pendingFile, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);
      
      return publicUrl;
    } catch (err: any) {
      console.error("Erro no upload:", err);
      alert("Erro ao fazer upload da imagem: " + err.message);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const productId = editingId || crypto.randomUUID();
      
      // Upload image first (if there's a pending file)
      let imageUrl = formData.image_url || null;
      if (pendingFile) {
        imageUrl = await uploadImage(productId);
      }
      
      const payload = {
        name: formData.name,
        description: formData.description,
        category: formData.category,
        unit: formData.unit,
        unit_price: parseFloat(formData.unit_price.replace(',', '.')),
        is_active: formData.is_active,
        is_multiple_of_25: formData.is_multiple_of_25,
        tier: formData.tier || null,
        image_url: imageUrl,
      };

      if (editingId) {
        const { error } = await supabase.from("products").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert([{ id: productId, ...payload }]);
        if (error) throw error;
      }

      fetchProducts();
      closeModal();
    } catch (error: any) {
      alert("Erro ao salvar produto: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este item do catálogo?")) return;
    
    try {
      // Try to remove image from storage too
      await supabase.storage.from("product-images").remove([`${id}.jpg`, `${id}.jpeg`, `${id}.png`, `${id}.webp`]);
      
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      fetchProducts();
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  const handleSaveCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      if (editingCat) {
        const { error } = await supabase
          .from("product_categories")
          .update({ name: newCatName.trim() })
          .eq("id", editingCat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("product_categories")
          .insert([{ name: newCatName.trim() }]);
        if (error) throw error;
      }
      setNewCatName("");
      setEditingCat(null);
      fetchCategories();
    } catch (err: any) {
      alert("Erro ao salvar categoria: " + err.message);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    const hasProducts = products.some(p => p.category === cat.name);
    let msg = `Tem certeza que deseja excluir a categoria "${cat.name}"?`;
    if (hasProducts) {
      msg += "\n\nAVISO: Existem produtos vinculados a esta categoria. Eles NÃO serão excluídos, mas você precisará reatribuí-los a uma nova categoria manualmente.";
    }

    if (!confirm(msg)) return;
    
    try {
      const { error } = await supabase
        .from("product_categories")
        .delete()
        .eq("id", cat.id);
      if (error) throw error;
      fetchCategories();
    } catch (err: any) {
      alert("Erro ao excluir categoria: " + err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">

      {/* ══ MODAL CATEGORIAS ══ */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-[#5C1F2E]/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-rose-50 flex justify-between items-center">
              <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">Gerenciar Categorias</h2>
              <button onClick={() => { setIsCatModalOpen(false); setEditingCat(null); setNewCatName(""); }} className="text-rose-300 hover:text-[#D14237] p-1">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto font-dm space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSaveCategory()}
                  placeholder="Nome da categoria..."
                  className="flex-1 border border-rose-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5C1F2E] font-dm text-[#5C1F2E] placeholder:text-rose-200"
                />
                <button onClick={handleSaveCategory}
                  className="bg-[#5C1F2E] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[#4A1925] transition-colors font-dm">
                  {editingCat ? "Salvar" : "Adicionar"}
                </button>
              </div>
              <div className="space-y-2">
                {dbCategories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between px-4 py-3 bg-rose-50/40 rounded-xl border border-rose-50 group">
                    <span className="text-sm font-dm font-medium text-[#5C1F2E]">{cat.name}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingCat(cat); setNewCatName(cat.name); }} className="p-1.5 text-rose-300 hover:text-[#5C1F2E]"><Edit2 size={14} /></button>
                      <button onClick={() => handleDeleteCategory(cat)} className="p-1.5 text-rose-300 hover:text-[#D14237]"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="Catálogo de Produtos"
        description="Gerencie os itens do cardápio e preços para a Inteligência Artificial."
        actions={<>
          <button onClick={() => setIsCatModalOpen(true)} className="bg-white border border-rose-100 hover:bg-rose-50 text-[#5C1F2E] px-5 py-2.5 rounded-xl font-dm font-bold text-sm transition-all shadow-sm">
            Categorias
          </button>
          <button onClick={() => openModal()} className="bg-gradient-to-tr from-[#D14237] to-[#E8635A] hover:to-[#D14237] text-white px-5 py-2.5 rounded-xl font-dm font-bold text-sm flex items-center gap-2 shadow-xl shadow-[#D14237]/20 transition-all">
            <Plus size={16} /> Novo Produto
          </button>
        </>}
      />

      {/* ── Tier filter ── */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">Modalidade:</span>
        {["Todas", "Econômico", "Elaborado", "Sem modalidade"].map(t => (
          <button
            key={t}
            onClick={() => setSelectedTier(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
              selectedTier === t
                ? t === "Econômico" ? "bg-green-600 border-green-600 text-white"
                  : t === "Elaborado" ? "bg-purple-600 border-purple-600 text-white"
                  : t === "Sem modalidade" ? "bg-rose-500 border-rose-500 text-white"
                  : "bg-[#5C1F2E] border-[#5C1F2E] text-white"
                : "bg-white border-rose-100 text-rose-400 hover:border-rose-300"
            }`}
          >
            {t}{t === "Sem modalidade" ? ` (${products.filter(p => !p.tier).length})` : ""}
          </button>
        ))}
      </div>

      {/* ── Search bar ── */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-300 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar produto por nome ou descrição..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-2xl border border-rose-100 bg-white shadow-sm text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#5C1F2E] placeholder:text-rose-200"
        />
        {searchTerm && (
          <button onClick={() => setSearchTerm("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-300 hover:text-[#D14237]">
            <X size={15} />
          </button>
        )}
      </div>

      {/* ── Main card: sidebar + table ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-rose-50 overflow-hidden flex" style={{ minHeight: 520 }}>

        {/* Left: category sidebar */}
        <aside className="w-52 flex-shrink-0 border-r border-rose-50 flex flex-col overflow-y-auto">
          <div className="px-3 pt-4 pb-2">
            <p className="text-[10px] font-dm font-bold text-rose-300 uppercase tracking-widest px-2 mb-2">Categorias</p>
          </div>
          <div className="flex flex-col gap-0.5 px-3 pb-4">
            {categories.map(cat => {
              const count = cat === "Todas"
                ? products.length
                : products.filter(p => p.category === cat).length;
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex items-center justify-between w-full text-left px-3 py-2.5 rounded-xl text-sm font-dm font-bold transition-all ${
                    active
                      ? "bg-[#5C1F2E] text-white"
                      : "text-rose-400 hover:bg-rose-50 hover:text-[#5C1F2E]"
                  }`}
                >
                  <span className="truncate leading-tight">{cat}</span>
                  <span className={`text-[10px] ml-2 flex-shrink-0 tabular-nums ${active ? "text-rose-200" : "text-rose-300"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right: bulk bar + table */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Bulk Action Bar */}
          {someSelected && (
            <div className="px-5 py-3 bg-[#5C1F2E] flex flex-wrap items-center gap-3 flex-shrink-0">
              <span className="text-white font-dm text-sm font-bold">
                {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <select value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}
                  className="border border-white/30 bg-white/10 text-white rounded-lg px-3 py-1.5 text-xs font-dm focus:outline-none focus:border-white">
                  <option value="">Mover para categoria...</option>
                  {dbCategories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                </select>
                <button onClick={handleBulkChangeCategory} disabled={!bulkCategory || bulkLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold font-dm transition-colors disabled:opacity-40">
                  {bulkLoading ? <Loader2 size={13} className="animate-spin" /> : <FolderInput size={13} />} Mover
                </button>
                <div className="h-5 w-px bg-white/20" />
                <select value={bulkTier} onChange={e => setBulkTier(e.target.value)}
                  className="border border-white/30 bg-white/10 text-white rounded-lg px-3 py-1.5 text-xs font-dm focus:outline-none focus:border-white">
                  <option value="">Definir modalidade...</option>
                  <option value="Econômico">Econômico</option>
                  <option value="Elaborado">Elaborado</option>
                  <option value="">Sem modalidade (nulo)</option>
                </select>
                <button onClick={handleBulkChangeTier} disabled={bulkLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold font-dm transition-colors disabled:opacity-40">
                  {bulkLoading ? <Loader2 size={13} className="animate-spin" /> : null} Aplicar
                </button>
                <button onClick={handleBulkDelete} disabled={bulkLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D14237] hover:bg-[#B73427] text-white text-xs font-bold font-dm transition-colors disabled:opacity-40">
                  {bulkLoading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Apagar
                </button>
                <button onClick={clearSelection} className="p-1.5 text-white/60 hover:text-white transition-colors"><X size={16} /></button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-rose-300 font-dm">Carregando catálogo...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center">
                <span className="material-symbols-outlined text-6xl text-rose-200 mb-4">inventory_2</span>
                <h3 className="font-lora text-xl font-bold text-[#5C1F2E] mb-2">Nenhum produto encontrado</h3>
                <p className="font-dm text-rose-400 text-sm max-w-md">O seu catálogo está vazio ou a busca não retornou resultados.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-rose-50">
                    <th className="px-4 py-3.5 w-10">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll}
                        className="w-4 h-4 accent-[#D14237] rounded cursor-pointer" title="Selecionar todos" />
                    </th>
                    <th className="px-3 py-3.5 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider w-14">Foto</th>
                    <th className="px-3 py-3.5 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider">Produto</th>
                    <th className="px-3 py-3.5 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider">Categoria</th>
                    <th className="px-3 py-3.5 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider text-right">Preço</th>
                    <th className="px-3 py-3.5 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider text-center">Status</th>
                    <th className="px-3 py-3.5 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="font-dm text-sm divide-y divide-rose-50/60">
                  {filteredProducts.map(product => {
                    const isSelected = selectedIds.has(product.id);
                    return (
                      <tr key={product.id} className={`transition-colors ${isSelected ? "bg-rose-50" : "hover:bg-[#FAE8E6]/40"}`}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(product.id)}
                            className="w-4 h-4 accent-[#D14237] rounded cursor-pointer" />
                        </td>
                        <td className="px-3 py-3">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-lg object-cover border border-rose-100 shadow-sm" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center">
                              <ImagePlus size={16} className="text-rose-300" />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#5C1F2E]">{product.name}</span>
                            {product.tier === "Econômico" && <span className="text-[10px] bg-green-50 border border-green-200 text-green-700 px-1.5 py-0.5 rounded font-bold">Econômico</span>}
                            {product.tier === "Elaborado" && <span className="text-[10px] bg-purple-50 border border-purple-200 text-purple-700 px-1.5 py-0.5 rounded font-bold">Elaborado</span>}
                          </div>
                          {product.description && <div className="text-xs text-rose-400 mt-0.5 max-w-sm truncate">{product.description}</div>}
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-rose-400 border border-rose-100 bg-rose-50/50 px-2.5 py-1 rounded-lg text-[11px] font-bold">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="font-bold text-[#D14237]">R$ {product.unit_price.toFixed(2).replace(".", ",")}</div>
                          <div className="text-[10px] text-rose-300 font-medium uppercase tracking-wider mt-0.5">por {product.unit}</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {product.is_active
                            ? <span className="w-2 h-2 rounded-full bg-green-500 inline-block shadow-[0_0_8px_rgba(34,197,94,0.4)]" title="Ativo" />
                            : <span className="w-2 h-2 rounded-full bg-rose-300 inline-block" title="Inativo" />
                          }
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openModal(product)} className="p-2 text-rose-300 hover:text-[#5C1F2E] hover:bg-rose-50 rounded-lg transition-colors"><Edit2 size={15} /></button>
                            <button onClick={() => handleDelete(product.id)} className="p-2 text-rose-300 hover:text-[#D14237] hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Produto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#5C1F2E]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-brand-pink2 flex justify-between items-center bg-[#FAFAFA]">
              <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">
                {editingId ? "Editar Produto" : "Novo Produto"}
              </h2>
              <button onClick={closeModal} className="text-rose-400 hover:text-[#D14237] transition-colors p-1">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto font-dm">
              <form id="productForm" onSubmit={handleSubmit} className="flex flex-col gap-5">

                {/* Image Upload */}
                <div>
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-2 block">
                    Foto do Produto
                  </label>
                  <div className="flex items-center gap-4">
                    {/* Preview */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 rounded-xl border-2 border-dashed border-brand-pink2 flex items-center justify-center cursor-pointer hover:border-[#D14237] hover:bg-[#FAE8E6]/50 transition-all overflow-hidden relative group flex-shrink-0"
                    >
                      {imagePreview ? (
                        <>
                          <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-[#5C1F2E]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ImagePlus size={20} className="text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-rose-300">
                          <ImagePlus size={24} />
                          <span className="text-[10px] font-dm text-center leading-tight">Clique para<br/>adicionar</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-sm font-dm font-bold text-[#D14237] hover:text-[#B73427] flex items-center gap-1.5"
                      >
                        <ImagePlus size={16} />
                        {imagePreview ? "Trocar foto" : "Escolher foto"}
                      </button>
                      <p className="text-xs text-rose-300">JPG, PNG ou WebP. Máx. 5MB.</p>
                      {imagePreview && (
                        <button
                          type="button"
                          onClick={() => { setImagePreview(null); setPendingFile(null); setFormData({...formData, image_url: ""}); }}
                          className="text-xs text-rose-400 hover:text-[#D14237] flex items-center gap-1"
                        >
                          <X size={12} /> Remover foto
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-2 block">Nome do Produto *</label>
                  <input 
                    required
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] focus:ring-1 focus:ring-[var(--color-brand-red)]"
                    placeholder="Ex: Mini Quiche de Alho Poró"
                  />
                </div>
                
                <div>
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-2 block">Categoria *</label>
                  <select 
                    required
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] focus:ring-1 focus:ring-[var(--color-brand-red)] bg-white"
                  >
                    <option value="">Selecione uma categoria...</option>
                    {dbCategories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-rose-400 mt-1">Gerencie as categorias clicando no botão "Categorias" acima.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-2 block">Preço (R$) *</label>
                    <input 
                      required
                      type="number"
                      step="0.01"
                      value={formData.unit_price}
                      onChange={e => setFormData({...formData, unit_price: e.target.value})}
                      className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] focus:ring-1 focus:ring-[var(--color-brand-red)]"
                      placeholder="Ex: 150.00"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-2 block">Unidade de Medida *</label>
                    <input 
                      required
                      type="text" 
                      value={formData.unit}
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                      className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] focus:ring-1 focus:ring-[var(--color-brand-red)]"
                      placeholder="Ex: cento, unidade, kg"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-2 block">Descrição Detalhada</label>
                  <textarea 
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] focus:ring-1 focus:ring-[var(--color-brand-red)] min-h-[80px]"
                    placeholder="Composição, tamanho, detalhes..."
                  />
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <input 
                    type="checkbox" 
                    id="isActive"
                    checked={formData.is_active}
                    onChange={e => setFormData({...formData, is_active: e.target.checked})}
                    className="rounded border-[var(--color-brand-pink2)] text-[#D14237] focus:ring-[#D14237]"
                  />
                  <label htmlFor="isActive" className="text-sm text-[var(--color-brand-gray)] font-medium">Produto ativo (disponível para novos orçamentos)</label>
                </div>

                <div className="flex items-center gap-2 p-4 bg-[#FAE8E6]/30 rounded-xl border border-brand-pink2/50">
                  <input
                    type="checkbox"
                    id="isMultiple25"
                    checked={formData.is_multiple_of_25}
                    onChange={e => setFormData({...formData, is_multiple_of_25: e.target.checked})}
                    className="rounded border-[var(--color-brand-pink2)] text-[#D14237] focus:ring-[#D14237]"
                  />
                  <div>
                    <label htmlFor="isMultiple25" className="text-sm text-[#5C1F2E] font-bold block">Vendido em múltiplos de 25?</label>
                    <p className="text-[10px] text-rose-400">Marque para Salgados e Docinhos que são vendidos apenas em bandejas.</p>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-2 block">Tier do produto</label>
                  <div className="flex gap-2">
                    {([null, 'Econômico', 'Elaborado'] as const).map(t => (
                      <button
                        key={String(t)}
                        type="button"
                        onClick={() => setFormData({...formData, tier: t})}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                          formData.tier === t
                            ? t === 'Econômico'
                              ? 'bg-green-100 border-green-400 text-green-700'
                              : t === 'Elaborado'
                              ? 'bg-purple-100 border-purple-400 text-purple-700'
                              : 'bg-gray-100 border-gray-400 text-gray-600'
                            : 'border-brand-pink2 text-rose-300 hover:border-rose-300'
                        }`}
                      >
                        {t ?? 'Nenhum'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-rose-400 mt-1">Para salgados e sanduíches. Define se é produto econômico ou elaborado/sofisticado.</p>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t border-brand-pink2 bg-[#FAFAFA] flex justify-end gap-3">
              <button 
                type="button"
                onClick={closeModal}
                className="px-6 py-2.5 rounded-xl font-dm font-bold text-sm text-[var(--color-brand-gray)] hover:bg-[#FAE8E6] transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                form="productForm"
                disabled={saving || uploadingImage}
                className="bg-[#5C1F2E] hover:bg-[#4A1925] text-white px-6 py-2.5 rounded-xl font-dm font-bold text-sm flex items-center gap-2 shadow-lg shadow-[#5C1F2E]/20 transition-all disabled:opacity-50"
              >
                {(saving || uploadingImage) ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {uploadingImage ? "Enviando foto..." : saving ? "Salvando..." : "Salvar Produto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
