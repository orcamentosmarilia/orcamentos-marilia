"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  TrendingUp, Clock, CheckCircle2, Users, CalendarDays, Loader2,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";

/* ─── Types ─────────────────────────────────────────────────── */
interface QuoteRow {
  id: string;
  client_name: string;
  status: string;
  event_date: string;
  event_type: string;
  guests: number;
  created_at: string;
  lead_source: string;
  created_by: string;
  approved_at?: string;
  lost_reason?: string;
  total: number;
}

type Preset = "mes" | "trimestre" | "ano" | "custom";

/* ─── Helpers ────────────────────────────────────────────────── */
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

const STATUS_COLOR: Record<string, string> = {
  aprovado: "#2E7D4F", pago: "#2E7D4F",
  rascunho: "#9E9E9E", aguardando: "#D14237", realizado: "#1565C0",
  perdido: "#64748B",
};
const STATUS_LABEL: Record<string, string> = {
  aprovado: "Aprovado", pago: "Pago",
  rascunho: "Rascunho", aguardando: "Aguardando", realizado: "Realizado",
  perdido: "Perdido",
};

function statusBadge(status: string) {
  const s = status.toLowerCase();
  const color = STATUS_COLOR[s] || "#9E9E9E";
  const label = STATUS_LABEL[s] || status;
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide text-white"
      style={{ backgroundColor: color }}
    >{label}</span>
  );
}

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-rose-100 rounded-xl shadow-lg px-4 py-3 text-sm font-dm">
      <p className="font-bold text-[#5C1F2E] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.fill }} className="text-xs">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function DashboardPage() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>("mes");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  /* ── Preset → date range ─── */
  useEffect(() => {
    const now = new Date();
    if (preset === "mes") {
      setDateFrom(isoDate(new Date(now.getFullYear(), now.getMonth(), 1)));
      setDateTo(isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    } else if (preset === "trimestre") {
      const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      setDateFrom(isoDate(from));
      setDateTo(isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    } else if (preset === "ano") {
      setDateFrom(`${now.getFullYear()}-01-01`);
      setDateTo(`${now.getFullYear()}-12-31`);
    }
  }, [preset]);

  /* ── Fetch ─── */
  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const [{ data: qData }, { data: iData }] = await Promise.all([
        supabase.from("quotes").select(
          "id, client_name, status, event_date, event_type, guests, created_at, lead_source, created_by, total_value, approved_at, lost_reason"
        ).order("created_at", { ascending: false }),
        supabase.from("quote_items").select("quote_id, quantity, unit_price"),
      ]);

      const itemTotals: Record<string, number> = {};
      (iData || []).forEach((it: any) => {
        itemTotals[it.quote_id] = (itemTotals[it.quote_id] || 0)
          + Number(it.quantity) * Number(it.unit_price);
      });

      setQuotes((qData || []).map((q: any) => ({
        ...q,
        total: itemTotals[q.id] ?? Number(q.total_value) ?? 0,
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /* ── Filtered quotes (by date) ─── */
  const filtered = useMemo(() => {
    if (!dateFrom && !dateTo) return quotes;
    return quotes.filter(q => {
      const d = q.created_at.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    });
  }, [quotes, dateFrom, dateTo]);

  /* ── KPIs ─── */
  const kpis = useMemo(() => {
    const sum = (arr: QuoteRow[]) => arr.reduce((s, q) => s + q.total, 0);
    const aberto   = filtered.filter(q => ["rascunho","aguardando"].includes(q.status));
    const aprovado = filtered.filter(q => ["aprovado","pago"].includes(q.status));
    const perdido  = filtered.filter(q => q.status === "perdido");
    return {
      total:    { count: filtered.length,   value: sum(filtered) },
      aberto:   { count: aberto.length,     value: sum(aberto) },
      aprovado: { count: aprovado.length,   value: sum(aprovado) },
      perdido:  { count: perdido.length,    value: sum(perdido) },
    };
  }, [filtered]);

  /* ── Avg approval time ─── */
  const avgDays = useMemo(() => {
    const withDate = quotes.filter(q => q.approved_at && ["aprovado","pago"].includes(q.status));
    if (withDate.length === 0) return null;
    const totalMs = withDate.reduce((s, q) => {
      return s + (new Date(q.approved_at!).getTime() - new Date(q.created_at).getTime());
    }, 0);
    return Math.round(totalMs / withDate.length / (1000 * 60 * 60 * 24));
  }, [quotes]);

  /* ── Monthly bar chart ─── */
  const monthlyData = useMemo(() => {
    const now = new Date();
    const buckets: Record<string, { month: string; Gerado: number; Aprovado: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = { month: MONTHS[d.getMonth()], Gerado: 0, Aprovado: 0 };
    }
    quotes.forEach(q => {
      const key = q.created_at.slice(0, 7);
      if (!buckets[key]) return;
      buckets[key].Gerado += q.total;
      if (["aprovado","pago"].includes(q.status)) buckets[key].Aprovado += q.total;
    });
    return Object.values(buckets);
  }, [quotes]);

  /* ── Pie chart ─── */
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(q => {
      const s = q.status.toLowerCase();
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([s, v]) => ({
      name: STATUS_LABEL[s] || s,
      value: v,
      color: STATUS_COLOR[s] || "#9E9E9E",
    }));
  }, [filtered]);

  /* ─────────────────────── RENDER ─────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#D14237]" size={36} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      <PageHeader
        title="Dashboard"
        description="Visão financeira dos orçamentos"
        actions={
          <Link href="/orcamentos/novo" className="bg-gradient-to-tr from-[#D14237] to-[#E8635A] hover:to-[#D14237] text-white px-5 py-2.5 rounded-xl font-dm font-bold text-sm flex items-center gap-2 shadow-xl shadow-[#D14237]/20 transition-all">
            <span className="material-symbols-outlined text-lg">add</span>
            Novo Orçamento
          </Link>
        }
      />

      {/* ── Date filter ── */}
      <div className="flex flex-wrap items-center gap-3">
        {([
          { id: "mes",       label: "Este mês" },
          { id: "trimestre", label: "Últimos 3 meses" },
          { id: "ano",       label: "Este ano" },
          { id: "custom",    label: "Personalizado" },
        ] as { id: Preset; label: string }[]).map(p => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-dm font-bold border transition-all ${
              preset === p.id
                ? "bg-[#5C1F2E] text-white border-[#5C1F2E]"
                : "bg-white text-rose-400 border-rose-100 hover:border-[#5C1F2E]"
            }`}
          >
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <CalendarDays size={14} className="text-rose-300" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="border border-rose-100 rounded-lg px-3 py-1.5 text-xs font-dm focus:outline-none focus:border-[#5C1F2E] text-[#5C1F2E]"
            />
            <span className="text-rose-300 text-xs">até</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="border border-rose-100 rounded-lg px-3 py-1.5 text-xs font-dm focus:outline-none focus:border-[#5C1F2E] text-[#5C1F2E]"
            />
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            label: "Total Gerado",
            icon: <TrendingUp size={18} className="text-[#D14237]" />,
            count: kpis.total.count,
            value: kpis.total.value,
            accent: "text-[#D14237]",
            bg: "bg-rose-50",
            sub: null as string | null,
          },
          {
            label: "Em Aberto",
            icon: <Clock size={18} className="text-amber-500" />,
            count: kpis.aberto.count,
            value: kpis.aberto.value,
            accent: "text-amber-600",
            bg: "bg-amber-50",
            sub: null,
          },
          {
            label: "Aprovados",
            icon: <CheckCircle2 size={18} className="text-emerald-600" />,
            count: kpis.aprovado.count,
            value: kpis.aprovado.value,
            accent: "text-emerald-700",
            bg: "bg-emerald-50",
            sub: avgDays !== null ? `Tempo médio: ${avgDays} dia${avgDays !== 1 ? "s" : ""}` : null,
          },
          {
            label: "Perdidos",
            icon: <Users size={18} className="text-slate-500" />,
            count: kpis.perdido.count,
            value: kpis.perdido.value,
            accent: "text-slate-600",
            bg: "bg-slate-50",
            sub: kpis.total.count > 0
              ? `${Math.round((kpis.perdido.count / kpis.total.count) * 100)}% dos orçamentos`
              : null,
          },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl shadow-sm p-5 border border-rose-50">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-dm font-bold text-rose-400 uppercase tracking-widest">{card.label}</p>
              <span className={`p-1.5 rounded-xl ${card.bg}`}>{card.icon}</span>
            </div>
            <p className={`font-lora text-2xl font-bold ${card.accent}`}>{fmt(card.value)}</p>
            <p className="text-xs font-dm text-rose-300 mt-1">{card.count} orçamento{card.count !== 1 ? "s" : ""}</p>
            {card.sub && <p className="text-[10px] font-dm text-slate-400 mt-1.5 font-medium">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Bar chart — last 6 months */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6 border border-rose-50">
          <h2 className="font-lora text-lg font-bold text-[#5C1F2E] mb-1">Receita por mês</h2>
          <p className="text-xs font-dm text-rose-300 mb-6">Últimos 6 meses — todos os orçamentos</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={4}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#C4ABA8", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#C4ABA8", fontFamily: "DM Sans" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<BarTooltip />} />
              <Bar dataKey="Gerado" fill="#FAE8E6" radius={[6,6,0,0]} />
              <Bar dataKey="Aprovado" fill="#D14237" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-5 mt-4">
            <span className="flex items-center gap-1.5 text-xs font-dm text-rose-400">
              <span className="w-3 h-3 rounded bg-[#FAE8E6] border border-rose-200 inline-block" />
              Gerado
            </span>
            <span className="flex items-center gap-1.5 text-xs font-dm text-rose-400">
              <span className="w-3 h-3 rounded bg-[#D14237] inline-block" />
              Aprovado
            </span>
          </div>
        </div>

        {/* Pie chart — status distribution */}
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-rose-50">
          <h2 className="font-lora text-lg font-bold text-[#5C1F2E] mb-1">Por status</h2>
          <p className="text-xs font-dm text-rose-300 mb-4">Período filtrado</p>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-rose-200 text-sm font-dm">Sem dados</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any) => [value + " orç.", name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 mt-2">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs font-dm">
                    <span className="flex items-center gap-1.5 text-rose-500">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: d.color }} />
                      {d.name}
                    </span>
                    <span className="font-bold text-[#5C1F2E]">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Quotes table ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-rose-50 overflow-hidden">
        <div className="px-6 py-4 border-b border-rose-50">
          <h2 className="font-lora text-lg font-bold text-[#5C1F2E]">
            Orçamentos no período
            <span className="ml-2 text-sm font-dm font-normal text-rose-300">({filtered.length})</span>
          </h2>
        </div>
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-rose-300 font-dm text-sm">Nenhum orçamento no período selecionado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-dm">
              <thead>
                <tr className="bg-rose-50 text-[10px] font-bold uppercase tracking-wider text-rose-400">
                  <th className="px-6 py-3 text-left">Cliente</th>
                  <th className="px-6 py-3 text-left">Evento</th>
                  <th className="px-6 py-3 text-center">Pessoas</th>
                  <th className="px-6 py-3 text-center">Data</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3 text-right">Valor</th>
                  <th className="px-6 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q, i) => (
                  <tr key={q.id} className={`border-t border-rose-50 hover:bg-[#FAE8E6]/40 transition-colors ${i % 2 === 1 ? "bg-rose-50/30" : ""}`}>
                    <td className="px-6 py-3 font-bold text-[#5C1F2E]">{q.client_name}</td>
                    <td className="px-6 py-3 text-rose-400 capitalize">{q.event_type || "—"}</td>
                    <td className="px-6 py-3 text-center text-rose-400">{q.guests}</td>
                    <td className="px-6 py-3 text-center text-rose-400">
                      {q.event_date ? new Date(q.event_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-6 py-3 text-center">{statusBadge(q.status)}</td>
                    <td className="px-6 py-3 text-right font-bold text-[#5C1F2E]">
                      {q.total > 0 ? fmt(q.total) : <span className="text-rose-200">—</span>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Link href={`/orcamentos/${q.id}/revisao`} className="p-1.5 text-rose-300 hover:text-[#D14237] hover:bg-rose-50 rounded-lg transition-all inline-flex">
                        <span className="material-symbols-outlined text-base">visibility</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-rose-100 bg-rose-50">
                  <td colSpan={5} className="px-6 py-3 font-bold text-xs text-rose-400 uppercase tracking-wider">Total do período</td>
                  <td className="px-6 py-3 text-right font-bold text-[#D14237] text-base font-lora">{fmt(kpis.total.value)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
