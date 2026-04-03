"use client";

import { useState, useRef, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase-client";
import type {
  FDCMode,
  FDCInputType,
  FDCResult,
  FDCApiResponse,
  MenuCoachResult,
  SpesaHealthyResult,
} from "@/lib/types";
import { ULCredits } from "@/lib/credits";

/* ────────────────────────────────────────────── */
/*  Constants                                     */
/* ────────────────────────────────────────────── */

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4 MB

const MODES: { key: FDCMode; label: string; icon: string; desc: string }[] = [
  {
    key: "menu-coach",
    label: "Menu Coach",
    icon: "🍽️",
    desc: "Scegli il piatto giusto al ristorante in pochi secondi",
  },
  {
    key: "spesa-healthy",
    label: "Spesa Healthy",
    icon: "🛒",
    desc: "Confronta prodotti al supermercato e scegli il migliore",
  },
];

const SUGGESTION_COLORS: Record<string, string> = {
  Proteica: "from-orange-500/20 to-orange-600/5 border-orange-500/30",
  Leggera: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30",
  Equilibrata: "from-blue-500/20 to-blue-600/5 border-blue-500/30",
};

const SUGGESTION_ICONS: Record<string, string> = {
  Proteica: "💪",
  Leggera: "🥬",
  Equilibrata: "⚖️",
};

/* ────────────────────────────────────────────── */
/*  Page Component                                */
/* ────────────────────────────────────────────── */

export default function FoodDecisionCoachPage() {
  const [mode, setMode] = useState<FDCMode | null>(null);
  const [inputType, setInputType] = useState<FDCInputType>("text");
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FDCResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [creditsInfo, setCreditsInfo] = useState<{ used: number; balance: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* Handlers */
  const handleImageChange = useCallback((file: File | null) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) {
      setError("Immagine troppo grande. Massimo 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file?.type.startsWith("image/")) handleImageChange(file);
    },
    [handleImageChange]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setErrorCode(null);
    setText("");
    setImagePreview(null);
    setImageBase64(null);
    setCreditsInfo(null);
  }, []);

  const analyze = useCallback(async () => {
    if (!mode) return;
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setResult(null);

    try {
      const sb = supabaseBrowser();
      const { data: sessionData } = await sb.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (!token) {
        setError("Devi effettuare il login per usare questo tool.");
        setErrorCode(401);
        setLoading(false);
        return;
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode,
          inputType,
          text: inputType === "text" ? text : undefined,
          imageBase64: inputType === "image" ? imageBase64 : undefined,
        }),
      });

      const data: FDCApiResponse = await res.json();

      if (!data.ok) {
        setErrorCode(res.status);
        setError(data.error || "Errore durante l'analisi.");
        return;
      }

      setResult(data.result!);
      if (data.creditsUsed != null && data.balanceAfter != null) {
        setCreditsInfo({ used: data.creditsUsed, balance: data.balanceAfter });
      }
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  }, [mode, inputType, text, imageBase64]);

  const canSubmit =
    mode &&
    !loading &&
    ((inputType === "text" && text.trim().length >= 5) ||
      (inputType === "image" && imageBase64));

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Ambient gradients */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-orange-600/8 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-600/8 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-20 border-b border-white/5">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-6 py-4">
          <a
            href={ULCredits.pricingUrl().replace("/pricing?from=food-decision-coach", "")}
            className="text-white/40 text-sm hover:text-white/60 transition-colors"
          >
            &larr; UtilityLab
          </a>
          <div className="flex items-center gap-2">
            <span className="text-lg">🍽️</span>
            <span className="font-semibold text-sm">Food Decision Coach</span>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <main className="relative z-10 px-6 py-10">
        <div className="mx-auto max-w-2xl space-y-8">
          {/* Hero */}
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
                Food Decision Coach
              </span>
            </h1>
            <p className="text-white/50 text-base max-w-md mx-auto">
              Ti aiuta a scegliere cosa mangiare in pochi secondi, senza pensarci troppo.
            </p>
          </div>

          {/* Step 1: Mode selector */}
          <section className="space-y-3">
            <h2 className="text-xs uppercase tracking-wider text-white/30 font-medium">
              1. Dove sei?
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => {
                    setMode(m.key);
                    reset();
                  }}
                  className={`rounded-2xl border p-5 text-left transition-all duration-200 ${
                    mode === m.key
                      ? "border-white/20 bg-white/[0.06]"
                      : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="text-2xl">{m.icon}</span>
                  <div className="mt-2 font-semibold text-sm">{m.label}</div>
                  <div className="mt-1 text-xs text-white/40 leading-relaxed">{m.desc}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Step 2: Input */}
          {mode && !result && (
            <section className="space-y-3 animate-fade-in-up">
              <h2 className="text-xs uppercase tracking-wider text-white/30 font-medium">
                2. {mode === "menu-coach" ? "Carica il menu" : "Carica i prodotti"}
              </h2>

              {/* Input type toggle */}
              <div className="flex gap-2">
                {(["text", "image"] as FDCInputType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setInputType(t);
                      setError(null);
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                      inputType === t
                        ? "bg-white/10 text-white"
                        : "text-white/40 hover:text-white/60 hover:bg-white/5"
                    }`}
                  >
                    {t === "text" ? "📝 Testo" : "📷 Foto"}
                  </button>
                ))}
              </div>

              {/* Text input */}
              {inputType === "text" && (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    mode === "menu-coach"
                      ? "Incolla qui il menu del ristorante...\n\nEs: Penne all'arrabbiata, Tagliata di manzo con rucola, Insalata Caesar, Carbonara, Salmone grigliato con verdure..."
                      : "Scrivi qui i prodotti da confrontare...\n\nEs: Yogurt greco Fage 0%, Yogurt Müller Bianco, Skyr Arla Naturale"
                  }
                  rows={6}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors resize-none"
                />
              )}

              {/* Image input */}
              {inputType === "image" && (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileRef.current?.click()}
                  className="relative cursor-pointer rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] p-8 text-center hover:border-white/20 hover:bg-white/[0.04] transition-all"
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                  />
                  {imagePreview ? (
                    <div className="space-y-3">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="mx-auto max-h-48 rounded-xl object-contain"
                      />
                      <p className="text-xs text-white/40">Clicca per cambiare foto</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-3xl">📷</div>
                      <p className="text-sm text-white/40">
                        {mode === "menu-coach"
                          ? "Scatta o carica una foto del menu"
                          : "Scatta o carica una foto dei prodotti"}
                      </p>
                      <p className="text-xs text-white/25">
                        Trascina qui o clicca per caricare (max 4 MB)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Submit */}
              <button
                onClick={analyze}
                disabled={!canSubmit}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
                  canSubmit
                    ? "bg-gradient-to-r from-orange-500 to-emerald-500 text-white hover:opacity-90"
                    : "bg-white/5 text-white/20 cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Analizzo...
                  </span>
                ) : (
                  "Analizza"
                )}
              </button>
            </section>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400 animate-fade-in-up">
              {error}
              {errorCode === 402 && (
                <a
                  href={ULCredits.pricingUrl()}
                  className="block mt-2 underline text-red-300 hover:text-white transition-colors"
                >
                  Acquista crediti &rarr;
                </a>
              )}
              {errorCode === 401 && (
                <a
                  href={ULCredits.loginUrl()}
                  className="block mt-2 underline text-red-300 hover:text-white transition-colors"
                >
                  Accedi &rarr;
                </a>
              )}
            </div>
          )}

          {/* Results */}
          {result && (
            <ResultView result={result} creditsInfo={creditsInfo} onReset={reset} />
          )}

          {/* Disclaimer */}
          <p className="text-[10px] text-white/20 text-center leading-relaxed max-w-md mx-auto">
            Food Decision Coach è un assistente decisionale, non un sostituto del parere medico o
            nutrizionale professionale. Le indicazioni sono orientative e basate su logiche generali.
          </p>
        </div>
      </main>
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  Result View                                    */
/* ────────────────────────────────────────────── */

