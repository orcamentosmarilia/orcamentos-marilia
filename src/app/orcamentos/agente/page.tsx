"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, Bot, User, RotateCcw } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME_MESSAGE: Message = {
  role: "assistant",
  content: `Olá! Sou o assistente de orçamentos da Pastelaria Marília de Dirceu. 🧁

Vou te ajudar a montar um orçamento completo. Para começar, me diga:

**Qual é o nome do cliente e a data do evento?**`,
};

export default function AgentePage() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const newUserMessage: Message = { role: "user", content: text };
    const updatedMessages = [...messages, newUserMessage];

    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError(null);

    const assistantPlaceholder: Message = { role: "assistant", content: "" };
    setMessages([...updatedMessages, assistantPlaceholder]);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao contatar o agente.");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Sem resposta do servidor.");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulated += chunk;

        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: accumulated };
          return next;
        });
      }

      if (!accumulated) {
        setMessages((prev) => prev.slice(0, -1));
      }
    } catch (err: any) {
      setError(err.message);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleReset = () => {
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setError(null);
    setSavedQuoteId(null);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--color-brand-cream)]">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-[var(--color-brand-pink2)] shadow-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href="/orcamentos"
            className="text-[var(--color-brand-wine)] bg-[var(--color-brand-pink)] p-2.5 rounded-full hover:bg-[var(--color-brand-pink2)] transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-brand-wine)] flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-lora font-bold text-lg text-[var(--color-brand-wine)] leading-tight">
                Agente de Orçamentos
              </h1>
              <p className="text-[11px] text-rose-400 font-dm">Pastelaria Marília de Dirceu</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleReset}
          title="Nova conversa"
          className="flex items-center gap-2 text-xs font-medium text-rose-400 hover:text-[var(--color-brand-wine)] transition-colors px-3 py-2 rounded-xl hover:bg-[var(--color-brand-pink)]"
        >
          <RotateCcw size={14} />
          <span className="hidden sm:inline">Nova conversa</span>
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
        <div className="max-w-3xl mx-auto w-full flex flex-col gap-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${
                  msg.role === "assistant"
                    ? "bg-[var(--color-brand-wine)]"
                    : "bg-[var(--color-brand-red)]"
                }`}
              >
                {msg.role === "assistant" ? (
                  <Bot size={16} className="text-white" />
                ) : (
                  <User size={16} className="text-white" />
                )}
              </div>

              {/* Bubble */}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed font-dm ${
                  msg.role === "user"
                    ? "bg-[var(--color-brand-wine)] text-white rounded-tr-sm"
                    : "bg-white border border-[var(--color-brand-pink2)] text-[#3D1320] rounded-tl-sm shadow-sm"
                }`}
              >
                {msg.content === "" && msg.role === "assistant" ? (
                  <span className="flex items-center gap-2 text-rose-400">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs">Pensando...</span>
                  </span>
                ) : (
                  <MessageContent content={msg.content} />
                )}
              </div>
            </div>
          ))}

          {/* Quote saved banner */}
          {savedQuoteId && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between gap-4">
              <p className="text-sm text-green-700 font-medium">
                ✅ Orçamento salvo no sistema!
              </p>
              <Link
                href={`/orcamentos/${savedQuoteId}/revisao`}
                className="text-sm font-bold text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-xl transition-colors flex-shrink-0"
              >
                Revisar orçamento →
              </Link>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 bg-white border-t border-[var(--color-brand-pink2)] px-4 py-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
            placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
            className="flex-1 resize-none border border-[var(--color-brand-pink2)] rounded-2xl px-4 py-3 text-sm font-dm focus:outline-none focus:border-[var(--color-brand-red)] focus:ring-2 focus:ring-[var(--color-brand-red)]/10 disabled:opacity-50 max-h-40 leading-relaxed"
            style={{ minHeight: "48px" }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 160) + "px";
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-12 h-12 rounded-2xl bg-[var(--color-brand-wine)] hover:bg-[#4A1926] disabled:opacity-50 text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>
        <p className="text-center text-[10px] text-rose-300 mt-2 font-dm">
          O agente consulta o catálogo e calculates automaticamente as quantidades.
        </p>
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  // Basic markdown-like rendering: **bold**, bullet lists, code blocks
  const lines = content.split("\n");

  return (
    <div className="space-y-1.5 whitespace-pre-wrap">
      {lines.map((line, i) => {
        if (line.startsWith("```")) return null;

        // Bold
        const rendered = line.replace(/\*\*(.+?)\*\*/g, (_, t) => `<strong>${t}</strong>`);

        return (
          <p
            key={i}
            className="leading-relaxed font-mono text-xs"
            style={{ fontFamily: line.match(/^[═─]/) ? "monospace" : undefined }}
            dangerouslySetInnerHTML={{ __html: rendered || "&nbsp;" }}
          />
        );
      })}
    </div>
  );
}
