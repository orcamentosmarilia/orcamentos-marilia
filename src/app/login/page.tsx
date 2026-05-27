"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password: password.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.user) {
        setError(data.error || "E-mail ou senha incorretos.");
        setLoading(false);
        return;
      }

      // Store simple session
      localStorage.setItem("marilia_admin_session", JSON.stringify({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        timestamp: new Date().getTime()
      }));

      router.push("/orcamentos/dashboard");
    } catch (err) {
      setError("Erro ao realizar login. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden font-body bg-brand-wine">
      {/* Decorative Elements */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(209,66,55,0.08) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-brand-red opacity-[0.03] blur-3xl"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-brand-red opacity-[0.03] blur-3xl"></div>
      
      {/* Visual Polish: Abstract Background */}
      <div className="fixed top-0 left-0 w-full h-full -z-10 opacity-10">
        <img 
          alt="Atmosphere" 
          className="w-full h-full object-cover grayscale contrast-125 mix-blend-overlay" 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwXVUmhhMntp94YdIW7nBpAVKgHI72d955_uNxQA2pkk74LP9f0zSo4F9jHmoshTkHVQIpMTVFK7E32g60hdePNxDy5g0-_2cdRThF5gNHw3GMo09FVh5iJYETLz_795ruNWWCQvck0hJYRdhXYFZmgLDs-04A3ZQ-Mvw8alz_950HyeTORIoNbKDRM9KmihpmY3Ph7QvmgGnCOUhJafdrEExw8tSsBePJ8qDX-xmSgMReGSh_UsupzJQeSDKxECp8nESqvZj7UQ"
        />
      </div>

      {/* Login Container */}
      <main className="relative z-10 w-full max-w-[400px] mx-4">
        <div className="bg-surface-container-lowest rounded-brand-card p-[48px] shadow-2xl shadow-black/20 flex flex-col items-center">
          
          {/* Logo Header */}
          <header className="flex flex-col items-center mb-10">
            <img 
              src="/logo.png" 
              alt="Marília de Dirceu" 
              className="h-24 w-auto object-contain"
            />
          </header>

          {/* Login Form */}
          <form className="w-full space-y-6" onSubmit={handleSubmit}>
            {/* E-mail Input */}
            <div className="space-y-2">
              <label 
                className="block font-architect font-semibold text-[0.75rem] text-brand-wine tracking-wider uppercase" 
                htmlFor="email"
              >
                E-mail
              </label>
              <div className="relative">
                <input 
                  className="w-full h-12 px-4 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-brand-red/50 text-on-surface font-architect placeholder-brand-placeholder" 
                  id="email" 
                  name="email" 
                  placeholder="seu@email.com" 
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label 
                  className="block font-architect font-semibold text-[0.75rem] text-brand-wine tracking-wider uppercase" 
                  htmlFor="password"
                >
                  Senha
                </label>
              </div>
              <div className="relative">
                <input 
                  className="w-full h-12 px-4 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-brand-red/50 text-on-surface font-architect placeholder-brand-placeholder" 
                  id="password" 
                  name="password" 
                  placeholder="••••••••" 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-xs flex items-center gap-2 border border-red-100 animate-shake">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {/* Action Button */}
            <button 
              className="w-full h-[48px] bg-gradient-to-br from-brand-red to-[#E8635A] text-white font-architect font-bold rounded-[10px] hover:opacity-95 transition-all shadow-md shadow-brand-red/20 active:scale-[0.98] flex items-center justify-center gap-2" 
              type="submit"
              disabled={loading}
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Autenticando..." : "Entrar"}
            </button>

            {/* Footer Links */}
            <div className="flex justify-center pt-4">
              <Link 
                className="font-architect font-medium text-sm text-brand-red hover:underline decoration-brand-red/30 underline-offset-4" 
                href="#"
              >
                Esqueci minha senha
              </Link>
            </div>
          </form>
        </div>

        {/* Secondary Decoration */}
        <div className="mt-8 flex justify-center space-x-6 opacity-40">
          <div className="flex items-center space-x-2 text-rose-200/60">
            <span className="text-[10px] font-architect uppercase tracking-widest">Acesso Seguro</span>
          </div>
          <div className="flex items-center space-x-2 text-rose-200/60">
            <span className="text-[10px] font-architect uppercase tracking-widest">V. 2.4.0</span>
          </div>
        </div>
      </main>
    </div>
  );
}
