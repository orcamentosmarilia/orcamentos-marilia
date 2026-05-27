"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Edit2, Trash2, X, Save, Box, Truck, Sparkles, ImagePlus, Loader2, Coffee } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { useRef } from "react";

interface Service {
  id: string;
  name: string;
  category: string;
  pricing_type: string;
  base_price: number;
  extra_price: number;
  ratio_x: number;
  ratio_y: number;
  multiple_of: number;
  ratio_ref: string;
  is_tableware: boolean;
  is_active: boolean;
  image_url?: string;
}

interface DeliveryFee {
  id: string;
  neighborhood: string;
  city: string;
  fee_amount: number;
}

interface EventProfile {
  id: string;
  name: string;
  prompt_rules: string;
  is_active: boolean;
  image_url?: string;
}

interface DrinkMapping {
  id: string;
  label: string;
  productName: string;
}

export default function LogisticaPage() {
  const [activeTab, setActiveTab] = useState<"services" | "delivery" | "profiles" | "drinks">("services");
  
  const [services, setServices] = useState<Service[]>([]);
  const [deliveryFees, setDeliveryFees] = useState<DeliveryFee[]>([]);
  const [profiles, setProfiles] = useState<EventProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal Service
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<Partial<Service>>({
    name: "", category: "Equipe", pricing_type: "time_based",
    base_price: 0, extra_price: 0, ratio_x: 1, ratio_y: 1, multiple_of: 0, ratio_ref: "", is_tableware: false, is_active: true, image_url: ""
  });

  // Modal Delivery
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null);
  const [deliveryForm, setDeliveryForm] = useState<Partial<DeliveryFee>>({
    neighborhood: "", city: "Belo Horizonte", fee_amount: 0
  });

  // Modal Profile
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState<Partial<EventProfile>>({
    name: "", prompt_rules: "", is_active: true, image_url: ""
  });
  
  // Image upload state
  const serviceFileRef = useRef<HTMLInputElement>(null);
  const profileFileRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);

  // Drink Mappings
  const [drinkMappings, setDrinkMappings] = useState<DrinkMapping[]>([]);
  const [drinkProducts, setDrinkProducts] = useState<{id: string; name: string; category: string}[]>([]);
  const [savingDrinks, setSavingDrinks] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [resServices, resDelivery, resProfiles, resDrinkSettings, resDrinkProducts] = await Promise.all([
        supabase.from("services").select("*").order("name"),
        supabase.from("delivery_fees").select("*").order("neighborhood"),
        supabase.from("event_profiles").select("*").order("name"),
        supabase.from("settings").select("value").eq("key", "drink_mappings").single(),
        supabase.from("products").select("id,name,category").in("category", ["Bebidas", "Sucos Naturais"]).eq("is_active", true).order("name"),
      ]);

      if (resServices.error) throw resServices.error;
      if (resDelivery.error) throw resDelivery.error;
      if (resProfiles.error) throw resProfiles.error;

      setServices(resServices.data || []);
      setDeliveryFees(resDelivery.data || []);
      setProfiles(resProfiles.data || []);
      setDrinkProducts(resDrinkProducts.data || []);

      const DEFAULT_DRINK_MAPPINGS: DrinkMapping[] = [
        { id: 'cafe',             label: 'Café',             productName: 'Café Expresso'      },
        { id: 'agua',             label: 'Água',             productName: 'Água Mineral 1,5L'  },
        { id: 'refrigerante',     label: 'Refrigerante',     productName: 'Coca-Cola 2L'       },
        { id: 'suco_natural',     label: 'Suco Natural',     productName: 'Suco Laranja 500ml' },
        { id: 'agua_gas',         label: 'Água com Gás',     productName: 'Água Gasosa 500ml'  },
        { id: 'suco_tetrapak',    label: 'Suco Tetrapak',    productName: 'Suco Tetra Pack 1L' },
        { id: 'leite',            label: 'Leite',            productName: 'Leite'              },
        { id: 'cha',              label: 'Chá',              productName: 'Chá'                },
        { id: 'chocolate_quente', label: 'Chocolate Quente', productName: 'Chocolate Quente'   },
      ];
      const saved = resDrinkSettings.data?.value;
      setDrinkMappings(Array.isArray(saved) ? saved : DEFAULT_DRINK_MAPPINGS);
    } catch (error) {
      console.error("Erro ao carregar logística:", error);
    } finally {
      setLoading(false);
    }
  }

  // ---- Drink Mappings Actions ----
  const addDrinkMapping = () => {
    const newId = `drink_${Date.now()}`;
    setDrinkMappings(prev => [...prev, { id: newId, label: '', productName: '' }]);
  };

  const updateDrinkMapping = (id: string, field: 'label' | 'productName', value: string) => {
    setDrinkMappings(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  };

  const removeDrinkMapping = (id: string) => {
    setDrinkMappings(prev => prev.filter(d => d.id !== id));
  };

  const saveDrinkMappings = async () => {
    setSavingDrinks(true);
    try {
      const { error } = await supabase.from('settings').upsert(
        { key: 'drink_mappings', value: drinkMappings, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );
      if (error) throw error;
      alert('Tipos de bebida salvos com sucesso!');
    } catch (err: any) {
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSavingDrinks(false);
    }
  };

  // ---- Service Actions ----
  const openServiceModal = (s?: Service) => {
    if (s) {
      setEditingServiceId(s.id);
      setServiceForm(s);
      setImagePreview(s.image_url || null);
    } else {
      setEditingServiceId(null);
      setServiceForm({ name: "", category: "Equipe", pricing_type: "time_based", base_price: 0, extra_price: 0, ratio_x: 1, ratio_y: 1, multiple_of: 0, ratio_ref: "", is_tableware: false, is_active: true, image_url: "" });
      setImagePreview(null);
    }
    setPendingFile(null);
    setIsServiceModalOpen(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setPendingFile(file);
  };

  const uploadFile = async (id: string, bucket: string): Promise<string | null> => {
    if (!pendingFile) return null;
    setUploadingImage(true);
    try {
      const ext = pendingFile.name.split(".").pop();
      const path = `${id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, pendingFile, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
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

  const saveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const id = editingServiceId || crypto.randomUUID();
      let imageUrl = serviceForm.image_url;
      
      if (pendingFile) {
        const uploadedUrl = await uploadFile(id, "service-images");
        if (uploadedUrl) imageUrl = uploadedUrl;
      }

      const payload = { ...serviceForm, image_url: imageUrl };

      if (editingServiceId) {
        await supabase.from("services").update(payload).eq("id", editingServiceId);
      } else {
        await supabase.from("services").insert([{ id, ...payload }]);
      }
      fetchData();
      setIsServiceModalOpen(false);
    } catch (err: any) {
      alert("Erro ao salvar serviço: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteService = async (id: string) => {
    if (!confirm("Remover este serviço?")) return;
    try {
      // Try to remove image from storage
      await supabase.storage.from("service-images").remove([`${id}.jpg`, `${id}.jpeg`, `${id}.png`, `${id}.webp`]);
      await supabase.from("services").delete().eq("id", id);
      fetchData();
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  // ---- Delivery Actions ----
  const openDeliveryModal = (d?: DeliveryFee) => {
    if (d) {
      setEditingDeliveryId(d.id);
      setDeliveryForm(d);
    } else {
      setEditingDeliveryId(null);
      setDeliveryForm({ neighborhood: "", city: "Belo Horizonte", fee_amount: 0 });
    }
    setIsDeliveryModalOpen(true);
  };

  const saveDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingDeliveryId) {
        await supabase.from("delivery_fees").update(deliveryForm).eq("id", editingDeliveryId);
      } else {
        await supabase.from("delivery_fees").insert([deliveryForm]);
      }
      fetchData();
      setIsDeliveryModalOpen(false);
    } catch (err: any) {
      alert("Erro ao salvar taxa: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteDelivery = async (id: string) => {
    if (!confirm("Remover esta taxa de entrega?")) return;
    await supabase.from("delivery_fees").delete().eq("id", id);
    fetchData();
  };

  // ---- Profile Actions ----
  const openProfileModal = (p?: EventProfile) => {
    if (p) {
      setEditingProfileId(p.id);
      setProfileForm(p);
      setImagePreview(p.image_url || null);
    } else {
      setEditingProfileId(null);
      setProfileForm({ name: "", prompt_rules: "", is_active: true, image_url: "" });
      setImagePreview(null);
    }
    setPendingFile(null);
    setIsProfileModalOpen(true);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const id = editingProfileId || crypto.randomUUID();
      let imageUrl = profileForm.image_url;

      if (pendingFile) {
        const uploadedUrl = await uploadFile(id, "profile-images");
        if (uploadedUrl) imageUrl = uploadedUrl;
      }

      const payload = { ...profileForm, image_url: imageUrl };

      if (editingProfileId) {
        await supabase.from("event_profiles").update(payload).eq("id", editingProfileId);
      } else {
        await supabase.from("event_profiles").insert([{ id, ...payload }]);
      }
      fetchData();
      setIsProfileModalOpen(false);
    } catch (err: any) {
      alert("Erro ao salvar perfil: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteProfile = async (id: string) => {
    if (!confirm("Remover este modelo de evento?")) return;
    try {
      // Try to remove image from storage
      await supabase.storage.from("profile-images").remove([`${id}.jpg`, `${id}.jpeg`, `${id}.png`, `${id}.webp`]);
      await supabase.from("event_profiles").delete().eq("id", id);
      fetchData();
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  const formatPricingType = (type: string, s?: Partial<Service>) => {
    switch (type) {
      case "percentage": return "% sobre o pedido";
      case "time_based": return "Valor por hora";
      case "per_person": return "Valor por pessoa";
      case "ratio_based": return `${s?.ratio_x ?? "X"} unid a cada ${s?.ratio_y ?? "Y"} pessoas`;
      case "per_salgado_type": return `${s?.ratio_x ?? "X"} unid/tipo (lim. ${s?.ratio_y ?? "Y"} salg)`;
      case "fixed_plus_percent": return `R$ ${s?.base_price?.toFixed(2) ?? "0"} + ${s?.extra_price ?? "0"}%`;
      case "ratio_of_item": return `${s?.ratio_x ?? "X"} a cada ${s?.ratio_y ?? "Y"} ${s?.ratio_ref || "item"}`;
      default: return type;
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Logística"
        description="Gerencie taxas, mão de obra e os modelos de pacotes para a IA."
        actions={
          <div className="flex bg-[#FAE8E6] p-1 rounded-xl">
            <button onClick={() => setActiveTab("services")} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-dm font-bold text-sm transition-all ${activeTab === 'services' ? 'bg-white text-[#D14237] shadow-sm' : 'text-[#5C1F2E]/70 hover:text-[#5C1F2E]'}`}>
              <Box size={15} /> Serviços
            </button>
            <button onClick={() => setActiveTab("delivery")} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-dm font-bold text-sm transition-all ${activeTab === 'delivery' ? 'bg-white text-[#D14237] shadow-sm' : 'text-[#5C1F2E]/70 hover:text-[#5C1F2E]'}`}>
              <Truck size={15} /> Entregas
            </button>
            <button onClick={() => setActiveTab("profiles")} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-dm font-bold text-sm transition-all ${activeTab === 'profiles' ? 'bg-white text-[#D14237] shadow-sm' : 'text-[#5C1F2E]/70 hover:text-[#5C1F2E]'}`}>
              <Sparkles size={15} /> Modelos
            </button>
            <button onClick={() => setActiveTab("drinks")} className={`flex items-center gap-2 px-5 py-2 rounded-lg font-dm font-bold text-sm transition-all ${activeTab === 'drinks' ? 'bg-white text-[#D14237] shadow-sm' : 'text-[#5C1F2E]/70 hover:text-[#5C1F2E]'}`}>
              <Coffee size={15} /> Bebidas
            </button>
          </div>
        }
      />

      <div className="bg-white rounded-2xl shadow-sm border border-brand-pink2 overflow-hidden flex flex-col min-h-[400px]">
        {/* Tab: Services */}
        {activeTab === "services" && (
          <>
            <div className="p-4 border-b border-brand-pink2 bg-[#FAFAFA] flex justify-end">
              <button onClick={() => openServiceModal()} className="bg-[#5C1F2E] text-white px-4 py-2 rounded-xl font-dm font-bold text-xs flex items-center gap-2 hover:bg-[#4A1925] transition-colors">
                <Plus size={16} /> Novo Serviço
              </button>
            </div>
            <div className="flex-1 overflow-x-auto">
              {loading ? <div className="p-12 text-center text-rose-300 font-dm">Carregando...</div> : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-brand-pink2">
                      <th className="px-6 py-4 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider">Serviço / Material</th>
                      <th className="px-6 py-4 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider">Categoria</th>
                      <th className="px-6 py-4 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider">Lógica de Cálculo</th>
                      <th className="px-6 py-4 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider text-right">Valor Base</th>
                      <th className="px-6 py-4 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="font-dm text-sm divide-y divide-[#F5D8D5]/50">
                    {services.map(s => (
                      <tr key={s.id} className="hover:bg-[#FAE8E6]/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {s.image_url ? (
                              <img src={s.image_url} alt={s.name} className="w-10 h-10 rounded-lg object-cover border border-brand-pink2" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-gray-50 border border-dashed border-gray-200 flex items-center justify-center text-gray-300">
                                <Box size={16} />
                              </div>
                            )}
                            <span className="font-bold text-[#5C1F2E]">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{s.category}</span></td>
                        <td className="px-6 py-4 text-rose-400">
                          <div className="flex items-center gap-2 flex-wrap">
                            {formatPricingType(s.pricing_type, s)}
                            {s.multiple_of > 0 && <span className="text-xs bg-rose-50 text-rose-400 px-1.5 py-0.5 rounded">×{s.multiple_of}</span>}
                            {s.is_tableware && <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded">louça</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-[#D14237]">
                          {s.pricing_type === 'percentage' ? `${s.base_price}%` : `R$ ${s.base_price.toFixed(2)}`}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => openServiceModal(s)} className="p-2 text-rose-400 hover:text-[#5C1F2E]"><Edit2 size={16} /></button>
                          <button onClick={() => deleteService(s.id)} className="p-2 text-rose-400 hover:text-[#D14237]"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* Tab: Delivery */}
        {activeTab === "delivery" && (
          <>
            <div className="p-4 border-b border-brand-pink2 bg-[#FAFAFA] flex justify-end">
              <button onClick={() => openDeliveryModal()} className="bg-[#5C1F2E] text-white px-4 py-2 rounded-xl font-dm font-bold text-xs flex items-center gap-2 hover:bg-[#4A1925] transition-colors">
                <Plus size={16} /> Nova Taxa de Bairro
              </button>
            </div>
            <div className="flex-1 overflow-x-auto">
              {loading ? <div className="p-12 text-center text-rose-300 font-dm">Carregando...</div> : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-brand-pink2">
                      <th className="px-6 py-4 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider">Bairro</th>
                      <th className="px-6 py-4 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider">Cidade</th>
                      <th className="px-6 py-4 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider text-right">Taxa (R$)</th>
                      <th className="px-6 py-4 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="font-dm text-sm divide-y divide-[#F5D8D5]/50">
                    {deliveryFees.map(d => (
                      <tr key={d.id} className="hover:bg-[#FAE8E6]/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-[#5C1F2E]">{d.neighborhood}</td>
                        <td className="px-6 py-4 text-gray-500">{d.city}</td>
                        <td className="px-6 py-4 text-right font-bold text-[#D14237]">R$ {d.fee_amount.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => openDeliveryModal(d)} className="p-2 text-rose-400 hover:text-[#5C1F2E]"><Edit2 size={16} /></button>
                          <button onClick={() => deleteDelivery(d.id)} className="p-2 text-rose-400 hover:text-[#D14237]"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* Tab: Profiles */}
        {activeTab === "profiles" && (
          <>
            <div className="p-4 border-b border-brand-pink2 bg-[#FAFAFA] flex justify-end">
              <button onClick={() => openProfileModal()} className="bg-[#5C1F2E] text-white px-4 py-2 rounded-xl font-dm font-bold text-xs flex items-center gap-2 hover:bg-[#4A1925] transition-colors">
                <Plus size={16} /> Novo Modelo de Evento
              </button>
            </div>
            <div className="flex-1 overflow-x-auto">
              {loading ? <div className="p-12 text-center text-rose-300 font-dm">Carregando...</div> : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white border-b border-brand-pink2">
                      <th className="px-6 py-4 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider w-1/3">Nome do Pacote</th>
                      <th className="px-6 py-4 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider">Regras / Prompts Específicos</th>
                      <th className="px-6 py-4 font-dm font-bold text-[10px] text-rose-300 uppercase tracking-wider text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="font-dm text-sm divide-y divide-[#F5D8D5]/50">
                    {profiles.map(p => (
                      <tr key={p.id} className="hover:bg-[#FAE8E6]/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-brand-pink2" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-rose-50 border border-dashed border-rose-100 flex items-center justify-center text-rose-200">
                                <Sparkles size={16} />
                              </div>
                            )}
                            <span className="font-bold text-[#5C1F2E]">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          <p className="line-clamp-2 text-xs">{p.prompt_rules}</p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => openProfileModal(p)} className="p-2 text-rose-400 hover:text-[#5C1F2E]"><Edit2 size={16} /></button>
                          <button onClick={() => deleteProfile(p.id)} className="p-2 text-rose-400 hover:text-[#D14237]"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* Tab: Bebidas */}
        {activeTab === "drinks" && (
          <>
            <div className="p-4 border-b border-brand-pink2 bg-[#FAFAFA] flex items-center justify-between">
              <p className="text-xs font-dm text-rose-400">Vincule cada tipo de bebida a um produto cadastrado no catálogo.</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={addDrinkMapping}
                  className="bg-[#5C1F2E] text-white px-4 py-2 rounded-xl font-dm font-bold text-xs flex items-center gap-2 hover:bg-[#4A1925] transition-colors"
                >
                  <Plus size={14} /> Novo Tipo
                </button>
                <button
                  onClick={saveDrinkMappings}
                  disabled={savingDrinks}
                  className="bg-[#D14237] text-white px-4 py-2 rounded-xl font-dm font-bold text-xs flex items-center gap-2 hover:bg-[#B73427] transition-colors disabled:opacity-50"
                >
                  {savingDrinks ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </button>
              </div>
            </div>
            <div className="p-6 flex flex-col gap-3">
              {drinkMappings.length === 0 && (
                <p className="text-sm text-rose-300 text-center py-8">Nenhum tipo cadastrado. Clique em "Novo Tipo" para adicionar.</p>
              )}
              {drinkMappings.map((dm) => {
                const linkedProduct = drinkProducts.find(
                  p => p.name.toLowerCase() === dm.productName.toLowerCase()
                );
                return (
                  <div key={dm.id} className="flex items-center gap-3 bg-[#FAFAFA] border border-brand-pink2 rounded-xl p-4">
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-1">Nome do tipo</label>
                      <input
                        type="text"
                        value={dm.label}
                        onChange={e => updateDrinkMapping(dm.id, 'label', e.target.value)}
                        placeholder="Ex: Refrigerante"
                        className="w-full border border-brand-pink2 rounded-lg px-3 py-2 text-sm font-dm text-[#5C1F2E] focus:outline-none focus:border-[#D14237]"
                      />
                    </div>
                    <div className="flex-[2] min-w-0">
                      <label className="text-[10px] font-bold text-rose-400 uppercase tracking-widest block mb-1">
                        Produto vinculado
                        {!linkedProduct && dm.productName && (
                          <span className="text-orange-400 ml-2">· não encontrado no catálogo</span>
                        )}
                      </label>
                      <select
                        value={dm.productName}
                        onChange={e => updateDrinkMapping(dm.id, 'productName', e.target.value)}
                        className="w-full border border-brand-pink2 rounded-lg px-3 py-2 text-sm font-dm text-[#5C1F2E] bg-white focus:outline-none focus:border-[#D14237]"
                      >
                        <option value="">— selecione um produto —</option>
                        {['Bebidas', 'Sucos Naturais'].map(cat => {
                          const catProducts = drinkProducts.filter(p => p.category === cat);
                          if (catProducts.length === 0) return null;
                          return (
                            <optgroup key={cat} label={cat}>
                              {catProducts.map(p => (
                                <option key={p.id} value={p.name}>{p.name}</option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                    </div>
                    <button
                      onClick={() => removeDrinkMapping(dm.id)}
                      className="p-2 text-rose-300 hover:text-[#D14237] transition-colors flex-shrink-0 mt-4"
                      title="Remover"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* MODAL: Service */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 bg-[#5C1F2E]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-brand-pink2 flex justify-between items-center bg-[#FAFAFA]">
              <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">{editingServiceId ? "Editar Serviço" : "Novo Serviço"}</h2>
              <button onClick={() => setIsServiceModalOpen(false)} className="text-rose-400 hover:text-[#D14237]"><X size={20} /></button>
            </div>
            <div className="p-6 font-dm">
              <form id="srvForm" onSubmit={saveService} className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => serviceFileRef.current?.click()}
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
                      onClick={() => serviceFileRef.current?.click()}
                      className="text-sm font-dm font-bold text-[#D14237] hover:text-[#B73427] flex items-center gap-1.5"
                    >
                      <ImagePlus size={16} />
                      {imagePreview ? "Trocar foto" : "Escolher foto"}
                    </button>
                    <p className="text-xs text-rose-300">JPG, PNG ou WebP. Máx. 5MB.</p>
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={() => { setImagePreview(null); setPendingFile(null); setServiceForm({...serviceForm, image_url: ""}); }}
                        className="text-xs text-rose-400 hover:text-[#D14237] flex items-center gap-1"
                      >
                        <X size={12} /> Remover foto
                      </button>
                    )}
                  </div>
                  <input
                    ref={serviceFileRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase block mb-1">Nome</label>
                    <input required type="text" className="w-full border rounded-xl p-2.5 text-sm" value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} placeholder="Ex: Garçom, Louças..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase block mb-1">Categoria</label>
                    <select className="w-full border rounded-xl p-2.5 text-sm" value={serviceForm.category} onChange={e => setServiceForm({...serviceForm, category: e.target.value})}>
                      <option value="Equipe">Equipe / Staff</option>
                      <option value="Materiais">Materiais / Locação</option>
                      <option value="Taxas">Taxas</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase block mb-1">Lógica</label>
                    <select className="w-full border rounded-xl p-2.5 text-sm" value={serviceForm.pricing_type} onChange={e => setServiceForm({...serviceForm, pricing_type: e.target.value})}>
                      <option value="time_based">Por Tempo (R$ / hora)</option>
                      <option value="per_person">Por Pessoa (R$ fixo)</option>
                      <option value="percentage">% sobre o pedido</option>
                      <option value="ratio_based">Quantidade: X unid a cada Y pessoas</option>
                      <option value="per_salgado_type">Unidades por tipo de salgado</option>
                      <option value="fixed_plus_percent">Valor fixo + % sobre o pedido</option>
                      <option value="ratio_of_item">Quantidade a cada X de outro item</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase block mb-1">
                      {serviceForm.pricing_type === 'percentage' ? '% Base' : 'Valor Base (R$)'}
                    </label>
                    <input required type="number" step="0.01" className="w-full border rounded-xl p-2.5 text-sm" value={serviceForm.base_price} onChange={e => setServiceForm({...serviceForm, base_price: Number(e.target.value)})} />
                  </div>
                  {serviceForm.pricing_type === 'time_based' && (
                    <div>
                      <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase block mb-1">Valor Hora Extra (R$)</label>
                      <input type="number" step="0.01" className="w-full border rounded-xl p-2.5 text-sm" value={serviceForm.extra_price} onChange={e => setServiceForm({...serviceForm, extra_price: Number(e.target.value)})} />
                    </div>
                  )}
                  {serviceForm.pricing_type === 'fixed_plus_percent' && (
                    <div>
                      <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase block mb-1">% sobre o pedido</label>
                      <input type="number" step="0.1" min="0" max="100" className="w-full border rounded-xl p-2.5 text-sm" value={serviceForm.extra_price} onChange={e => setServiceForm({...serviceForm, extra_price: Number(e.target.value)})} placeholder="Ex: 10" />
                    </div>
                  )}
                </div>

                {serviceForm.pricing_type === 'ratio_based' && (
                  <div className="bg-[#FAE8E6] p-4 rounded-xl grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase block mb-1">Qtd (X)</label>
                      <input type="number" min="1" className="w-full border rounded-xl p-2 text-sm" value={serviceForm.ratio_x} onChange={e => setServiceForm({...serviceForm, ratio_x: Number(e.target.value)})} />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase block mb-1">A cada (Y) pessoas</label>
                      <input type="number" min="1" className="w-full border rounded-xl p-2 text-sm" value={serviceForm.ratio_y} onChange={e => setServiceForm({...serviceForm, ratio_y: Number(e.target.value)})} />
                    </div>
                  </div>
                )}

                {serviceForm.pricing_type === 'per_salgado_type' && (
                  <div className="bg-[#FAE8E6] p-4 rounded-xl grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase block mb-1">Unidades por tipo (X)</label>
                      <input type="number" min="1" className="w-full border rounded-xl p-2 text-sm" value={serviceForm.ratio_x} onChange={e => setServiceForm({...serviceForm, ratio_x: Number(e.target.value)})} />
                      <p className="text-[10px] text-rose-400 mt-1">Ex: 1 vasilhame por tipo</p>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase block mb-1">Limite de salgados por unidade (Y)</label>
                      <input type="number" min="1" className="w-full border rounded-xl p-2 text-sm" value={serviceForm.ratio_y} onChange={e => setServiceForm({...serviceForm, ratio_y: Number(e.target.value)})} />
                      <p className="text-[10px] text-rose-400 mt-1">Ex: 50 salgados por vasilhame</p>
                    </div>
                  </div>
                )}

                {serviceForm.pricing_type === 'ratio_of_item' && (
                  <div className="bg-[#FAE8E6] p-4 rounded-xl flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase block mb-1">Quantidade (X)</label>
                        <input type="number" min="1" className="w-full border rounded-xl p-2 text-sm" value={serviceForm.ratio_x} onChange={e => setServiceForm({...serviceForm, ratio_x: Number(e.target.value)})} />
                        <p className="text-[10px] text-rose-400 mt-1">Ex: 1 toalha</p>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase block mb-1">A cada (Y)</label>
                        <input type="number" min="1" className="w-full border rounded-xl p-2 text-sm" value={serviceForm.ratio_y} onChange={e => setServiceForm({...serviceForm, ratio_y: Number(e.target.value)})} />
                        <p className="text-[10px] text-rose-400 mt-1">Ex: 1</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase block mb-1">Item de referência</label>
                      <input type="text" className="w-full border rounded-xl p-2 text-sm" placeholder="Ex: aparador, litro de café, garrafa..." value={serviceForm.ratio_ref ?? ""} onChange={e => setServiceForm({...serviceForm, ratio_ref: e.target.value})} />
                      <p className="text-[10px] text-rose-400 mt-1">O sistema vai calcular com base na quantidade desse item no pedido.</p>
                    </div>
                  </div>
                )}

                {/* Louça */}
                <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={serviceForm.is_tableware ?? false}
                      onChange={e => setServiceForm({...serviceForm, is_tableware: e.target.checked})}
                      className="w-4 h-4 accent-[#D14237] rounded"
                    />
                    <span className="text-sm font-dm font-bold text-[#5C1F2E]">Este item é considerado louça</span>
                  </label>
                  <p className="text-[11px] text-amber-700 mt-1.5 ml-6">
                    Xícara, copo de vidro, aparador, etc. Quando marcado, o sistema aplica a regra de louça no orçamento (ex: % do garçom sobe de 10% para 20%).
                  </p>
                </div>

                {/* Múltiplos */}
                <div className="border border-brand-pink2 rounded-xl p-4">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={(serviceForm.multiple_of ?? 0) > 0}
                      onChange={e => setServiceForm({...serviceForm, multiple_of: e.target.checked ? 12 : 0})}
                      className="w-4 h-4 accent-[#D14237] rounded"
                    />
                    <span className="text-sm font-dm font-bold text-[#5C1F2E]">Fornecemos apenas em múltiplos de:</span>
                  </label>
                  {(serviceForm.multiple_of ?? 0) > 0 && (
                    <div className="mt-3 flex items-center gap-3">
                      <input
                        type="number"
                        min="2"
                        className="w-32 border rounded-xl p-2 text-sm"
                        value={serviceForm.multiple_of}
                        onChange={e => setServiceForm({...serviceForm, multiple_of: Number(e.target.value)})}
                      />
                      <p className="text-xs text-rose-400">Ex: copos em múltiplos de 12 → se precisar de 25, arredonda para 36</p>
                    </div>
                  )}
                </div>
              </form>
            </div>
            <div className="p-6 border-t bg-[#FAFAFA] flex justify-end gap-3">
              <button onClick={() => setIsServiceModalOpen(false)} className="px-6 py-2.5 rounded-xl font-dm text-sm">Cancelar</button>
              <button type="submit" form="srvForm" disabled={saving || uploadingImage} className="bg-[#5C1F2E] text-white px-6 py-2.5 rounded-xl font-dm text-sm flex items-center gap-2">
                {(saving || uploadingImage) ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {uploadingImage ? "Enviando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delivery */}
      {isDeliveryModalOpen && (
        <div className="fixed inset-0 bg-[#5C1F2E]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-[#FAFAFA]">
              <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">{editingDeliveryId ? "Editar Taxa" : "Nova Taxa"}</h2>
              <button onClick={() => setIsDeliveryModalOpen(false)} className="text-rose-400 hover:text-[#D14237]"><X size={20} /></button>
            </div>
            <div className="p-6 font-dm">
              <form id="delForm" onSubmit={saveDelivery} className="flex flex-col gap-4">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Bairro</label>
                  <input required type="text" className="w-full border rounded-xl p-2.5 text-sm" value={deliveryForm.neighborhood} onChange={e => setDeliveryForm({...deliveryForm, neighborhood: e.target.value})} placeholder="Ex: Lourdes" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Cidade</label>
                  <input required type="text" className="w-full border rounded-xl p-2.5 text-sm" value={deliveryForm.city} onChange={e => setDeliveryForm({...deliveryForm, city: e.target.value})} />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Valor da Taxa (R$)</label>
                  <input required type="number" step="0.01" className="w-full border rounded-xl p-2.5 text-sm" value={deliveryForm.fee_amount} onChange={e => setDeliveryForm({...deliveryForm, fee_amount: Number(e.target.value)})} />
                </div>
              </form>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setIsDeliveryModalOpen(false)} className="px-6 py-2 text-sm font-dm text-gray-600">Cancelar</button>
              <button type="submit" form="delForm" disabled={saving} className="bg-[#5C1F2E] text-white px-6 py-2 rounded-xl text-sm font-dm">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Profile */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-[#5C1F2E]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-[#FAFAFA]">
              <h2 className="font-lora text-xl font-bold text-[#5C1F2E]">{editingProfileId ? "Editar Modelo" : "Novo Modelo de Evento"}</h2>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-rose-400 hover:text-[#D14237]"><X size={20} /></button>
            </div>
            <div className="p-6 font-dm">
              <form id="profForm" onSubmit={saveProfile} className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div
                    onClick={() => profileFileRef.current?.click()}
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
                      onClick={() => profileFileRef.current?.click()}
                      className="text-sm font-dm font-bold text-[#D14237] hover:text-[#B73427] flex items-center gap-1.5"
                    >
                      <ImagePlus size={16} />
                      {imagePreview ? "Trocar foto" : "Escolher foto"}
                    </button>
                    <p className="text-xs text-rose-300">JPG, PNG ou WebP. Máx. 5MB.</p>
                    {imagePreview && (
                      <button
                        type="button"
                        onClick={() => { setImagePreview(null); setPendingFile(null); setProfileForm({...profileForm, image_url: ""}); }}
                        className="text-xs text-rose-400 hover:text-[#D14237] flex items-center gap-1"
                      >
                        <X size={12} /> Remover foto
                      </button>
                    )}
                  </div>
                  <input
                    ref={profileFileRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">Nome do Pacote</label>
                    <input required type="text" className="w-full border rounded-xl p-2.5 text-sm" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} placeholder="Ex: Coffee Sofisticado" />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase block mb-1">
                    <Sparkles size={14} className="text-brand-red" />
                    Regras de Negócio da IA (Prompt Específico)
                  </label>
                  <p className="text-xs text-rose-400 mb-2">Descreva detalhadamente o que a IA deve escolher ou priorizar ao gerar um orçamento para este modelo de evento.</p>
                  <textarea required rows={5} className="w-full border rounded-xl p-2.5 text-sm" value={profileForm.prompt_rules} onChange={e => setProfileForm({...profileForm, prompt_rules: e.target.value})} placeholder="Ex: Incluir obrigatoriamente 1 produto da categoria X. Preferir salgados fritos." />
                </div>
              </form>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => setIsProfileModalOpen(false)} className="px-6 py-2 text-sm font-dm text-gray-600">Cancelar</button>
              <button type="submit" form="profForm" disabled={saving || uploadingImage} className="bg-[#5C1F2E] text-white px-6 py-2 rounded-xl text-sm font-dm flex items-center gap-2">
                {(saving || uploadingImage) ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {uploadingImage ? "Enviando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