function ResultView({
  result,
  creditsInfo,
  onReset,
}: {
  result: FDCResult;
  creditsInfo: { used: number; balance: number } | null;
  onReset: () => void;
}) {
  if (result.mode === "menu-coach")
    return <MenuCoachView result={result} creditsInfo={creditsInfo} onReset={onReset} />;
  return <SpesaHealthyView result={result} creditsInfo={creditsInfo} onReset={onReset} />;
}

/* ── Menu Coach Result ── */
function MenuCoachView({
  result,
  creditsInfo,
  onReset,
}: {
  result: MenuCoachResult;
  creditsInfo: { used: number; balance: number } | null;
  onReset: () => void;
}) {
  return (
    <section className="space-y-4 animate-fade-in-up">
      <h2 className="text-xs uppercase tracking-wider text-white/30 font-medium">
        Il tuo consiglio
      </h2>

      {/* Summary */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p className="text-sm text-white/70 leading-relaxed">{result.summary}</p>
      </div>

      {/* Suggestions */}
      {result.suggestions.length > 0 ? (
        <div className="space-y-3">
          {result.suggestions.map((s, i) => (
            <div
              key={i}
              className={`rounded-2xl border bg-gradient-to-br p-5 ${
                SUGGESTION_COLORS[s.label] || "from-white/5 to-white/[0.02] border-white/10"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{SUGGESTION_ICONS[s.label] || "🍽️"}</span>
                <span className="text-xs uppercase tracking-wider font-bold text-white/60">
                  {s.label}
                </span>
              </div>
              <div className="font-semibold text-base">{s.dish}</div>
              <div className="mt-1 text-sm text-white/50 leading-relaxed">{s.reason}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
          Non è stato possibile analizzare il menu. Prova con un&apos;immagine più chiara o incolla
          il testo.
        </div>
      )}

      {/* Warning */}
      {result.warning && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span>⚠️</span>
            <span className="text-xs uppercase tracking-wider font-bold text-amber-400">
              Attenzione
            </span>
          </div>
          <p className="text-sm text-amber-300/80 leading-relaxed">{result.warning}</p>
        </div>
      )}

      <ResultFooter creditsInfo={creditsInfo} onReset={onReset} />
    </section>
  );
}

/* ── Spesa Healthy Result ── */
function SpesaHealthyView({
  result,
  creditsInfo,
  onReset,
}: {
  result: SpesaHealthyResult;
  creditsInfo: { used: number; balance: number } | null;
  onReset: () => void;
}) {
  return (
    <section className="space-y-4 animate-fade-in-up">
      <h2 className="text-xs uppercase tracking-wider text-white/30 font-medium">
        Il tuo consiglio
      </h2>

      {/* Summary */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p className="text-sm text-white/70 leading-relaxed">{result.summary}</p>
      </div>

      {/* Best choice */}
      {result.bestChoice.product && (
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">✅</span>
            <span className="text-xs uppercase tracking-wider font-bold text-emerald-400">
              Scelta migliore
            </span>
          </div>
          <div className="font-semibold text-base">{result.bestChoice.product}</div>
          <div className="mt-1 text-sm text-white/50 leading-relaxed">
            {result.bestChoice.reason}
          </div>
        </div>
      )}

      {/* Alternative */}
      {result.alternative.product && (
        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🔄</span>
            <span className="text-xs uppercase tracking-wider font-bold text-blue-400">
              Alternativa
            </span>
          </div>
          <div className="font-semibold text-base">{result.alternative.product}</div>
          <div className="mt-1 text-sm text-white/50 leading-relaxed">
            {result.alternative.reason}
          </div>
        </div>
      )}

      {/* Warning */}
      {result.warning && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span>⚠️</span>
            <span className="text-xs uppercase tracking-wider font-bold text-amber-400">
              Da notare
            </span>
          </div>
          <p className="text-sm text-amber-300/80 leading-relaxed">{result.warning}</p>
        </div>
      )}

      <ResultFooter creditsInfo={creditsInfo} onReset={onReset} />
    </section>
  );
}

/* ── Footer ── */
function ResultFooter({
  creditsInfo,
  onReset,
}: {
  creditsInfo: { used: number; balance: number } | null;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <button
        onClick={onReset}
        className="px-5 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 hover:text-white/70 transition-all"
      >
        Nuova analisi
      </button>
      {creditsInfo && (
        <span className="text-xs text-white/25">
          {creditsInfo.used} credito usato · {creditsInfo.balance} rimasti
        </span>
      )}
    </div>
  );
}
