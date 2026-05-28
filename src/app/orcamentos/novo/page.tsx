"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

interface Service {
  id: string;
  name: string;
  category: string;
  pricing_type: string;
  is_tableware: boolean;
}

interface DrinkProduct {
  id: string;
  name: string;
  unit: string;
  unit_price: number;
  description: string;
}

const DEFAULT_DRINK_OPTIONS: { id: string; label: string; productName: string }[] = [
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

export default function NovoOrcamento() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  // Dynamic Services & Profiles
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [availableDeliveryFees, setAvailableDeliveryFees] = useState<any[]>([]);
  const [drinkProducts, setDrinkProducts] = useState<DrinkProduct[]>([]);
  const [drinkOptions, setDrinkOptions] = useState(DEFAULT_DRINK_OPTIONS);
  
  // Autocomplete State
  const [streetSuggestions, setStreetSuggestions] = useState<any[]>([]);
  const [isSearchingStreet, setIsSearchingStreet] = useState(false);

  const [formData, setFormData] = useState({
    clientName: "",
    clientPhone: "",
    eventDate: "",
    eventName: "",
    leadSource: "WhatsApp", // Default value
    
    // Logistica
    cep: "",
    street: "",
    complement: "",
    neighborhood: "",
    city: "",
    deliveryFee: 0,
    
    guests: "",
    duration: "",
    period: "Manhã",
    
    selectedServiceIds: [] as string[],
    drinks: [] as string[],
    modalidade: "Econômico",
    espeto: "nao",
    incluiDoces: false,
    budget: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [resServices, resFees, resDrinks] = await Promise.all([
      supabase.from('services').select('*').eq('is_active', true),
      supabase.from('delivery_fees').select('*').order('neighborhood', { ascending: true }),
      supabase.from('products').select('id,name,unit,unit_price,description')
        .in('category', ['Bebidas', 'Sucos Naturais'])
        .eq('is_active', true)
    ]);
    if (resServices.data) setAvailableServices(resServices.data);
    if (resFees.data) setAvailableDeliveryFees(resFees.data);
    if (resDrinks.data) setDrinkProducts(resDrinks.data);

    const { data: mappingsData } = await supabase
      .from('settings').select('value').eq('key', 'drink_mappings').single();
    if (Array.isArray(mappingsData?.value) && mappingsData.value.length > 0) {
      setDrinkOptions(mappingsData.value);
    }
  }

  // ---- Address Logic ----
  // Fetch Delivery Fee when neighborhood changes
  useEffect(() => {
    if (formData.neighborhood) {
      fetchDeliveryFee(formData.neighborhood);
    }
  }, [formData.neighborhood]);

  async function fetchDeliveryFee(neighborhood: string) {
    try {
      // Tenta busca exata primeiro
      const { data } = await supabase
        .from('delivery_fees')
        .select('fee_amount')
        .ilike('neighborhood', neighborhood.trim())
        .limit(1);
      
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, deliveryFee: data[0].fee_amount }));
      } else {
        // Se não encontrar, tenta busca parcial
        const { data: partialData } = await supabase
          .from('delivery_fees')
          .select('fee_amount')
          .filter('neighborhood', 'ilike', `%${neighborhood.trim()}%`)
          .limit(1);
        
        if (partialData && partialData.length > 0) {
          setFormData(prev => ({ ...prev, deliveryFee: partialData[0].fee_amount }));
        } else {
          setFormData(prev => ({ ...prev, deliveryFee: 0 }));
        }
      }
    } catch (err) {
      console.error("Erro ao buscar taxa de entrega:", err);
    }
  }

  const streetSearchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStreetSearch = (value: string) => {
    setFormData(prev => ({ ...prev, street: value, neighborhood: '', deliveryFee: 0 }));

    if (streetSearchTimer.current) clearTimeout(streetSearchTimer.current);

    const streetNameOnly = value.split(',')[0].replace(/\s+\d+.*$/, '').trim();
    // Detecta se há número no input (ex: "Rua Curitiba, 2550" ou "Rua Curitiba 2550")
    const numberMatch = value.match(/[,\s]+(\d+)/);
    const houseNumber = numberMatch?.[1];

    if (streetNameOnly.length < 4) {
      setStreetSuggestions([]);
      return;
    }

    streetSearchTimer.current = setTimeout(async () => {
      setIsSearchingStreet(true);
      try {
        const city = formData.city || 'Belo Horizonte';

        if (houseNumber) {
          // Com número: Nominatim resolve o bairro exato diretamente
          const query = `${streetNameOnly} ${houseNumber}, ${city}, Brasil`;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=br&limit=1`,
            { headers: { 'Accept-Language': 'pt-BR' } }
          );
          const data = await res.json();
          if (data.length > 0) {
            const addr = data[0].address;
            const neighborhood =
              addr.suburb || addr.city_district || addr.quarter || addr.neighbourhood || '';
            if (neighborhood) {
              setFormData(prev => ({
                ...prev,
                neighborhood,
                city: addr.city || addr.town || addr.municipality || prev.city || 'Belo Horizonte',
              }));
            }
          }
          setStreetSuggestions([]);
        } else {
          // Sem número: ViaCEP mostra sugestões para o usuário escolher
          const res = await fetch(
            `https://viacep.com.br/ws/MG/${encodeURIComponent(city)}/${encodeURIComponent(streetNameOnly)}/json/`
          );
          const data = await res.json();
          setStreetSuggestions(Array.isArray(data) ? data.slice(0, 6) : []);
        }
      } catch (err) {
        console.error("Erro busca endereço:", err);
        setStreetSuggestions([]);
      } finally {
        setIsSearchingStreet(false);
      }
    }, 500);
  };

  const selectStreet = (place: any) => {
    setFormData(prev => ({
      ...prev,
      street: place.logradouro || '',
      neighborhood: place.bairro || prev.neighborhood,
      city: place.localidade || prev.city || 'Belo Horizonte',
      cep: place.cep?.replace('-', '') || prev.cep,
    }));
    setStreetSuggestions([]);
  };

  // ---- Handlers ----
  const handleServiceChange = (serviceId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      selectedServiceIds: checked 
        ? [...prev.selectedServiceIds, serviceId]
        : prev.selectedServiceIds.filter(id => id !== serviceId)
    }));
  };

  const handleDrinkChange = (drink: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      drinks: checked 
        ? [...prev.drinks, drink]
        : prev.drinks.filter(d => d !== drink)
    }));
  };

  const getFullAddress = () => {
    return `${formData.street}${formData.complement ? ' - ' + formData.complement : ''}, ${formData.neighborhood}, ${formData.city}`;
  };

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);
      // Remapear para o formato que a API já espera (eventAddress)
      const payload = {
        ...formData,
        eventAddress: getFullAddress(),
        services: formData.selectedServiceIds // A API AI vai precisar ler os IDs e buscar as regras no banco
      };

      const { data: { user } } = await supabase.auth.getUser();
      const userName = user?.user_metadata?.full_name || user?.email || "Sistema";

      const res = await fetch("/api/generate-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          formData: { ...payload, leadSource: formData.leadSource, createdBy: userName }, 
          action: 'draft' 
        })
      });
      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error || "Erro desconhecido");
      
      alert("Rascunho salvo com sucesso! ID: " + result.quote_id);
      router.push(`/orcamentos/${result.quote_id}/revisao`);
    } catch (error: any) {
      console.error("Erro ao salvar rascunho:", error);
      alert("Erro ao salvar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      const payload = {
        ...formData,
        eventAddress: getFullAddress(),
        services: formData.selectedServiceIds
      };

      const { data: { user } } = await supabase.auth.getUser();
      const userName = user?.user_metadata?.full_name || user?.email || "Sistema";

      const res = await fetch("/api/generate-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          formData: { ...payload, leadSource: formData.leadSource, createdBy: userName }, 
          action: 'generate' 
        })
      });
      const result = await res.json();

      if (!res.ok) throw new Error(result.error || "Erro da IA");
      if (result.mocked) alert(result.message);

      router.push(`/orcamentos/${result.quote_id}/revisao`);
    } catch (error: any) {
      console.error("Erro ao gerar IA:", error);
      alert("Erro ao chamar IA: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] flex justify-center pb-20">
      <div className="w-full max-w-[1200px] px-4 md:px-6 pt-4 md:pt-10 flex flex-col gap-6 md:gap-8">
        
        <header className="flex items-center gap-4">
          <Link href="/" className="text-[var(--color-brand-wine)] bg-[var(--color-brand-pink)] p-2.5 rounded-full hover:bg-[var(--color-brand-pink2)] transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="font-lora font-bold text-3xl text-[var(--color-brand-wine)] leading-tight">Novo Orçamento</h1>
        </header>

        <main className="flex flex-col lg:flex-row gap-8 items-start w-full">
          <div className="flex-1 flex flex-col gap-8 w-full">
            
            {/* Seção 1 - Informações Básicas */}
            <section className="bg-white rounded-[10px] shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-[10px] bg-[var(--color-brand-pink)] text-[var(--color-brand-red)] flex items-center justify-center font-bold">1</div>
                <h3 className="font-lora font-bold text-[22px] text-[var(--color-brand-wine)]">Cliente e Informações Básicas</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-1.5 block">Nome do Cliente *</label>
                  <input type="text" value={formData.clientName} onChange={e => setFormData({...formData, clientName: e.target.value})} className="w-full border border-[var(--color-brand-pink2)] rounded-[10px] p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] focus:ring-2 focus:ring-[var(--color-brand-red)]/10" placeholder="Ex: João da Silva" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-1.5 block">Telefone *</label>
                  <input type="tel" value={formData.clientPhone} onChange={e => setFormData({...formData, clientPhone: e.target.value})} className="w-full border border-[var(--color-brand-pink2)] rounded-[10px] p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] focus:ring-2 focus:ring-[var(--color-brand-red)]/10" placeholder="(31) 9 9999-9999" />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-1.5 block">Data do Evento *</label>
                  <input type="date" value={formData.eventDate} onChange={e => setFormData({...formData, eventDate: e.target.value})} className="w-full border border-[var(--color-brand-pink2)] rounded-[10px] p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] focus:ring-2 focus:ring-[var(--color-brand-red)]/10 text-[var(--color-brand-gray)]" />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-1.5 block">Nome do Evento (Opcional)</label>
                  <input type="text" value={formData.eventName} onChange={e => setFormData({...formData, eventName: e.target.value})} className="w-full border border-[var(--color-brand-pink2)] rounded-[10px] p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] focus:ring-2 focus:ring-[var(--color-brand-red)]/10" placeholder="Ex: Casamento João e Maria" />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-1.5 block">Fonte do Orçamento *</label>
                  <select 
                    value={formData.leadSource} 
                    onChange={e => setFormData({...formData, leadSource: e.target.value})} 
                    className="w-full border border-[var(--color-brand-pink2)] rounded-[10px] p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] focus:ring-2 focus:ring-[var(--color-brand-red)]/10 bg-white"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Google">Google</option>
                    <option value="Indicação">Indicação</option>
                    <option value="Site">Site</option>
                    <option value="Evento">Evento Anterior</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Seção 2 - Logística e Horário */}
            <section className="bg-white rounded-[10px] shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-[10px] bg-[var(--color-brand-pink)] text-[var(--color-brand-red)] flex items-center justify-center font-bold">2</div>
                <h3 className="font-lora font-bold text-[22px] text-[var(--color-brand-wine)]">Logística e Horário</h3>
              </div>
              
              <div className="grid grid-cols-12 gap-x-4 gap-y-4">
                <div className="col-span-12 relative">
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-1.5 block">Endereço (Rua + Número) *</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={formData.street} 
                      onChange={e => handleStreetSearch(e.target.value)} 
                      className="w-full border border-[var(--color-brand-pink2)] rounded-[10px] p-3 pr-10 text-sm focus:outline-none focus:border-[var(--color-brand-red)]" 
                      placeholder="Busque a rua..." 
                    />
                    {isSearchingStreet && <Loader2 className="absolute right-3 top-3 animate-spin text-rose-300" size={16} />}
                  </div>
                  
                  {/* Street Autocomplete Suggestions */}
                  {streetSuggestions.length > 0 && (
                    <ul className="absolute z-10 w-full bg-white border border-brand-pink2 rounded-xl mt-1 shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                      {streetSuggestions.map((place, idx) => (
                        <li
                          key={idx}
                          onClick={() => selectStreet(place)}
                          className="px-4 py-3 text-sm border-b border-brand-pink2/30 hover:bg-rose-50 cursor-pointer flex flex-col gap-0.5"
                        >
                          <span className="font-bold text-[#5C1F2E]">{place.logradouro}</span>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{place.bairro}</span>
                            <span className="text-rose-300">·</span>
                            <span className="font-mono">{place.cep}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="col-span-12">
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-1.5 block">Complemento</label>
                  <input type="text" value={formData.complement} onChange={e => setFormData({...formData, complement: e.target.value})} className="w-full border border-[var(--color-brand-pink2)] rounded-[10px] p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)]" placeholder="Ex: Apto 101, Salão de festas" />
                </div>

                <div className="col-span-6">
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-1.5 block">Bairro *</label>
                  <input type="text" value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} className="w-full border border-[var(--color-brand-pink2)] rounded-[10px] p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] bg-gray-50" placeholder="Bairro" />
                </div>

                <div className="col-span-6">
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-1.5 block">Cidade *</label>
                  <input type="text" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full border border-[var(--color-brand-pink2)] rounded-[10px] p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] bg-gray-50" placeholder="Cidade" />
                </div>

                <div className="col-span-12 md:col-span-6">
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-1.5 block">Taxa de Entrega (Bairro Selecionado)</label>
                  <select 
                    value={availableDeliveryFees.find(f => f.fee_amount === formData.deliveryFee && f.neighborhood.toLowerCase().includes(formData.neighborhood.toLowerCase()))?.neighborhood || ""}
                    onChange={(e) => {
                      const fee = availableDeliveryFees.find(f => f.neighborhood === e.target.value);
                      if (fee) {
                        setFormData(prev => ({ 
                          ...prev, 
                          deliveryFee: fee.fee_amount,
                          neighborhood: fee.neighborhood // Atualiza o bairro também para consistência
                        }));
                      }
                    }}
                    className="w-full border border-[var(--color-brand-pink2)] rounded-[10px] p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)] bg-white font-dm"
                  >
                    <option value="">Selecione o bairro para entrega...</option>
                    {availableDeliveryFees.map(fee => (
                      <option key={fee.id} value={fee.neighborhood}>
                        {fee.neighborhood} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fee.fee_amount)}
                      </option>
                    ))}
                  </select>
                  {formData.deliveryFee > 0 && (
                    <p className="text-[10px] text-green-600 font-bold uppercase mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">check_circle</span>
                      Taxa de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.deliveryFee)} aplicada
                    </p>
                  )}
                </div>

                <div className="col-span-12 my-2 border-t border-[#F5D8D5]"></div>

                <div className="col-span-6">
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-1.5 block">Convidados (pessoas) *</label>
                  <input type="number" min="1" value={formData.guests} onChange={e => setFormData({...formData, guests: e.target.value})} className="w-full border border-[var(--color-brand-pink2)] rounded-[10px] p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)]" placeholder="0" />
                </div>
                <div className="col-span-6">
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-1.5 block">Duração (Horas) *</label>
                  <input type="number" min="1" step="0.5" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} className="w-full border border-[var(--color-brand-pink2)] rounded-[10px] p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)]" placeholder="0" />
                </div>

                <div className="col-span-12 mt-2">
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-2 block">Período do Dia *</label>
                  <div className="flex flex-wrap gap-3">
                    {['Manhã', 'Tarde', 'Noite', 'Dia todo'].map(period => (
                      <button 
                        key={period} 
                        onClick={() => setFormData({...formData, period})}
                        className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors focus:outline-none ${
                        formData.period === period 
                          ? "bg-[var(--color-brand-wine)] text-white border-[var(--color-brand-wine)]" 
                          : "border-[var(--color-brand-pink2)] text-[var(--color-brand-gray)] hover:bg-[var(--color-brand-pink)] hover:border-[var(--color-brand-red)] hover:text-[var(--color-brand-wine)]"}`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Seção 3 - Serviços e Materiais */}
            <section className="bg-white rounded-[10px] shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-[10px] bg-[var(--color-brand-pink)] text-[var(--color-brand-red)] flex items-center justify-center font-bold">3</div>
                <div>
                  <h3 className="font-lora font-bold text-[22px] text-[var(--color-brand-wine)]">Serviços e Materiais</h3>
                   <p className="text-xs text-rose-400 font-dm mt-1">Os valores serão calculados dinamicamente baseados na duração e número de pessoas.</p>
                </div>
              </div>
              {(() => {
                const hasTableware = availableServices
                  .filter(s => formData.selectedServiceIds.includes(s.id))
                  .some(s => s.is_tableware);
                return hasTableware ? (
                  <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs font-dm text-amber-700">
                    <span className="material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5">info</span>
                    <span><strong>Louça selecionada</strong> — descartáveis (copos plásticos/isopor) serão removidos automaticamente do orçamento.</span>
                  </div>
                ) : null;
              })()}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableServices.length === 0 ? (
                  <p className="text-sm text-gray-400 col-span-2">Nenhum serviço cadastrado em Logística.</p>
                ) : (
                  availableServices.map(service => (
                    <label key={service.id} className={`flex items-center gap-3 p-3 rounded-[10px] border cursor-pointer transition-colors ${formData.selectedServiceIds.includes(service.id) ? "bg-[var(--color-brand-pink)] border-[var(--color-brand-red)]" : "border-[var(--color-brand-pink2)] hover:bg-[var(--color-brand-pink)]"}`}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[var(--color-brand-red)]"
                        checked={formData.selectedServiceIds.includes(service.id)}
                        onChange={(e) => handleServiceChange(service.id, e.target.checked)}
                      />
                      <span className="text-sm font-medium text-[var(--color-brand-wine2)]">{service.name}</span>
                      {service.is_tableware && (
                        <span className="ml-auto text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-bold">louça</span>
                      )}
                    </label>
                  ))
                )}
              </div>
            </section>

            {/* Seção 4 - Cardápio */}
            <section className="bg-white rounded-[10px] shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-[10px] bg-[var(--color-brand-pink)] text-[var(--color-brand-red)] flex items-center justify-center font-bold">4</div>
                <h3 className="font-lora font-bold text-[22px] text-[var(--color-brand-wine)]">Cardápio</h3>
              </div>

              <div className="flex flex-col gap-6">
                <div>
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-3 block">Modalidade *</label>
                  <div className="flex flex-wrap gap-3">
                    {["Econômico", "Meio Termo", "Elaborado"].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, modalidade: m }))}
                        className={`px-5 py-2.5 rounded-full border text-sm font-medium transition-colors focus:outline-none ${
                          formData.modalidade === m
                            ? "bg-[var(--color-brand-wine)] text-white border-[var(--color-brand-wine)]"
                            : "border-[var(--color-brand-pink2)] text-[var(--color-brand-gray)] hover:bg-[var(--color-brand-pink)] hover:border-[var(--color-brand-red)] hover:text-[var(--color-brand-wine)]"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-3 block">Incluir Doces?</label>
                  <div className="flex gap-3">
                    {[{ value: true, label: "Sim" }, { value: false, label: "Não" }].map(opt => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, incluiDoces: opt.value }))}
                        className={`px-5 py-2.5 rounded-full border text-sm font-medium transition-colors focus:outline-none ${
                          formData.incluiDoces === opt.value
                            ? "bg-[var(--color-brand-wine)] text-white border-[var(--color-brand-wine)]"
                            : "border-[var(--color-brand-pink2)] text-[var(--color-brand-gray)] hover:bg-[var(--color-brand-pink)] hover:border-[var(--color-brand-red)] hover:text-[var(--color-brand-wine)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-3 block">Espeto de Frutas</label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { value: "nao", label: "Não" },
                      { value: "3frutas", label: "Mini Espeto — 3 frutas (R$ 3,50/un)" },
                      { value: "4frutas", label: "Espeto — 4 frutas (R$ 4,50/un)" },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, espeto: opt.value }))}
                        className={`px-4 py-2.5 rounded-full border text-sm font-medium transition-colors focus:outline-none ${
                          formData.espeto === opt.value
                            ? "bg-[var(--color-brand-wine)] text-white border-[var(--color-brand-wine)]"
                            : "border-[var(--color-brand-pink2)] text-[var(--color-brand-gray)] hover:bg-[var(--color-brand-pink)] hover:border-[var(--color-brand-red)] hover:text-[var(--color-brand-wine)]"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-1.5 block">Orçamento Disponível (opcional)</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.budget}
                    onChange={e => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                    className="w-full max-w-xs border border-[var(--color-brand-pink2)] rounded-[10px] p-3 text-sm focus:outline-none focus:border-[var(--color-brand-red)]"
                    placeholder="R$ 0,00"
                  />
                </div>
              </div>
            </section>

            {/* Seção 5 - Pacote de Bebidas */}
            <section className="bg-white rounded-[10px] shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-[10px] bg-[var(--color-brand-pink)] text-[var(--color-brand-red)] flex items-center justify-center font-bold">5</div>
                <h3 className="font-lora font-bold text-[22px] text-[var(--color-brand-wine)]">Pacote de Bebidas</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {drinkOptions.map(opt => {
                  const product = drinkProducts.find(p =>
                    p.name.toLowerCase() === opt.productName.toLowerCase()
                  );
                  const isChecked = formData.drinks.includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className={`flex items-start gap-3 p-4 rounded-[10px] border cursor-pointer transition-colors ${
                        isChecked
                          ? "bg-[var(--color-brand-pink)] border-[var(--color-brand-red)]"
                          : "border-[var(--color-brand-pink2)] hover:bg-[var(--color-brand-pink)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 mt-0.5 accent-[var(--color-brand-red)] flex-shrink-0"
                        checked={isChecked}
                        onChange={(e) => handleDrinkChange(opt.id, e.target.checked)}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-[var(--color-brand-wine)]">{opt.label}</span>
                        {product ? (
                          <span className="text-[11px] text-rose-400 truncate">
                            {product.name} · {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.unit_price)}/{product.unit}
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-300 italic">Não cadastrado</span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>

          </div>

          {/* Right Side: Dynamic Sidebar Resume */}
          <aside className="w-full lg:w-[380px] sticky top-8 flex flex-col gap-6">
            <div className="bg-[var(--color-brand-wine)] text-white rounded-2xl p-6 shadow-[0_20px_60px_rgba(61,19,32,0.25)]">
              <h3 className="font-lora font-bold text-[22px] text-white mb-6">Resumo da Proposta</h3>
              
              <div className="flex flex-col gap-4 mb-6 pb-6 border-b border-white/20">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/70">Data</span>
                  <span className="font-semibold">{formData.eventDate ? new Date(formData.eventDate).toLocaleDateString("pt-BR") : "-"}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/70">Convidados</span>
                  <span className="font-semibold">{formData.guests ? `${formData.guests} pessoas` : "-"}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/70">Duração</span>
                  <span className="font-semibold">{formData.duration ? `${formData.duration} hrs` : "0 hrs"}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/70">Período</span>
                  <span className="font-semibold">{formData.period || "-"}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/70">Modalidade</span>
                  <span className="font-semibold">{formData.modalidade}</span>
                </div>
              </div>

              <div className="flex justify-between items-end mb-8">
                <span className="text-[11px] font-bold uppercase tracking-wider !text-white/70">Itens Selec.</span>
                <span className="font-lora text-3xl font-bold">{formData.selectedServiceIds.length + formData.drinks.length}</span>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  className="bg-[var(--color-brand-red)] hover:bg-[#B73427] text-white font-bold py-4 px-6 rounded-[10px] text-sm flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_0_rgba(202,68,54,0.39)] hover:shadow-[0_6px_20px_rgba(202,68,54,0.23)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
                  onClick={handleGenerate}
                  disabled={isGenerating || isSaving}
                >
                  {isGenerating ? <Loader2 size={18} className="animate-spin" /> : null}
                  Gerar Orçamento com IA
                </button>
                <button 
                  onClick={handleSaveDraft}
                  disabled={isGenerating || isSaving}
                  className="bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white border border-white/25 font-bold py-3.5 px-6 rounded-[10px] text-sm flex justify-center items-center gap-2 transition-colors text-center"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Salvar como Rascunho
                </button>
              </div>
            </div>
            
            <div className="bg-[var(--color-brand-pink)] rounded-[10px] p-5 shadow-sm border border-[#F0D5D5] text-[var(--color-brand-wine2)]">
              <p className="text-[12px] leading-relaxed font-medium">A Inteligência Artificial irá cruzar os dados deste evento com o catálogo para sugerir um orçamento preciso dentro do conceito da marca, calculando serviços automaticamente.</p>
            </div>
          </aside>

        </main>
      </div>
    </div>
  );
}
