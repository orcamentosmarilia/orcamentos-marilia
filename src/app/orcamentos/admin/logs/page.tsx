"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast, confirmDialog } from "@/components/Notify";
import { History, Search, FileJson, RefreshCw, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import PageHeader from "@/components/PageHeader";

interface Log {
  id: string;
  action: string;
  details: any;
  metadata?: any;
  user_id?: string;
  created_at: string;
}

interface UserProfile {
  role: string;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    fetchLogs();
    fetchUserRole();
  }, []);

  async function fetchUserRole() {
    const sessionStr = localStorage.getItem("marilia_admin_session");
    if (sessionStr) {
      const session = JSON.parse(sessionStr);
      const { data } = await supabase
        .from("admin_users")
        .select("role")
        .eq("email", session.email)
        .single();
      if (data) setUserRole(data.role);
    }
  }

  async function fetchLogs() {
    try {
      const { data, error } = await supabase
        .from("admin_logs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("Erro ao buscar logs:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleRestore = async (log: Log) => {
    if (!log.metadata) {
      toast.error("Nenhum dado disponível para restaurar.");
      return;
    }

    if (!(await confirmDialog(`Deseja restaurar o orçamento de ${log.metadata.client_name}?`))) {
      return;
    }

    try {
      // 1. Re-insert the quote
      const { error: insertError } = await supabase
        .from("quotes")
        .insert([log.metadata]);

      if (insertError) throw insertError;

      // 2. Log the restoration
      await supabase.from("admin_logs").insert([{
        action: "RESTORE_QUOTE",
        details: `Restaurado: Orçamento de ${log.metadata.client_name}`,
        user_id: JSON.parse(localStorage.getItem("marilia_admin_session") || "{}").email || "admin"
      }]);

      toast.success("Orçamento restaurado com sucesso!");
      fetchLogs();
    } catch (err: any) {
      toast.error("Erro ao restaurar: " + err.message);
    }
  };

  const handlePermanentDelete = async (logId: string) => {
    if (!(await confirmDialog({ message: "Excluir este log permanentemente? Isso removerá a possibilidade de recuperação.", danger: true, confirmText: "Excluir" }))) {
      return;
    }

    try {
      const { error } = await supabase.from("admin_logs").delete().eq("id", logId);
      if (error) throw error;
      setLogs(prev => prev.filter(l => l.id !== logId));
    } catch (err: any) {
      toast.error("Erro ao excluir log: " + err.message);
    }
  };

  const filteredLogs = logs.filter(log => {
    const detailsStr = typeof log.details === 'object' && log.details !== null ? JSON.stringify(log.details) : String(log.details || "");
    const actionStr = String(log.action || "");
    const userIdStr = String(log.user_id || "");
    
    return (
      actionStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      detailsStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userIdStr.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Logs do Administrador"
        description="Histórico de ações críticas realizadas no sistema."
        actions={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-rose-300" size={18} />
            <input type="text" placeholder="Pesquisar logs..." className="pl-10 pr-4 py-2 bg-white border border-brand-pink2 rounded-xl text-sm focus:outline-none focus:border-[#D14237] w-64 font-dm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        }
      />

      <div className="bg-white rounded-3xl shadow-sm border border-brand-pink2 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-rose-300 font-dm">Carregando histórico...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-rose-300 font-dm italic">Nenhum log encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAE8E6]/50 border-b border-brand-pink2 text-[11px] uppercase tracking-widest font-bold text-rose-400">
                  <th className="px-6 py-4">Data/Hora</th>
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Ação</th>
                  <th className="px-6 py-4">Detalhes</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="font-dm text-sm">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-brand-pink2/50 hover:bg-rose-50/30 transition-colors">
                    <td className="px-6 py-4 text-rose-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-rose-300 font-medium italic">
                      {log.user_id || '---'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                        log.action.includes('DELETE') ? 'bg-red-50 text-red-600 border border-red-100' : 
                        log.action.includes('RESTORE') ? 'bg-green-50 text-green-600 border border-green-100' :
                        'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-[#5C1F2E] font-medium max-w-md truncate">
                        {log.action.includes('DELETE') ? <AlertCircle size={14} className="text-red-300 flex-shrink-0" /> : <FileJson size={14} className="text-rose-300 flex-shrink-0" />}
                        <span>
                          {typeof log.details === 'object' && log.details !== null 
                            ? (log.details.client_name ? `Orçamento de ${log.details.client_name}` : JSON.stringify(log.details))
                            : String(log.details || "Sem detalhes")
                          }
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {userRole === 'Administrador' && (
                          <>
                            {log.action === 'DELETE_QUOTE' && log.metadata && (
                              <button 
                                onClick={() => handleRestore(log)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                                title="Recuperar Orçamento"
                              >
                                <RefreshCw size={16} />
                              </button>
                            )}
                            <button 
                              onClick={() => handlePermanentDelete(log.id)}
                              className="p-2 text-rose-300 hover:text-red-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Excluir Log Permanente"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
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
