"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle, Download, Loader2, Users, Clock, Calendar, Info, ChevronRight } from "lucide-react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/Notify";
import {
  groupItems, lineTotal, isPercentItem, itemIcon,
  computeQuoteTotals, computeSectionBreakdown,
} from "@/lib/itemClassification";

export default function PublicProposalPage() {
  const params = useParams();
  const quoteId = params?.id as string;
  
  const [quote, setQuote] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  
  const [billingData, setBillingData] = useState({ document: "", name: "" });
  const [isFetchingName, setIsFetchingName] = useState(false);
  const [docType, setDocType] = useState<"cpf" | "cnpj" | "">("");

  const formatDocument = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
    }
    return digits
      .replace(/(\d{2})(\d)/, "$1.$2")
      .replace(/(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
      .replace(/(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
  };

  const fetchCNPJData = async (cnpj: string) => {
    try {
      setIsFetchingName(true);
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (res.ok) {
        const data = await res.json();
        const name = data.razao_social || data.nome_fantasia || "";
        if (name) setBillingData(prev => ({ ...prev, name }));
      }
    } catch {}
    finally { setIsFetchingName(false); }
  };

  const handleDocumentChange = (value: string) => {
    const formatted = formatDocument(value);
    const digits = formatted.replace(/\D/g, "");
    setDocType(digits.length <= 11 ? "cpf" : "cnpj");
    setBillingData(prev => ({ ...prev, document: formatted }));
    if (digits.length === 14) fetchCNPJData(digits);
  };

  useEffect(() => {
    // Inject Fonts
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Lora:ital,wght@0,400..700;1,400..700&family=Dancing+Script:wght@700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    if (quoteId) {
      fetchQuote();
      fetchHierarchy();
    }
  }, [quoteId]);

  const [categoryHierarchy, setCategoryHierarchy] = useState<string[]>([]);

  const fetchHierarchy = async () => {
    const { data } = await supabase.from("settings").select("*").eq("key", "category_order").single();
    if (data) setCategoryHierarchy(data.value);
  };

  const fetchQuote = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("quotes")
        .select("*, quote_items(*, products(*))")
        .eq("id", quoteId)
        .single();
      
      if (error) throw error;
      setQuote(data);
      if (data.quote_items) {
        setItems(data.quote_items.sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsApproving(true);
      const rawDoc = billingData.document.replace(/\D/g, "");
      const entityType = rawDoc.length === 11 ? "PF" : "PJ";

      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("cpf_cnpj", rawDoc)
        .maybeSingle();

      let clientId = existing?.id as string | undefined;

      if (existing) {
        await supabase.from("clients").update({ name: billingData.name, entity_type: entityType }).eq("id", existing.id);
      } else {
        const { data: created } = await supabase
          .from("clients")
          .insert({ name: billingData.name, entity_type: entityType, cpf_cnpj: rawDoc })
          .select("id").single();
        clientId = created?.id;
      }

      const { error } = await supabase
        .from("quotes")
        .update({
          status: "aprovado",
          billing_document: billingData.document,
          billing_name: billingData.name,
          client_id: clientId ?? null,
          updated_at: new Date().toISOString()
        })
        .eq("id", quoteId);
      if (error) throw error;
      setShowApprovalModal(false);
      fetchQuote();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsApproving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDF6F2]">
      <Loader2 className="animate-spin text-[#D14237]" size={32} />
    </div>
  );

  if (!quote) return <div className="min-h-screen flex items-center justify-center font-lora text-[#5C1F2E]">Proposta não encontrada.</div>;

  // Totais e detalhamento — fonte única (lib/itemClassification), igual em todas as telas.
  const { subtotalNonPercent, grandTotal } = computeQuoteTotals(items);
  const { food: foodTotal, delivery: logisticsTotal, services: taxesTotal } = computeSectionBreakdown(items);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Agrupa e ordena os itens pela MESMA classificação usada nas demais telas.
  const { order: displayCategories, groups: groupedItems } = groupItems(items, categoryHierarchy);

  return (
    <div className="min-h-screen bg-[#FDF6F2] text-[#6B5C5A] font-['DM_Sans',sans-serif] selection:bg-[#D14237] selection:text-white">
      
      <style jsx global>{`
        .font-lora { font-family: 'Lora', serif; }
        .font-dm { font-family: 'DM Sans', sans-serif; }
        .font-artisan { font-family: 'Dancing Script', cursive; }
        h1, h2, h3, .metric { font-family: 'Lora', serif; letter-spacing: -0.02em; }
        .silk-btn { background: linear-gradient(135deg, #D14237 0%, #E8635A 100%); }

        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            background-color: #FDF6F2 !important;
          }
          nav, button, footer, .print-hidden {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          .hero-container {
            border-radius: 0 !important;
            height: 400px !important;
          }
          .item-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .sidebar-print {
            position: relative !important;
            top: 0 !important;
            width: 100% !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background-color: #5C1F2E !important;
            color: white !important;
            padding: 40px !important;
          }
          /* Ensure text colors are preserved */
          .text-[#5C1F2E] { color: #5C1F2E !important; }
          .text-[#D14237] { color: #D14237 !important; }
        }
      `}</style>

      {/* TOP NAV - REFINED */}
      <nav className="w-full max-w-[1400px] mx-auto px-12 py-10 flex justify-between items-center print:hidden">
        <img src="/logo.png" alt="Marília" className="h-12 object-contain" />
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-[#A38E88] hover:text-[#D14237] transition-all group"
        >
          <Download size={16} className="group-hover:-translate-y-0.5 transition-transform" /> 
          Baixar Proposta em PDF
        </button>
      </nav>

      <main className="w-full max-w-[1400px] mx-auto px-12 pb-32">
        <div className="flex flex-col lg:flex-row gap-16">
          
          {/* MAIN CONTENT AREA */}
          <div className="flex-1">
            
            {/* HERO SECTION - ASYMMETRICAL EDITORIAL STYLE */}
            <div className="relative mb-20 hero-container">
              <div className="relative rounded-[32px] overflow-hidden aspect-[21/9] shadow-sm hero-container">
                <img 
                  src="/hero-proposta.png" 
                  className="w-full h-full object-cover grayscale-[20%] opacity-90" 
                  alt="Marília Catering"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#3D1320] via-transparent to-transparent opacity-40"></div>
                <div className="absolute top-0 left-0 w-2 h-full bg-[#D14237]"></div>
              </div>
              
              <div className="mt-[-100px] relative z-10 ml-12 mr-12 bg-white/95 backdrop-blur-md p-12 rounded-[24px] shadow-sm inline-block max-w-3xl print:mt-0 print:ml-0 print:bg-transparent print:shadow-none">
                <span className="text-[#D14237] text-[11px] font-bold uppercase tracking-[0.3em] mb-4 block">
                  Proposta Comercial • #CB-2024-{quoteId.slice(0,3).toUpperCase()}
                </span>
                <h1 className="text-[#5C1F2E] text-5xl md:text-6xl font-bold leading-tight mb-6">
                  {quote.event_type} para {quote.client_name}
                </h1>
                <p className="text-[#6B5C5A] text-xl font-light leading-relaxed max-w-2xl">
                  Uma curadoria gastronômica artesanal desenhada para transformar seu evento em uma experiência sensorial memorável.
                </p>
              </div>
            </div>

            {/* QUICK ATTRIBUTES - THE PAPER LAYER PRINCIPLE */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-24 print:grid-cols-4 print:px-12">
              {[
                { icon: <Users size={18} />, label: "Convidados", value: quote.guests },
                { icon: <Clock size={18} />, label: "Duração", value: `${quote.duration_hours}:00h` },
                { icon: <Calendar size={18} />, label: "Período", value: quote.period },
                { icon: <Info size={18} />, label: "Status", value: quote.status === 'aguardando' ? 'Em Análise' : quote.status }
              ].map((attr, i) => (
                <div key={i} className="bg-white p-8 rounded-[20px] flex flex-col gap-4 shadow-[0_4px_24px_-4px_rgba(92,31,46,0.04)] print:shadow-none print:border print:border-[#F5D8D5]">
                  <div className="text-[#D14237] opacity-80 print:hidden">{attr.icon}</div>
                  <div>
                    <div className="text-[10px] font-bold text-[#A38E88] uppercase tracking-[0.15em] mb-1">{attr.label}</div>
                    <div className="metric text-2xl font-semibold text-[#5C1F2E]">{attr.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ITEMIZATION */}
            <section className="print:px-12">
              <div className="flex items-baseline gap-6 mb-12 border-b border-[#F5D8D5]/30 pb-8">
                <h2 className="text-4xl font-bold text-[#5C1F2E]">O Investimento</h2>
                <span className="text-[11px] font-semibold text-[#A38E88] uppercase tracking-[0.2em]">Detalhamento Técnico</span>
              </div>

              <div className="space-y-16">
                {displayCategories.map(catName => {
                  const catItems = groupedItems[catName];
                  if (!catItems || catItems.length === 0) return null;

                  return (
                    <div key={catName} className="space-y-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#F5D8D5]/40"></div>
                        <span className="text-[10px] font-bold text-[#A38E88] uppercase tracking-[0.3em]">{catName}</span>
                        <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#F5D8D5]/40"></div>
                      </div>

                      <div className="space-y-4">
                        {catItems.map((item: any, idx: number) => {
                          const prodCat = item.products?.category;
                          const itemTotalValue = lineTotal(item, subtotalNonPercent);
                          const displayQty = isPercentItem(item) ? "Taxa Única" : `${item.quantity} un`;
                          const fallbackIcon = itemIcon(item);

                          return (
                            <div key={idx} className="bg-white hover:bg-[#FAE8E6]/10 p-8 rounded-[24px] flex items-center gap-10 transition-all group item-card print:border-b print:border-[#F5D8D5] print:rounded-none">
                              <div className="w-16 h-16 rounded-2xl bg-[#FAE8E6] overflow-hidden flex items-center justify-center text-[#D14237] flex-shrink-0 group-hover:scale-105 transition-transform">
                                {item.products?.image_url ? (
                                  <img src={item.products.image_url} alt={item.description} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="material-symbols-outlined text-2xl">{fallbackIcon}</span>
                                )}
                              </div>
                              <div className="flex-1">
                                <h4 className="font-lora text-xl font-bold text-[#5C1F2E] mb-1">{item.description}</h4>
                                <p className="text-sm text-[#A38E88] font-light">
                                  {prodCat ? `${prodCat} • ` : ""}Padrão de excelência Marília de Dirceu.
                                </p>
                              </div>
                              <div className="text-right px-8">
                                <span className="text-[10px] font-bold text-[#A38E88] uppercase tracking-widest block mb-1">Quantidade</span>
                                <span className="font-semibold text-[#5C1F2E]">
                                  {displayQty}
                                </span>
                              </div>
                              <div className="text-right min-w-[160px]">
                                <span className="text-[10px] font-bold text-[#A38E88] uppercase tracking-widest block mb-1">Valor Total</span>
                                <span className="font-lora text-2xl font-bold text-[#D14237]">
                                  R$ {formatCurrency(itemTotalValue)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* SIDEBAR - THE ANCHOR */}
          <aside className="w-full lg:w-[420px] print:w-full print:mt-10">
            <div className="sticky top-10 bg-[#5C1F2E] rounded-[40px] p-12 text-white shadow-2xl relative overflow-hidden sidebar-print">
              {/* Subtle background texture */}
              <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')] print:hidden"></div>
              
              <h3 className="text-[11px] font-bold uppercase tracking-[0.4em] text-white/30 mb-8 print:text-[#5C1F2E]/40">Investimento Total</h3>
              
              <div className="flex items-baseline gap-4 mb-16">
                <span className="text-2xl font-lora text-white/40 italic print:text-[#5C1F2E]/40">R$</span>
                <span className="text-7xl font-lora font-bold text-[#E8635A] tracking-tighter">
                  {formatCurrency(grandTotal)}
                </span>
              </div>

              <div className="space-y-6 mb-16 pb-12 border-b border-white/5 print:border-[#5C1F2E]/10">
                {[
                  { label: "Alimentação", value: foodTotal },
                  { label: "Taxa de Entrega", value: logisticsTotal },
                  ...(taxesTotal > 0 ? [{ label: "Serviços", value: taxesTotal }] : [])
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="text-white/40 font-medium print:text-[#5C1F2E]/50">{row.label}</span>
                    <span className="font-semibold font-lora text-lg">R$ {formatCurrency(row.value)}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white/5 p-6 rounded-3xl mb-12 border border-white/5 backdrop-blur-sm">
                <div className="flex gap-4">
                  <div className="text-[#D14237] mt-1 shrink-0"><CheckCircle size={18} /></div>
                  <p className="text-[12px] text-white/50 leading-relaxed italic">
                    Proposta válida por 15 dias. A reserva da data está sujeita à confirmação mediante aprovação deste documento.
                  </p>
                </div>
              </div>

              {quote.status !== 'aprovado' ? (
                <button
                  onClick={() => setShowApprovalModal(true)}
                  className="silk-btn w-full text-white py-6 rounded-[16px] font-bold text-base flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-black/20"
                >
                  Aprovar Proposta <ChevronRight size={20} />
                </button>
              ) : (
                <div className="bg-[#2E7D4F]/10 text-[#4CAF50] p-10 rounded-[32px] border border-[#2E7D4F]/20 flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
                  <div className="w-16 h-16 rounded-full bg-[#2E7D4F]/20 flex items-center justify-center">
                    <CheckCircle size={32} />
                  </div>
                  <span className="font-bold uppercase tracking-[0.2em] text-[10px]">Aprovada pelo Cliente</span>
                  <p className="text-[11px] text-center opacity-60 italic">Faturamento registrado em {new Date(quote.updated_at).toLocaleDateString('pt-BR')}</p>
                </div>
              )}

              <div className="mt-16 flex justify-center gap-8 opacity-20 hover:opacity-40 transition-opacity">
                 <span className="material-symbols-outlined text-3xl">payments</span>
                 <span className="material-symbols-outlined text-3xl">credit_card</span>
                 <span className="material-symbols-outlined text-3xl">account_balance</span>
              </div>
            </div>
          </aside>
        </div>

        {/* REFINED FOOTER */}
        <footer className="mt-40 pt-20 border-t border-[#F5D8D5]/40 flex flex-col items-center gap-10">
          <div className="font-artisan text-[#5C1F2E] text-2xl opacity-40">marília</div>
          <div className="flex gap-12 text-[10px] font-bold text-[#A38E88] uppercase tracking-[0.3em]">
            <a href="#" className="hover:text-[#D14237] transition-colors">Termos</a>
            <a href="#" className="hover:text-[#D14237] transition-colors">Privacidade</a>
            <a href="#" className="hover:text-[#D14237] transition-colors">Eventos</a>
          </div>
          <p className="text-[10px] text-[#A38E88] font-medium opacity-60">
            © 2024 MARÍLIA EVENTOS COFFEE BREAKS. TODOS OS DIREITOS RESERVADOS.
          </p>
        </footer>
      </main>

      {/* APPROVAL MODAL - THE EDITORIAL POPUP */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-[#3D1320]/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[40px] w-full max-w-xl overflow-hidden shadow-3xl animate-in zoom-in-95 duration-300">
            <div className="p-16">
              <h3 className="text-[#5C1F2E] text-4xl font-bold mb-4">Aprovação Final</h3>
              <p className="text-[#6B5C5A] text-lg mb-10 leading-relaxed font-light">
                Para darmos o próximo passo na organização do seu evento, informe os dados para o faturamento.
              </p>

              <form onSubmit={handleFinalApproval} className="space-y-8">
                <div>
                  <label className="text-[11px] font-bold text-[#A38E88] uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    {docType === "cpf" ? "CPF" : docType === "cnpj" ? "CNPJ" : "CPF ou CNPJ"} *
                    {docType && <span className="bg-[#FAE8E6] text-[#D14237] px-2 py-0.5 rounded-full text-[9px] font-bold">{docType.toUpperCase()}</span>}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    value={billingData.document}
                    onChange={e => handleDocumentChange(e.target.value)}
                    className="w-full bg-[#FDF6F2] border-none rounded-2xl p-5 focus:ring-2 focus:ring-[#D14237]/20 outline-none text-base placeholder:text-[#C4ABA8] font-mono tracking-wider"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#A38E88] uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                    {docType === "cnpj" ? "Razão Social" : "Nome Completo"} *
                    {isFetchingName && <Loader2 size={12} className="animate-spin text-[#D14237]" />}
                    {docType === "cnpj" && !isFetchingName && billingData.name && <span className="text-[#2E7D4F] text-[9px] font-bold">• preenchido automaticamente</span>}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={docType === "cnpj" ? "Razão social (preenchida automaticamente)" : "Nome completo conforme CPF"}
                    value={billingData.name}
                    onChange={e => setBillingData(prev => ({ ...prev, name: e.target.value }))}
                    disabled={isFetchingName}
                    className="w-full bg-[#FDF6F2] border-none rounded-2xl p-5 focus:ring-2 focus:ring-[#D14237]/20 outline-none text-base placeholder:text-[#C4ABA8] disabled:opacity-60"
                  />
                </div>

                <div className="flex gap-8 pt-6 items-center">
                  <button type="button" onClick={() => setShowApprovalModal(false)} className="text-[#A38E88] font-bold text-sm uppercase tracking-widest">Voltar</button>
                  <button 
                    type="submit" disabled={isApproving}
                    className="silk-btn flex-1 text-white py-5 rounded-[16px] font-bold shadow-xl shadow-[#D14237]/20 flex items-center justify-center gap-3 transition-transform hover:scale-[1.02]"
                  >
                    {isApproving ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                    Finalizar Aprovação
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
