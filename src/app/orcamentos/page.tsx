"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/Notify";
import { Trash2, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";

interface Quote {
  id: string;
  client_name: string;
  status: string;
  event_date: string;
  event_type: string;
  guests: number;
  created_at: string;
}

export default function OrcamentosListPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; quoteId: string | null; quoteName: string | null }>({
    open: false, quoteId: null, quoteName: null
  });
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");

  useEffect(() => {
    fetchQuotes();
    fetchMasterPassword();
  }, []);

  async function fetchMasterPassword() {
    const { data } = await supabase.from("settings").select("*").eq("key", "security_master_password").single();
    if (data) setMasterPassword(data.value);
  }

  async function fetchQuotes() {
    try {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, client_name, status, event_date, event_type, guests, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuotes(data || []);
    } catch (error) {
      console.error("Erro ao buscar orçamentos:", error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "aprovado" || s === "pago") {
      return <span className="bg-[#2E7D4F]/12 text-[#2E7D4F] border border-[#2E7D4F]/30 rounded-full px-3 py-1 text-[11px] font-semibold uppercase">Aprovado</span>;
    }
    if (s === "rascunho") {
      return <span className="bg-brand-gray/10 text-brand-gray border border-[#C4ABA8] rounded-full px-3 py-1 text-[11px] font-semibold uppercase">Rascunho</span>;
    }
    // Default / Pending
    return <span className="bg-[#FAE8E6] text-[#3D1320] px-3 py-1 rounded-full text-[11px] font-semibold uppercase">Aguardando</span>;
  };

  const handleDelete = async () => {
    if (password !== masterPassword) {
      toast.error("Senha incorreta!");
      return;
    }

    setDeleting(true);
    try {
      // 1. Fetch full data before deleting
      const { data: quoteData } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", deleteModal.quoteId)
        .single();

      // 2. Delete the quote
      const { error } = await supabase.from("quotes").delete().eq("id", deleteModal.quoteId);
      if (error) throw error;

      // 3. Log the action with metadata
      const { error: logError } = await supabase.from("admin_logs").insert([{
        action: "DELETE_QUOTE",
        details: `Orçamento de ${deleteModal.quoteName}`,
        metadata: quoteData,
        user_id: JSON.parse(localStorage.getItem("marilia_admin_session") || "{}").email || "admin"
      }]);
      
      if (logError) {
        console.error("Erro ao gravar log:", logError);
      }

      setDeleteModal({ open: false, quoteId: null, quoteName: null });
      setPassword("");
      fetchQuotes();
    } catch (error: any) {
      toast.error("Erro ao deletar orçamento: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* ... previous code ... */}
      
      {/* MODAL DE DELETAR */}
      {deleteModal.open && (
        <div className="fixed inset-0 bg-[#5C1F2E]/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-brand-pink2">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
                <AlertTriangle className="text-red-500" size={32} />
              </div>
              <h2 className="font-lora text-xl font-bold text-[#5C1F2E] mb-2">Confirmar Exclusão</h2>
              <p className="font-dm text-rose-400 text-sm mb-6">
                Você está prestes a apagar permanentemente o orçamento de <strong>{deleteModal.quoteName}</strong>. Esta ação não pode ser desfeita.
              </p>
              
              <div className="text-left mb-6">
                <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--color-brand-gray)] uppercase tracking-wider mb-2">
                  <ShieldCheck size={14} className="text-red-500" />
                  Senha de Segurança
                </label>
                <input 
                  type="password"
                  autoFocus
                  className="w-full border border-brand-pink2 rounded-xl p-3 text-sm focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  placeholder="Digite a senha mestra..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => { setDeleteModal({ open: false, quoteId: null, quoteName: null }); setPassword(""); }}
                  className="flex-1 px-4 py-3 rounded-xl font-dm font-bold text-sm text-gray-500 hover:bg-gray-50 transition-colors border border-gray-100"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={deleting || !password}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-dm font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all"
                >
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="Lista de Orçamentos"
        description="Gerencie e acompanhe o status de todas as propostas comerciais."
        actions={
          <Link href="/orcamentos/novo" className="bg-gradient-to-tr from-[#D14237] to-[#E8635A] hover:to-[#D14237] text-white px-6 py-2.5 rounded-xl font-dm font-bold text-sm flex items-center gap-2 shadow-xl shadow-[#D14237]/20 transition-all">
            <span className="material-symbols-outlined text-lg">add</span>
            Novo Orçamento
          </Link>
        }
      />

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-rose-300 font-dm">Carregando...</div>
        ) : quotes.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <span className="material-symbols-outlined text-6xl text-rose-200 mb-4">inbox</span>
            <h3 className="font-lora text-xl font-bold text-[#5C1F2E] mb-2">Nenhum orçamento encontrado</h3>
            <p className="font-dm text-rose-400 text-sm max-w-md">Você ainda não gerou nenhuma proposta comercial. Crie um novo orçamento para começar.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#5C1F2E] text-white">
                  <th className="px-6 py-4 font-dm font-bold text-xs uppercase tracking-wider rounded-tl-2xl">Cliente</th>
                  <th className="px-6 py-4 font-dm font-bold text-xs uppercase tracking-wider">Evento</th>
                  <th className="px-6 py-4 font-dm font-bold text-xs uppercase tracking-wider text-center">Convidados</th>
                  <th className="px-6 py-4 font-dm font-bold text-xs uppercase tracking-wider text-center">Data</th>
                  <th className="px-6 py-4 font-dm font-bold text-xs uppercase tracking-wider text-center">Status</th>
                  <th className="px-6 py-4 font-dm font-bold text-xs uppercase tracking-wider text-right rounded-tr-2xl">Ação</th>
                </tr>
              </thead>
              <tbody className="font-dm text-sm">
                {quotes.map((quote, idx) => (
                  <tr 
                    key={quote.id} 
                    className={`transition-colors hover:bg-[#FAE8E6] ${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAE8E6]/40'}`}
                  >
                    <td className="px-6 py-4 font-bold text-[#5C1F2E]">{quote.client_name}</td>
                    <td className="px-6 py-4 text-[var(--color-brand-gray)] capitalize">{quote.event_type}</td>
                    <td className="px-6 py-4 text-center text-[var(--color-brand-gray)] font-medium">{quote.guests} pessoas</td>
                    <td className="px-6 py-4 text-center text-[var(--color-brand-gray)]">
                      {quote.event_date ? new Date(quote.event_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusBadge(quote.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/orcamentos/${quote.id}/revisao`}
                        className="p-2 inline-flex text-rose-400 hover:text-[#D14237] hover:bg-rose-50 rounded-lg transition-all"
                        title="Ver Orçamento"
                      >
                        <span className="material-symbols-outlined">visibility</span>
                      </Link>
                      <button 
                        onClick={() => setDeleteModal({ open: true, quoteId: quote.id, quoteName: quote.client_name })}
                        className="p-2 inline-flex text-rose-300 hover:text-red-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Excluir Orçamento"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
