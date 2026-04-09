"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginWithGoogle = async () => {
    const sb = supabaseBrowser();
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?redirect=/`,
      },
    });
  };

  const loginWithEmail = async () => {
    if (!email || !email.includes("@")) {
      setError("Inserisci un'email valida.");
      return;
    }
    setLoading(true);
    setError(null);
    const sb = supabaseBrowser();
    const { error: err } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?redirect=/`,
      },
    });
    setLoading(false);
    if (err) {
      setError("Errore nell'invio. Riprova.");
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-6">
      {/* Ambient gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-orange-600/8 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-600/8 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl overflow-hidden ring-1 ring-white/10">
            <img
              src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80&auto=format"
              alt="Food Decision Coach"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-xl font-bold">
            <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
              Food Decision Coach
            </span>
          </h1>
          <p className="text-sm text-white/40">Accedi per analizzare menu e prodotti</p>
        </div>

        {/* Google login */}
        <button
          onClick={loginWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-white text-[#0a0a0f] font-semibold text-sm hover:bg-white/90 transition-all active:scale-[0.98]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Accedi con Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-white/25 uppercase tracking-wider">oppure</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Email magic link */}
        {sent ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center">
            <p className="text-sm text-emerald-400 font-medium">Link inviato!</p>
            <p className="text-xs text-white/40 mt-2">Controlla la tua email e clicca sul link per accedere.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loginWithEmail()}
              placeholder="nome@email.it"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm placeholder:text-white/25 focus:outline-none focus:border-white/20 transition-colors"
            />
            <button
              onClick={loginWithEmail}
              disabled={loading}
              className="w-full py-3 rounded-xl border border-white/10 text-white/60 text-sm font-medium hover:bg-white/5 hover:text-white/80 transition-all disabled:opacity-50"
            >
              {loading ? "Invio..." : "Invia magic link"}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        {/* Back */}
        <div className="text-center">
          <a href="/" className="text-xs text-white/25 hover:text-white/40 transition-colors">
            &larr; Torna a Food Decision Coach
          </a>
        </div>
      </div>
    </div>
  );
}
