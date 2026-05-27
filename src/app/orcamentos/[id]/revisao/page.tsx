"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Trash2, Plus, Send, Save, Search, X, Truck, Loader2, Copy, CheckCircle, ChevronUp, ChevronDown, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function RevisaoOrcamento() {
  const params = useParams();
  const quoteId = params?.id as string;

  const [quote, setQuote] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Add product search modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");

  // Internal feedback
  const [internalFeedback, setInternalFeedback] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackSaved, setFeedbackSaved] = useState(false);

  // Delivery fee
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState("");
  const [allDeliveryFees, setAllDeliveryFees] = useState<any[]>([]);

  // categoryHierarchy can be string[] (old) or CategoryGroup[] (new)
  const [categoryHierarchy, setCategoryHierarchy] = useState<any[]>([]);

  useEffect(() => {
    if (quoteId) { 
      fetchQuote(); 
      fetchCatalog(); 
      fetchDeliveryFees(); 
      fetchHierarchy();
    }
  }, [quoteId]);

  const fetchHierarchy = async () => {
    const { data } = await supabase.from("settings").select("*").eq("key", "category_order").single();
    if (data) setCategoryHierarchy(data.value);
  };

  const fetchQuote = async () => {
    try {
      const { data, error } = await supabase
        .from("quotes")
        .select("*, quote_items(*, products(*))")
        .eq("id", quoteId)
        .single();
      if (error) throw error;
      setQuote(data);
      if (data.quote_items) {
        const sorted = data.quote_items.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
        setItems(sorted);
      }
      if (data.internal_feedback) {
        setInternalFeedback(data.internal_feedback);
      }
      if (data.delivery_fee) {
        setDeliveryFee(data.delivery_fee);
        setDeliveryNeighborhood(data.delivery_neighborhood || "");
      } else {
        // Fall back to delivery item already in quote_items
        const deliveryItem = (data.quote_items || []).find((i: any) =>
          i.description?.toLowerCase().includes("taxa de entrega")
        );
        if (deliveryItem) {
          setDeliveryFee(deliveryItem.unit_price);
          const parts = deliveryItem.description.split("—");
          if (parts[1]) setDeliveryNeighborhood(parts[1].trim());
        }
      }
    } catch (err) {
      console.error("Erro ao puxar orçamento", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    const { data } = await supabase.from("products").select("*").eq("is_active", true).order("category").order("name");
    if (data) setCatalogProducts(data);
  };

  const fetchDeliveryFees = async () => {
    const { data } = await supabase.from("delivery_fees").select("*").order("neighborhood");
    if (data) setAllDeliveryFees(data);
  };

  // Helper to determine step and unit display
  const getItemConfig = (item: any) => {
    let product = item.products;
    if (!product) {
      const desc = (item.description || "").toLowerCase();
      product = catalogProducts.find(p => p.name.toLowerCase() === desc);
    }
    const cat = (product?.category || "").toLowerCase();
    // Treat as multiple-of-25 if: flag is explicitly true OR category name contains "(cento)"
    const isMultipleOf25 = !!product?.is_multiple_of_25 || cat.includes("cento");

    return {
      step: isMultipleOf25 ? 25 : 1,
      displayUnit: isMultipleOf25 ? "un" : (item.unit || "un"),
      isMultipleOf25
    };
  };

  // Group items by category with better fallback
  const groupedItems = items.reduce((acc: any, item) => {
    let cat = "Outros";
    const desc = (item.description || "").toLowerCase();

    // 1. Force Logística for known service keywords
    if (
      item.item_type === "service" || 
      desc.includes("garçom") || 
      desc.includes("louça") || 
      desc.includes("serviço") || 
      desc.includes("mão de obra") ||
      desc.includes("taxa de entrega")
    ) {
      cat = "Logística";
    } 
    // 2. Use product category if joined
    else if (item.products?.category) {
      cat = item.products.category;
    }
    // 3. Fallback: Try to find category in catalog by name if product link is missing
    else {
      const catalogMatch = catalogProducts.find(p => p.name.toLowerCase() === desc);
      if (catalogMatch) {
        cat = catalogMatch.category;
      }
    }
    
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // Separate Food categories from Logistics/Others
  const allCategories = Object.keys(groupedItems);
  const foodCategories = allCategories.filter(c => c !== "Logística" && c !== "Outros");
  const logisticsCategories = allCategories.filter(c => c === "Logística" || c === "Outros");

  // Sort food categories — handles both old flat string[] and new CategoryGroup[] format
  const getCatSortKey = (cat: string): [number, number] => {
    if (categoryHierarchy.length === 0) return [9999, 9999];
    if (typeof categoryHierarchy[0] === 'string') {
      const idx = (categoryHierarchy as string[]).indexOf(cat);
      return idx !== -1 ? [idx, 0] : [9999, 0];
    }
    // Grouped format
    for (let gi = 0; gi < categoryHierarchy.length; gi++) {
      const subs: string[] = categoryHierarchy[gi].subcategories || [];
      const si = subs.indexOf(cat);
      if (si !== -1) return [gi, si];
    }
    return [9999, 9999];
  };

  const sortedFoodCats = foodCategories.sort((a, b) => {
    const [ga, sa] = getCatSortKey(a);
    const [gb, sb] = getCatSortKey(b);
    if (ga !== gb) return ga - gb;
    if (sa !== sb) return sa - sb;
    return a.localeCompare(b);
  });

  const sortedLogisticsCats = logisticsCategories.sort((a) => a === "Logística" ? -1 : 1);

  const subtotalNonPercent = items
    .filter(i => !i.unit?.toLowerCase().includes("%"))
    .reduce((acc, i) => {
      const itemTotal = Number(i.quantity) * Number(i.unit_price);
      return acc + itemTotal;
    }, 0);

  const grandTotal = items.reduce((acc, i) => {
    const isPercent = i.unit?.toLowerCase().includes("%");
    if (isPercent) {
      return acc + (subtotalNonPercent * (Number(i.unit_price) / 100) * Number(i.quantity));
    }
    const itemTotal = Number(i.quantity) * Number(i.unit_price);
    return acc + itemTotal;
  }, 0);

  const updateQty = (id: string, direction: 'up' | 'down' | number) => {
    setItems(items.map(i => {
      if (i.id !== id) return i;
      
      const { step, isMultipleOf25 } = getItemConfig(i);
      let currentQty = Number(i.quantity);
      
      // FORCE MULTIPLE OF 25 if needed
      if (isMultipleOf25 && currentQty % 25 !== 0) {
        currentQty = Math.round(currentQty / 25) * 25;
        if (currentQty < 25) currentQty = 25;
      }

      let newQty: number;
      if (typeof direction === 'number') {
        newQty = direction;
        if (isMultipleOf25 && newQty % 25 !== 0) {
          newQty = Math.ceil(newQty / 25) * 25;
        }
      } else {
        newQty = direction === 'up' ? currentQty + step : currentQty - step;
      }
      
      const minQty = isMultipleOf25 ? 25 : (i.item_type === 'service' ? 0.1 : 1);
      return { ...i, quantity: Math.max(minQty, newQty) };
    }));
  };

  const updatePrice = (id: string, newPrice: number) => {
    setItems(items.map(i => i.id !== id ? i : { ...i, unit_price: Math.max(0, newPrice) }));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  // Derive the display category key for an item (mirrors the groupedItems logic)
  const getItemCatKey = (item: any): string => {
    const desc = (item.description || "").toLowerCase();
    if (item.item_type === "service" || desc.includes("garçom") || desc.includes("louça") || desc.includes("serviço") || desc.includes("mão de obra") || desc.includes("taxa de entrega")) return "Logística";
    if (item.products?.category) return item.products.category;
    const match = catalogProducts.find(p => p.name.toLowerCase() === desc);
    return match?.category || "Outros";
  };

  const moveItemWithinCategory = (itemId: string, direction: 'up' | 'down') => {
    const itemIdx = items.findIndex(i => i.id === itemId);
    if (itemIdx === -1) return;
    const cat = getItemCatKey(items[itemIdx]);
    // Collect indices of all items in the same category, in display order
    const catIdxs = items.reduce<number[]>((acc, i, idx) => {
      if (getItemCatKey(i) === cat) acc.push(idx);
      return acc;
    }, []);
    const posInCat = catIdxs.indexOf(itemIdx);
    const swapPos = direction === 'up' ? posInCat - 1 : posInCat + 1;
    if (swapPos < 0 || swapPos >= catIdxs.length) return;
    const newItems = [...items];
    [newItems[catIdxs[posInCat]], newItems[catIdxs[swapPos]]] = [newItems[catIdxs[swapPos]], newItems[catIdxs[posInCat]]];
    setItems(newItems);
  };

  const addProductFromCatalog = (product: any) => {
    const isMultipleOf25 = !!product.is_multiple_of_25;
    const newItem = {
      id: `new-${Date.now()}`,
      quote_id: quoteId,
      description: product.name,
      quantity: isMultipleOf25 ? 25 : 1,
      unit: product.unit,
      unit_price: product.unit_price,
      item_type: "product",
      product_id: product.id,
      products: product,
      isNew: true
    };
    setItems([...items, newItem]);
    setShowAddModal(false);
  };

  const handleDeliverySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) { 
      setDeliveryFee(0); 
      setDeliveryNeighborhood(""); 
      // Remove delivery item if it exists and "No delivery" is selected
      setItems(prev => prev.filter(i => !i.description.toLowerCase().includes("taxa de entrega")));
      return; 
    }
    
    const fee = allDeliveryFees.find(f => f.id === val);
    if (fee) { 
      setDeliveryFee(fee.fee_amount); 
      setDeliveryNeighborhood(fee.neighborhood); 
      
      const deliveryItemName = `Taxa de Entrega (${fee.neighborhood})`;
      
      setItems(prev => {
        const exists = prev.find(i => i.description.toLowerCase().includes("taxa de entrega"));
        if (exists) {
          return prev.map(i => i.description.toLowerCase().includes("taxa de entrega") 
            ? { ...i, description: deliveryItemName, unit_price: fee.fee_amount, quantity: 1 } 
            : i
          );
        } else {
          return [...prev, {
            id: `delivery-${Date.now()}`,
            quote_id: quoteId,
            description: deliveryItemName,
            quantity: 1,
            unit: "entrega",
            unit_price: fee.fee_amount,
            item_type: "service"
          }];
        }
      });
    }
  };

  const handleApproveAndShare = async () => {
    try {
      setApproving(true);
      await supabase.from("quote_items").delete().eq("quote_id", quoteId);
      const toInsert = items.map((item, idx) => {
        let pid = item.product_id;
        if (!pid && catalogProducts.length > 0) {
          const desc = (item.description || "").toLowerCase();
          const match = catalogProducts.find(p => p.name.toLowerCase() === desc);
          if (match) pid = match.id;
        }
        return {
          quote_id: quoteId,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          item_type: item.item_type || "product",
          sort_order: idx,
          product_id: pid || null,
        };
      });
      if (toInsert.length > 0) await supabase.from("quote_items").insert(toInsert);
      await supabase.from("quotes").update({
        status: "aguardando",
        total_value: grandTotal,
        delivery_fee: deliveryFee,
        delivery_neighborhood: deliveryNeighborhood,
      }).eq("id", quoteId);
      await fetchQuote();
    } catch (err: any) {
      alert("Erro: " + err.message);
    } finally {
      setApproving(false);
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/proposta/${quoteId}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const saveInternalFeedback = async () => {
    if (!internalFeedback.trim()) return;
    setFeedbackSaving(true);
    await supabase.from("quotes").update({
      internal_feedback: internalFeedback.trim(),
      internal_feedback_at: new Date().toISOString(),
    }).eq("id", quoteId);
    setFeedbackSaving(false);
    setFeedbackSaved(true);
    setTimeout(() => setFeedbackSaved(false), 2500);
  };

  const saveChanges = async () => {
    try {
      setSaving(true);
      await supabase.from("quote_items").delete().eq("quote_id", quoteId);
      const toInsert = items.map((item, idx) => {
        let pid = item.product_id;
        if (!pid && catalogProducts.length > 0) {
          const desc = (item.description || "").toLowerCase();
          const match = catalogProducts.find(p => p.name.toLowerCase() === desc);
          if (match) pid = match.id;
        }
        return {
          quote_id: quoteId,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          item_type: item.item_type || "product",
          sort_order: idx,
          product_id: pid || null,
        };
      });
      if (toInsert.length > 0) {
        const { error } = await supabase.from("quote_items").insert(toInsert);
        if (error) throw error;
      }
      await supabase.from("quotes").update({
        total_value: grandTotal,
        delivery_fee: deliveryFee,
        delivery_neighborhood: deliveryNeighborhood
      }).eq("id", quoteId);
      alert("Salvo com sucesso!");
      fetchQuote();
    } catch (err: any) {
      alert("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredCatalog = catalogProducts.filter(p => {
    const matchCat = selectedCategory === "Todas" || p.category === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });
  const catalogCategories = ["Todas", ...Array.from(new Set(catalogProducts.map(p => p.category)))];

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#5C1F2E] font-lora text-xl">Carregando...</div>;
  if (!quote) return <div className="min-h-screen p-20 text-center">Orçamento não encontrado.</div>;

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] flex justify-center pb-20">
      <div className="w-full max-w-[1200px] px-6 pt-10 flex flex-col gap-8">

        {/* Header */}
        <header className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/orcamentos`} className="text-[var(--color-brand-wine)] bg-[var(--color-brand-pink)] p-2.5 rounded-full hover:bg-[var(--color-brand-pink2)] transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="font-lora font-bold text-3xl text-[var(--color-brand-wine)]">Revisão do Orçamento</h1>
              <div className="flex items-center text-sm font-medium text-[var(--color-brand-wine2)] mt-1 gap-2">
                {quote.event_type} — {quote.client_name}
                <span className="text-[11px] px-2 py-0.5 rounded-md border border-[var(--color-brand-pink2)] bg-white text-[var(--color-brand-gray)]">{quote.status?.toUpperCase()}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={saveChanges} disabled={saving || approving} className="bg-white border border-[var(--color-brand-pink2)] hover:border-[var(--color-brand-red)] text-[var(--color-brand-red)] rounded-[10px] px-6 py-2.5 font-dm text-sm font-semibold flex items-center gap-2 transition-colors">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Salvando..." : "Salvar"}
            </button>
            {quote.status === "rascunho" ? (
              <button onClick={handleApproveAndShare} disabled={approving || saving} className="bg-[#D14237] hover:bg-[#B73427] disabled:opacity-50 text-white rounded-[10px] px-6 py-2.5 font-dm text-sm font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-[#D14237]/20">
                {approving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {approving ? "Aprovando..." : "Aprovar e Compartilhar"}
              </button>
            ) : (
              <button onClick={copyLink} className="bg-[#D14237] hover:bg-[#B73427] text-white rounded-[10px] px-6 py-2.5 font-dm text-sm font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-[#D14237]/20">
                {linkCopied ? <CheckCircle size={16} /> : <Copy size={16} />}
                {linkCopied ? "Link Copiado!" : "Copiar Link"}
              </button>
            )}
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
          <div className="flex flex-col gap-6">

            {/* CARD 1: ALIMENTAÇÃO (FOOD) */}
            <section className="bg-white rounded-2xl shadow-sm border border-[var(--color-brand-pink2)] overflow-hidden">
              <div className="p-5 flex justify-between items-center border-b border-[var(--color-brand-pink)]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#D14237]">restaurant_menu</span>
                  <h3 className="font-lora font-bold text-xl text-[var(--color-brand-wine)]">Produtos e Cardápio</h3>
                </div>
                <button onClick={() => setShowAddModal(true)} className="text-[var(--color-brand-red)] bg-white border border-[var(--color-brand-pink2)] hover:bg-[var(--color-brand-pink)] px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
                  <Plus size={16} /> Adicionar Item
                </button>
              </div>

              <div className="divide-y divide-[#F5D8D5]/40">
                {sortedFoodCats.length === 0 && (
                  <p className="p-8 text-center text-sm text-rose-300 font-dm">Nenhum item de alimentação.</p>
                )}
                
                {sortedFoodCats.map(category => (
                  <div key={category} className="flex flex-col">
                    <div className="bg-[#FAF5F3] px-5 py-2 text-[10px] font-bold text-[#5C1F2E] uppercase tracking-[0.15em] border-y border-[#F5D8D5]/40 flex items-center justify-between">
                      {category}
                      <span className="text-rose-300 font-normal lowercase tracking-normal italic">{groupedItems[category].length} item(ns)</span>
                    </div>
                    
                    <div className="divide-y divide-[#F5D8D5]/30">
                      {groupedItems[category].map((item: any, itemPosInCat: number) => {
                        let product = item.products;
                        if (!product) {
                          const desc = (item.description || "").toLowerCase();
                          product = catalogProducts.find(p => p.name.toLowerCase() === desc);
                        }
                        const { displayUnit } = getItemConfig(item);
                        const isPercent = item.unit?.toLowerCase().includes("%");
                        const itemSubtotal = isPercent
                          ? (subtotalNonPercent * (Number(item.unit_price) / 100) * Number(item.quantity))
                          : (Number(item.quantity) * Number(item.unit_price));
                        const catLength = groupedItems[category].length;

                        return (
                          <div key={item.id} className="flex items-center gap-3 px-5 py-4 hover:bg-[#FAF5F3]/50 transition-colors">
                            {/* Sort handle: up/down within category */}
                            <div className="flex flex-col gap-0.5 flex-shrink-0">
                              <button
                                onClick={() => moveItemWithinCategory(item.id, 'up')}
                                disabled={itemPosInCat === 0}
                                className="w-5 h-5 flex items-center justify-center text-rose-200 hover:text-[#D14237] disabled:opacity-20 rounded transition-colors"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                onClick={() => moveItemWithinCategory(item.id, 'down')}
                                disabled={itemPosInCat === catLength - 1}
                                className="w-5 h-5 flex items-center justify-center text-rose-200 hover:text-[#D14237] disabled:opacity-20 rounded transition-colors"
                              >
                                <ChevronDown size={14} />
                              </button>
                            </div>
                            <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden border border-[var(--color-brand-pink2)] bg-[#FAE8E6]">
                              {product?.image_url ? (
                                <img src={product.image_url} alt={item.description} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-rose-200 text-[10px] font-dm text-center px-1">sem foto</div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-[#5C1F2E] text-sm truncate">{item.description}</div>
                              {product?.description && <div className="text-xs text-rose-400 mt-0.5 truncate">{product.description}</div>}
                              <div className="text-xs text-rose-400 mt-1 italic">por {displayUnit}</div>
                            </div>
                            <div className="text-right flex-shrink-0 mr-3">
                              <div className="flex items-center gap-1 justify-end mb-1">
                                <span className="text-[10px] text-rose-300">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={Number(item.unit_price).toFixed(2)}
                                  onChange={e => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                                  className="w-16 text-right text-[10px] text-rose-400 bg-transparent border-b border-dashed border-rose-200 focus:border-[#D14237] focus:outline-none"
                                  title="Editar preço unitário (desconto)"
                                />
                                <span className="text-[10px] text-rose-300">/ un</span>
                              </div>
                              <div className="font-bold text-[#D14237] text-base">R$ {itemSubtotal.toFixed(2).replace(".", ",")}</div>
                            </div>
                            {(() => {
                              const cfg = getItemConfig(item);
                              return (
                                <div className="flex items-center gap-1 bg-[#FAE8E6]/50 rounded-lg px-2 py-1 flex-shrink-0">
                                  <button onClick={() => updateQty(item.id, 'down')} className="w-6 h-6 flex items-center justify-center text-[#5C1F2E] font-bold hover:bg-white rounded transition-colors">−</button>
                                  <input
                                    type="number"
                                    min={cfg.isMultipleOf25 ? 25 : 1}
                                    step={cfg.step}
                                    value={item.quantity}
                                    onChange={e => updateQty(item.id, parseFloat(e.target.value) || (cfg.isMultipleOf25 ? 25 : 1))}
                                    onBlur={e => {
                                      const v = parseFloat(e.target.value) || 0;
                                      if (cfg.isMultipleOf25) {
                                        const snapped = Math.max(25, Math.ceil(v / 25) * 25);
                                        if (snapped !== v) updateQty(item.id, snapped);
                                      }
                                    }}
                                    className="w-12 text-center text-sm font-bold text-[#5C1F2E] bg-transparent border-none outline-none"
                                  />
                                  <button onClick={() => updateQty(item.id, 'up')} className="w-6 h-6 flex items-center justify-center text-[#5C1F2E] font-bold hover:bg-white rounded transition-colors">+</button>
                                </div>
                              );
                            })()}
                            <button onClick={() => removeItem(item.id)} className="p-2 text-rose-200 hover:text-[#D14237] transition-colors"><Trash2 size={16} /></button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* CARD 2: LOGÍSTICA E SERVIÇOS */}
            {sortedLogisticsCats.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm border border-[var(--color-brand-pink2)] overflow-hidden">
                <div className="p-5 border-b border-[var(--color-brand-pink)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#D14237]">engineering</span>
                    <h3 className="font-lora font-bold text-xl text-[var(--color-brand-wine)]">Logística e Serviços</h3>
                  </div>
                  
                  <div className="flex items-center gap-3 bg-[#FDF6F2] p-2 rounded-xl border border-[var(--color-brand-pink2)] min-w-[280px]">
                    <Truck size={16} className="text-rose-400 ml-2" />
                    <select
                      onChange={handleDeliverySelect}
                      value={allDeliveryFees.find(f => f.neighborhood === deliveryNeighborhood)?.id || ""}
                      className="bg-transparent text-[11px] font-bold text-[#5C1F2E] uppercase tracking-wider focus:outline-none w-full cursor-pointer"
                    >
                      <option value="">Retirada no local (R$ 0,00)</option>
                      {allDeliveryFees.map(f => (
                        <option key={f.id} value={f.id}>{f.neighborhood} — R$ {Number(f.fee_amount).toFixed(2).replace('.', ',')}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="divide-y divide-[#F5D8D5]/40">
                  {sortedLogisticsCats.map(category => (
                    <div key={category} className="flex flex-col">
                      <div className="bg-[#FDF6F2] px-5 py-2 text-[10px] font-bold text-[#5C1F2E] uppercase tracking-[0.15em] border-y border-[#F5D8D5]/40">
                        {category}
                      </div>
                      <div className="divide-y divide-[#F5D8D5]/30">
                        {groupedItems[category].map((item: any, itemPosInCat: number) => {
                          const catLength = groupedItems[category].length;
                          return (
                          <div key={item.id} className="flex items-center gap-3 px-5 py-4 hover:bg-[#FAF5F3]/50 transition-colors">
                            <div className="flex flex-col gap-0.5 flex-shrink-0">
                              <button onClick={() => moveItemWithinCategory(item.id, 'up')} disabled={itemPosInCat === 0} className="w-5 h-5 flex items-center justify-center text-rose-200 hover:text-[#D14237] disabled:opacity-20 rounded transition-colors"><ChevronUp size={14} /></button>
                              <button onClick={() => moveItemWithinCategory(item.id, 'down')} disabled={itemPosInCat === catLength - 1} className="w-5 h-5 flex items-center justify-center text-rose-200 hover:text-[#D14237] disabled:opacity-20 rounded transition-colors"><ChevronDown size={14} /></button>
                            </div>
                            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#FAE8E6] border border-[var(--color-brand-pink2)] flex items-center justify-center">
                              <span className="material-symbols-outlined text-rose-400">person</span>
                            </div>
                            <div className="flex-1">
                              <div className="font-bold text-[#5C1F2E] text-sm">{item.description}</div>
                              <div className="text-xs text-rose-400 mt-0.5">{item.unit}</div>
                            </div>
                            <div className="text-right flex-shrink-0 mr-3">
                              <div className="text-[10px] text-rose-300 mb-1">
                                {item.unit?.toLowerCase().includes("%")
                                  ? `${item.unit_price}% sobre total`
                                  : (
                                    <span className="flex items-center gap-1 justify-end">
                                      R$
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={Number(item.unit_price).toFixed(2)}
                                        onChange={e => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                                        className="w-16 text-right text-[10px] text-rose-400 bg-transparent border-b border-dashed border-rose-200 focus:border-[#D14237] focus:outline-none"
                                        title="Editar preço unitário (desconto)"
                                      />
                                      / un
                                    </span>
                                  )}
                              </div>
                              <div className="font-bold text-[#D14237] text-base">
                                R$ {(item.unit?.toLowerCase().includes("%")
                                  ? (subtotalNonPercent * (Number(item.unit_price) / 100) * Number(item.quantity))
                                  : (Number(item.quantity) * Number(item.unit_price))
                                ).toFixed(2).replace(".", ",")}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 bg-[#FAE8E6]/50 rounded-lg px-2 py-1 flex-shrink-0">
                              <button onClick={() => updateQty(item.id, 'down')} className="w-6 h-6 flex items-center justify-center text-[#5C1F2E] font-bold hover:bg-white rounded transition-colors">−</button>
                              <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={item.quantity}
                                onChange={e => updateQty(item.id, parseFloat(e.target.value) || 1)}
                                className="w-12 text-center text-sm font-bold text-[#5C1F2E] bg-transparent border-none outline-none"
                              />
                              <button onClick={() => updateQty(item.id, 'up')} className="w-6 h-6 flex items-center justify-center text-[#5C1F2E] font-bold hover:bg-white rounded transition-colors">+</button>
                            </div>
                            <button onClick={() => removeItem(item.id)} className="p-2 text-rose-200 hover:text-[#D14237] transition-colors"><Trash2 size={16} /></button>
                          </div>
                        );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}


            {/* TOTAL */}
            <div className="bg-[#5C1F2E] rounded-2xl p-6 flex justify-between items-center shadow-xl">
              <div className="flex flex-col">
                <span className="font-bold text-[10px] uppercase tracking-[0.2em] text-rose-200/50 mb-1">Valor Total Final</span>
                <span className="text-white text-xs opacity-60 font-dm italic">Incluindo produtos, logística e frete</span>
              </div>
              <span className="font-lora text-4xl font-bold text-[#E8635A]">R$ {grandTotal.toFixed(2).replace(".", ",")}</span>
            </div>

            {/* Notas */}
            <section className="bg-white rounded-2xl shadow-sm border border-[var(--color-brand-pink2)] p-6">
              <h3 className="font-lora font-bold text-xl text-[var(--color-brand-wine)] mb-4">Informações de Contrato</h3>
              <textarea
                className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-4 font-dm text-sm text-[var(--color-brand-gray)] focus:outline-none focus:border-[var(--color-brand-red)] min-h-[100px] bg-[#FAFAFA] resize-y"
                defaultValue={quote.notes || "Orçamento válido por 7 dias a partir da data de envio.\nServiço inclui toda estrutura necessária para servir os alimentos com excelência, conforme padrão de qualidade Marília de Dirceu."}
              />
            </section>
          </div>

          {/* Right Column: Metadados */}
          <aside className="w-full flex flex-col gap-6">

            {/* Share / Approve Card */}
            <div className="bg-[#5C1F2E] rounded-2xl p-6 shadow-lg text-white">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-4">Proposta para o Cliente</h3>
              {quote.status === "rascunho" ? (
                <>
                  <p className="text-xs text-white/50 font-dm mb-4 leading-relaxed">Revise os itens e clique para aprovar. O link será gerado para compartilhar com o cliente.</p>
                  <button onClick={handleApproveAndShare} disabled={approving || saving} className="w-full bg-[#D14237] hover:bg-[#B73427] disabled:opacity-50 text-white py-3 rounded-xl font-dm font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-black/20">
                    {approving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {approving ? "Aprovando..." : "Aprovar e Gerar Link"}
                  </button>
                </>
              ) : (
                <>
                  <div className={`text-[10px] font-bold uppercase tracking-wider mb-4 flex items-center gap-2 ${quote.status === "aprovado" ? "text-green-400" : "text-rose-300"}`}>
                    <CheckCircle size={12} />
                    {quote.status === "aprovado" ? "Aprovado pelo cliente" : "Aguardando aprovação"}
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-[11px] text-white/60 font-mono break-all mb-3">
                    {typeof window !== "undefined" ? `${window.location.origin}/proposta/${quoteId}` : `/proposta/${quoteId}`}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={copyLink} className="flex-1 bg-white/15 hover:bg-white/25 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all">
                      {linkCopied ? <CheckCircle size={13} /> : <Copy size={13} />}
                      {linkCopied ? "Copiado!" : "Copiar Link"}
                    </button>
                    <button onClick={() => window.open(`/proposta/${quoteId}`, "_blank")} className="flex-1 bg-[#D14237] hover:bg-[#B73427] text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all">
                      <Send size={13} /> Ver
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Internal feedback card */}
            <div className="bg-white border border-[var(--color-brand-pink2)] rounded-2xl p-6 shadow-sm">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-rose-400 mb-1 flex items-center gap-2">
                <MessageSquare size={13} className="text-rose-400" /> Como poderia ter sido melhor?
              </h3>
              <p className="text-[11px] text-rose-300 font-dm mb-3 leading-relaxed">
                Anotações internas sobre o que a IA poderia ter calculado diferente. Aparece no painel de Revisões IA.
              </p>
              <textarea
                value={internalFeedback}
                onChange={e => setInternalFeedback(e.target.value)}
                rows={3}
                className="w-full border border-[var(--color-brand-pink2)] rounded-xl p-3 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[var(--color-brand-red)] leading-relaxed placeholder:text-rose-200 resize-none"
                placeholder="Ex: Faltou salgadinho de frango. O bolo veio duplicado para 40 pessoas..."
              />
              <button
                onClick={saveInternalFeedback}
                disabled={feedbackSaving || !internalFeedback.trim()}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 bg-[#5C1F2E] hover:bg-[#4A1925] disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors"
              >
                {feedbackSaving ? <Loader2 size={14} className="animate-spin" /> : feedbackSaved ? <CheckCircle size={14} /> : <Save size={14} />}
                {feedbackSaving ? "Salvando..." : feedbackSaved ? "Salvo!" : "Salvar anotação"}
              </button>
            </div>

            <div className="bg-[#FAEBEB] border border-[#F0D5D5] rounded-2xl p-6 shadow-sm">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-brand-red)] mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--color-brand-red)] inline-block"></span>Dados do Cliente
              </h3>
              <div className="text-[14px] text-[var(--color-brand-wine)] font-bold mb-0.5">{quote.client_name}</div>
              {quote.client_phone && <div className="text-[13px] text-[var(--color-brand-gray)]">{quote.client_phone}</div>}

              <div className="border-t border-[#F0D5D5] my-5" />

              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-brand-red)] mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--color-brand-red)] inline-block"></span>Metadados do Evento
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Data", value: quote.event_date ? new Date(quote.event_date).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—" },
                  { label: "Período", value: quote.period || "—" },
                  { label: "Convidados", value: `${quote.guests} pessoas` },
                  { label: "Duração", value: `${quote.duration_hours} horas` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/70 p-3 rounded-xl border border-white">
                    <div className="text-[10px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wide mb-1">{label}</div>
                    <div className="text-[13px] font-semibold text-[var(--color-brand-wine2)]">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </main>
      </div>

      {/* ADD PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-[#5C1F2E]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-[var(--color-brand-pink2)] flex justify-between items-center bg-[#FAFAFA]">
              <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">Adicionar Produto do Catálogo</h2>
              <button onClick={() => setShowAddModal(false)} className="text-rose-400 hover:text-[#D14237]"><X size={20} /></button>
            </div>
            <div className="p-4 border-b border-[var(--color-brand-pink2)] flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-300" size={16} />
                <input
                  type="text"
                  placeholder="Buscar produto..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--color-brand-pink2)] text-sm font-dm focus:outline-none focus:border-[var(--color-brand-red)]"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="border border-[var(--color-brand-pink2)] rounded-xl px-3 py-2 text-sm font-dm bg-white focus:outline-none focus:border-[var(--color-brand-red)]"
              >
                {catalogCategories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-[#F5D8D5]/60">
              {filteredCatalog.map(product => (
                <button
                  key={product.id}
                  onClick={() => addProductFromCatalog(product)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#FAE8E6]/50 transition-colors text-left"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-[var(--color-brand-pink2)] bg-[#FAE8E6]">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-rose-200 text-[10px]">—</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#5C1F2E] text-sm">{product.name}</div>
                    <div className="text-xs text-rose-400">{product.category} · por {product.unit}</div>
                  </div>
                  <div className="font-bold text-[#D14237] text-sm flex-shrink-0">R$ {Number(product.unit_price).toFixed(2).replace(".", ",")}</div>
                </button>
              ))}
              {filteredCatalog.length === 0 && (
                <p className="p-10 text-center text-rose-300 text-sm font-dm">Nenhum produto encontrado.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
