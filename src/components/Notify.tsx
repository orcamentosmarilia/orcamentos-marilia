"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from "lucide-react";

// ──────────────────────────────────────────────────────────────
// Sistema de notificações no estilo do sistema (toast + confirm).
// Substitui os alert()/confirm() nativos do navegador.
//
// Uso:
//   import { toast, confirmDialog } from "@/components/Notify";
//   toast("Salvo com sucesso!", "success");
//   toast.error("Algo deu errado");
//   if (await confirmDialog("Excluir este item?")) { ... }
// ──────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  id: number;
  resolve: (value: boolean) => void;
}

// Store baseado em eventos — chamável de qualquer lugar (inclusive fora de React)
let toastListeners: ((t: ToastItem) => void)[] = [];
let confirmListeners: ((c: ConfirmState) => void)[] = [];
let counter = 0;

function baseToast(message: string, type: ToastType = "info") {
  const item: ToastItem = { id: ++counter, message, type };
  toastListeners.forEach((l) => l(item));
}

export const toast = Object.assign(baseToast, {
  success: (m: string) => baseToast(m, "success"),
  error: (m: string) => baseToast(m, "error"),
  info: (m: string) => baseToast(m, "info"),
});

export function confirmDialog(opts: string | ConfirmOptions): Promise<boolean> {
  const o: ConfirmOptions = typeof opts === "string" ? { message: opts } : opts;
  return new Promise((resolve) => {
    const state: ConfirmState = { id: ++counter, resolve, ...o };
    confirmListeners.forEach((l) => l(state));
  });
}

const TOAST_STYLES: Record<ToastType, { accent: string; icon: React.ReactNode; ring: string }> = {
  success: { accent: "bg-emerald-500", ring: "border-emerald-100", icon: <CheckCircle2 size={20} className="text-emerald-500" /> },
  error:   { accent: "bg-[#D14237]",   ring: "border-rose-100",    icon: <AlertCircle size={20} className="text-[#D14237]" /> },
  info:    { accent: "bg-[#5C1F2E]",   ring: "border-rose-100",    icon: <Info size={20} className="text-[#5C1F2E]" /> },
};

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const s = TOAST_STYLES[item.type];
  return (
    <div className={`pointer-events-auto flex items-stretch overflow-hidden bg-white rounded-2xl shadow-xl border ${s.ring} w-[340px] max-w-[calc(100vw-2rem)] animate-[slideIn_0.25s_ease-out]`}>
      <div className={`w-1.5 shrink-0 ${s.accent}`} />
      <div className="flex items-start gap-3 px-4 py-3.5 flex-1">
        <div className="shrink-0 mt-0.5">{s.icon}</div>
        <p className="text-sm font-dm text-[#5C1F2E] flex-1 leading-snug">{item.message}</p>
        <button onClick={onClose} className="shrink-0 text-rose-300 hover:text-[#D14237] transition-colors -mr-1">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  useEffect(() => {
    const onToast = (t: ToastItem) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 4500);
    };
    const onConfirm = (c: ConfirmState) => setConfirmState(c);
    toastListeners.push(onToast);
    confirmListeners.push(onConfirm);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== onToast);
      confirmListeners = confirmListeners.filter((l) => l !== onConfirm);
    };
  }, []);

  const closeConfirm = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  useEffect(() => {
    if (!confirmState) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeConfirm(false);
      if (e.key === "Enter") closeConfirm(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmState]);

  return (
    <>
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </div>

      {/* Modal de confirmação */}
      {confirmState && (
        <div className="fixed inset-0 bg-[#5C1F2E]/80 backdrop-blur-sm z-[210] flex items-center justify-center p-4" onClick={() => closeConfirm(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-[slideIn_0.2s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <div className="p-7 text-center">
              <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center ${confirmState.danger ? "bg-rose-50" : "bg-[#FDF6F2]"}`}>
                {confirmState.danger
                  ? <AlertTriangle size={26} className="text-[#D14237]" />
                  : <AlertCircle size={26} className="text-[#5C1F2E]" />}
              </div>
              {confirmState.title && (
                <h3 className="font-lora text-lg font-bold text-[#5C1F2E] mb-1.5">{confirmState.title}</h3>
              )}
              <p className="text-sm font-dm text-[#6B5C5A] leading-relaxed whitespace-pre-line">{confirmState.message}</p>
            </div>
            <div className="flex gap-3 px-7 pb-7">
              <button
                onClick={() => closeConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-dm font-bold text-[#5C1F2E] bg-rose-50 hover:bg-rose-100 transition-colors"
              >
                {confirmState.cancelText || "Cancelar"}
              </button>
              <button
                onClick={() => closeConfirm(true)}
                className={`flex-1 py-3 rounded-xl text-sm font-dm font-bold text-white transition-colors ${confirmState.danger ? "bg-[#D14237] hover:bg-[#b8362c]" : "bg-[#5C1F2E] hover:bg-[#4A1925]"}`}
              >
                {confirmState.confirmText || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
