"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, Download, Loader2, Users, Clock, Calendar, Info, MessageSquare, ChevronRight } from "lucide-react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/Notify";
import {
  lineTotal, itemIcon, computeQuoteTotals, computeSectionBreakdown,
} from "@/lib/itemClassification";

export default function VisualizacaoProposta() {
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
    if (quoteId) {
      fetchQuote();
    }
  }, [quoteId]);

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
      console.error("Erro ao puxar orçamento", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingData.document || !billingData.name) {
      toast.error("Por favor, preencha todos os campos para faturamento.");
      return;
    }

    try {
      setIsApproving(true);
      const rawDoc = billingData.document.replace(/\D/g, "");
      const entityType = rawDoc.length === 11 ? "PF" : "PJ";

      // Find or create client
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
      toast.success("Proposta aprovada com sucesso! Em breve nossa equipe entrará em contato.");
    } catch (err: any) {
      toast.error("Erro ao aprovar: " + err.message);
    } finally {
      setIsApproving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-brand-cream)]">
      <Loader2 className="animate-spin text-[var(--color-brand-red)]" size={40} />
      <p className="mt-4 font-lora text-[#5C1F2E]">Carregando proposta premium...</p>
    </div>
  );

  if (!quote) return <div className="min-h-screen p-20 text-center font-lora">Proposta não encontrada.</div>;

  const validUntil = new Date(quote.created_at);
  validUntil.setDate(validUntil.getDate() + 15); // Valid for 15 days as per design

  // Totais e detalhamento — fonte única (lib/itemClassification), igual à proposta pública.
  const { subtotalNonPercent, grandTotal } = computeQuoteTotals(items);
  const { food: foodTotal, delivery: deliveryTotal, services: servicesTotal } = computeSectionBreakdown(items);

  return (
    <div className="min-h-screen bg-[#FDFBF9] text-[#3D1320] font-dm flex flex-col items-center pb-20">
      
      {/* TOP NAV / LOGO */}
      <nav className="w-full max-w-[1200px] px-6 py-6 flex justify-between items-center">
        <img src="/logo.png" alt="Marília" className="h-8 object-contain" />
        <button className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#D14237] hover:opacity-70 transition-opacity">
          <Download size={14} /> Baixar PDF
        </button>
      </nav>

      <main className="w-full max-w-[1200px] px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 mt-4">
        
        {/* LEFT COLUMN: CONTENT */}
        <div className="lg:col-span-8 flex flex-col gap-10">
          
          {/* HEADER HERO */}
          <div className="relative rounded-3xl overflow-hidden h-[400px] shadow-2xl">
            <img 
              src="/premium_coffee_break_header_1776915328046.png" 
              className="w-full h-full object-cover" 
              alt="Coffee Break"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#3D1320]/90 via-[#3D1320]/40 to-transparent flex flex-col justify-center p-12">
              <span className="text-white/60 text-[11px] font-bold uppercase tracking-[0.2em] mb-4">
                Proposta Comercial — #CB-{new Date().getFullYear()}-{quoteId.slice(0,3).toUpperCase()}
              </span>
              <h1 className="font-lora text-white text-5xl font-bold leading-tight max-w-xl">
                {quote.event_type} para {quote.client_name}
              </h1>
              <p className="text-white/80 mt-6 max-w-md font-dm text-lg leading-relaxed">
                Experiência gastronômica artesanal desenhada para estimular conexões e criatividade durante seu evento.
              </p>
            </div>
            <div className="absolute top-0 left-0 w-2 h-full bg-[#D14237]"></div>
          </div>

          {/* ATTRIBUTES GRID */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <Users size={18} />, label: "Convidados", value: quote.guests },
              { icon: <Clock size={18} />, label: "Duração", value: `${quote.duration_hours}:00h` },
              { icon: <Calendar size={18} />, label: "Período", value: quote.period },
              { icon: <Info size={18} />, label: "Status", value: quote.status === 'aguardando' ? 'Análise' : quote.status }
            ].map((attr, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-[#F0E5E2] flex flex-col gap-3 shadow-sm">
                <div className="text-[#D14237]">{attr.icon}</div>
                <div>
                  <div className="text-[10px] font-bold text-[#A38E88] uppercase tracking-wider mb-1">{attr.label}</div>
                  <div className="font-lora text-xl font-bold text-[#3D1320]">{attr.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ITEM BREAKDOWN */}
          <section className="mt-4">
            <div className="flex items-center justify-between mb-8 border-b border-[#F0E5E2] pb-4">
              <h2 className="font-lora text-3xl font-bold text-[#3D1320] uppercase tracking-tight">Detalhamento do Investimento</h2>
              <span className="text-[10px] font-bold text-[#D14237] uppercase tracking-widest">Itens da Proposta</span>
            </div>

            <div className="flex flex-col gap-4">
              {items.map((item, idx) => {
                const icon = itemIcon(item);

                return (
                  <div key={idx} className="bg-white p-6 rounded-3xl border border-[#F0E5E2] flex items-center gap-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-14 h-14 rounded-2xl bg-[#FDF6F2] flex items-center justify-center text-[#D14237]">
                      <span className="material-symbols-outlined text-2xl">{icon}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-lora text-lg font-bold text-[#3D1320]">{item.description}</h4>
                      <p className="text-xs text-[#A38E88] mt-1 line-clamp-1">Padrão de qualidade Marília de Dirceu com ingredientes selecionados.</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1 px-4">
                      <span className="text-[10px] font-bold text-[#A38E88] uppercase tracking-widest">QTD</span>
                      <span className="font-dm font-bold text-[#3D1320]">{item.quantity} {item.unit}</span>
                    </div>
                    <div className="text-right border-l border-[#F0E5E2] pl-8 flex flex-col items-end gap-1">
                      <span className="text-[10px] font-bold text-[#A38E88] uppercase tracking-widest">VALOR</span>
                      <span className="font-lora text-xl font-bold text-[#3D1320]">R$ {lineTotal(item, subtotalNonPercent).toFixed(2).replace(".", ",")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* CONTACT PERSON */}
          <div className="mt-10 p-8 rounded-[32px] bg-[#FDF6F2] border border-[#F0E5E2] flex items-center gap-6">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md">
              <img src="https://i.pravatar.cc/150?u=mariana" alt="Mariana" />
            </div>
            <div className="flex-1">
              <h4 className="font-lora text-lg font-bold text-[#3D1320]">Dúvidas sobre a proposta?</h4>
              <p className="text-sm text-[#A38E88]">Fale diretamente com <span className="font-bold text-[#D14237]">Mariana Silveira</span>, sua Gerente de Eventos.</p>
            </div>
            <button className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-[#D14237] hover:bg-[#D14237] hover:text-white transition-all">
              <MessageSquare size={20} />
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: SIDEBAR */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-[#3D1320] rounded-[32px] p-10 text-white shadow-2xl sticky top-8">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50 mb-4">Investimento Total</h3>
            <div className="flex items-baseline gap-2 mb-10">
              <span className="text-2xl font-lora text-white/60">R$</span>
              <span className="text-6xl font-lora font-bold text-[#D14237] tracking-tight">
                {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex flex-col gap-6 mb-10 pb-10 border-b border-white/10">
              <div className="flex justify-between text-sm">
                <span className="text-white/50">Alimentação</span>
                <span className="font-bold">R$ {foodTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              {deliveryTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Taxa de Entrega</span>
                  <span className="font-bold">R$ {deliveryTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {servicesTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Serviços</span>
                  <span className="font-bold">R$ {servicesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>

            <div className="flex items-start gap-4 p-5 bg-white/5 rounded-2xl mb-8">
              <div className="text-[#D14237] mt-1"><CheckCircle size={16} /></div>
              <p className="text-[11px] text-white/60 leading-relaxed italic">
                Esta proposta é válida por 15 dias. A reserva da data está sujeita à confirmação de disponibilidade no ato da aprovação.
              </p>
            </div>

            {quote.status !== 'aprovado' ? (
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => setShowApprovalModal(true)}
                  className="w-full bg-[#D14237] hover:bg-[#B73427] text-white py-5 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-[#D14237]/20"
                >
                  Aprovar Proposta <ChevronRight size={18} />
                </button>
                <button className="w-full bg-white/5 hover:bg-white/10 text-white/70 py-4 rounded-2xl font-bold text-sm transition-all border border-white/10">
                  Solicitar Revisão
                </button>
              </div>
            ) : (
              <div className="bg-[#2E7D4F]/20 text-[#4CAF50] p-6 rounded-3xl border border-[#2E7D4F]/40 flex flex-col items-center gap-3">
                <CheckCircle size={32} />
                <span className="font-bold uppercase tracking-widest text-xs">Proposta Aprovada</span>
                <p className="text-[10px] text-center opacity-80">Aprovação realizada em {new Date(quote.updated_at).toLocaleDateString('pt-BR')}</p>
              </div>
            )}

            <div className="flex justify-center gap-6 mt-10 text-white/30">
               <span className="material-symbols-outlined">payments</span>
               <span className="material-symbols-outlined">credit_card</span>
               <span className="material-symbols-outlined">account_balance</span>
            </div>
          </div>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="w-full max-w-[1200px] px-6 mt-20 pt-10 border-t border-[#F0E5E2] flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex flex-col gap-2">
          <img src="/logo.png" alt="Marília" className="h-6 grayscale opacity-50 self-start" />
          <p className="text-[10px] font-bold text-[#A38E88] uppercase tracking-widest">Catering de Luxo & Coffee Breaks</p>
        </div>
        <div className="flex gap-8 text-[10px] font-bold text-[#A38E88] uppercase tracking-[0.15em]">
          <a href="#" className="hover:text-[#D14237]">Termos de Serviço</a>
          <a href="#" className="hover:text-[#D14237]">Políticas de Privacidade</a>
          <a href="#" className="hover:text-[#D14237]">Contato</a>
        </div>
        <div className="text-[10px] text-[#A38E88] font-medium">
          © 2024 MARÍLIA EVENTOS. TODOS OS DIREITOS RESERVADOS.
        </div>
      </footer>

      {/* APPROVAL MODAL */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-[#3D1320]/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[40px] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-10">
              <div className="w-16 h-16 rounded-3xl bg-[#FDF6F2] text-[#D14237] flex items-center justify-center mb-6">
                <CheckCircle size={32} />
              </div>
              <h3 className="font-lora text-3xl font-bold text-[#3D1320] mb-2">Finalizar Aprovação</h3>
              <p className="text-[#A38E88] text-sm leading-relaxed mb-8">
                Para darmos continuidade ao seu evento, precisamos dos dados para emissão da nota fiscal e contrato.
              </p>

              <form onSubmit={handleFinalApproval} className="flex flex-col gap-6">
                <div>
                  <label className="text-[10px] font-bold text-[#A38E88] uppercase tracking-widest mb-2 flex items-center gap-2">
                    {docType === "cpf" ? "CPF" : docType === "cnpj" ? "CNPJ" : "CPF ou CNPJ"} *
                    {docType && <span className="bg-[#FAE8E6] text-[#D14237] px-2 py-0.5 rounded-full text-[9px] font-bold">{docType.toUpperCase()}</span>}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                    value={billingData.document}
                    onChange={e => handleDocumentChange(e.target.value)}
                    className="w-full bg-[#FDFBF9] border border-[#F0E5E2] rounded-2xl p-4 focus:outline-none focus:border-[#D14237] text-sm font-mono tracking-wider"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#A38E88] uppercase tracking-widest mb-2 flex items-center gap-2">
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
                    className="w-full bg-[#FDFBF9] border border-[#F0E5E2] rounded-2xl p-4 focus:outline-none focus:border-[#D14237] text-sm disabled:opacity-60"
                  />
                </div>

                <div className="flex gap-4 mt-4">
                  <button 
                    type="button"
                    onClick={() => setShowApprovalModal(false)}
                    className="flex-1 text-[#A38E88] font-bold text-sm py-4"
                  >
                    Voltar
                  </button>
                  <button 
                    type="submit"
                    disabled={isApproving}
                    className="flex-[2] bg-[#D14237] text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-[#D14237]/20 flex items-center justify-center gap-2"
                  >
                    {isApproving ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                    Confirmar Aprovação
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
