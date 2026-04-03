"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase-client";
import type {
  FDCMode,
  FDCInputType,
  FDCGoal,
  FDCResult,
  FDCApiResponse,
  FDCHistoryEntry,
  MenuCoachResult,
  SpesaHealthyResult,
} from "@/lib/types";
import { ULCredits } from "@/lib/credits";

/* ────────────────────────────────────────────── */
/*  Unsplash images                               */
/* ────────────────────────────────────────────── */

const IMG = {
  hero: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80&auto=format",
  menuCoach: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80&auto=format",
  spesaHealthy: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80&auto=format",
  proteica: "https://images.unsplash.com/photo-1432139509613-5c4255a78e03?w=400&q=80&auto=format",
  leggera: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=80&auto=format",
  equilibrata: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&q=80&auto=format",
  bestChoice: "https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=400&q=80&auto=format",
  alternative: "https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=400&q=80&auto=format",
  camera: "https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=400&q=80&auto=format",
};

/* ────────────────────────────────────────────── */
/*  Constants                                     */
/* ────────────────────────────────────────────── */

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const COMPRESS_MAX_WIDTH = 1200;
const COMPRESS_QUALITY = 0.7;
const HISTORY_KEY = "fdc_history";
const MAX_HISTORY = 5;

const MODES: { key: FDCMode; label: string; desc: string; img: string }[] = [
  { key: "menu-coach", label: "Menu Coach", desc: "Scegli il piatto giusto al ristorante in pochi secondi", img: IMG.menuCoach },
  { key: "spesa-healthy", label: "Spesa Healthy", desc: "Confronta prodotti al supermercato e scegli il migliore", img: IMG.spesaHealthy },
];

const GOALS: { key: FDCGoal; label: string; desc: string; icon: string }[] = [
  { key: "dimagrire", label: "Dimagrire", desc: "Meno calorie, più proteine", icon: "↓" },
  { key: "energia", label: "Più energia", desc: "Carboidrati buoni, vitalità", icon: "⚡" },
  { key: "equilibrio", label: "Equilibrio", desc: "Mangiare meglio in generale", icon: "=" },
];

const SUGGESTION_STYLE: Record<string, { gradient: string; img: string }> = {
  Proteica: { gradient: "from-orange-500/20 to-orange-600/5 border-orange-500/30", img: IMG.proteica },
  Leggera: { gradient: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30", img: IMG.leggera },
  Equilibrata: { gradient: "from-blue-500/20 to-blue-600/5 border-blue-500/30", img: IMG.equilibrata },
};

/* ────────────────────────────────────────────── */
/*  Image compression                             */
/* ────────────────────────────────────────────── */

function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > COMPRESS_MAX_WIDTH) {
        height = Math.round((height * COMPRESS_MAX_WIDTH) / width);
        width = COMPRESS_MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", COMPRESS_QUALITY));
    };
    img.src = dataUrl;
  });
}

/* ────────────────────────────────────────────── */
/*  History helpers                               */
/* ────────────────────────────────────────────── */

function loadHistory(): FDCHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToHistory(entry: FDCHistoryEntry) {
  const history = loadHistory();
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

/* ────────────────────────────────────────────── */
/*  Page Component                                */
/* ────────────────────────────────────────────── */

export default function FoodDecisionCoachPage() {
  const [mode, setMode] = useState<FDCMode | null>(null);
  const [goal, setGoal] = useState<FDCGoal>(null);
  const [inputType, setInputType] = useState<FDCInputType>("text");
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FDCResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [creditsInfo, setCreditsInfo] = useState<{ used: number; balance: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<FDCHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleImageChange = useCallback(async (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) {
      setError("Immagine troppo grande. Massimo 4 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      // Compress before storing
      const compressed = await compressImage(dataUrl);
      setImageBase64(compressed);
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
    setCopied(false);
    setShowHistory(false);
  }, []);

  const copyResult = useCallback(() => {
    if (!result) return;
    let txt = "";
    if (result.mode === "menu-coach") {
      txt = `Food Decision Coach — Menu Coach\n\n${result.summary}\n\n`;
      result.suggestions.forEach((s) => { txt += `${s.label}: ${s.dish}\n${s.reason}\n\n`; });
      if (result.warning) txt += `Attenzione: ${result.warning}\n`;
    } else {
      txt = `Food Decision Coach — Spesa Healthy\n\n${result.summary}\n\n`;
      txt += `Scelta migliore: ${result.bestChoice.product}\n${result.bestChoice.reason}\n\n`;
      txt += `Alternativa: ${result.alternative.product}\n${result.alternative.reason}\n`;
      if (result.warning) txt += `\nDa notare: ${result.warning}\n`;
    }
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const loadFromHistory = useCallback((entry: FDCHistoryEntry) => {
    setResult(entry.result);
    setMode(entry.mode);
    setGoal(entry.goal);
    setShowHistory(false);
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
          goal,
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

      // Save to history
      const inputPreview = inputType === "text"
        ? (text || "").slice(0, 80)
        : "Foto analizzata";
      const entry: FDCHistoryEntry = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        date: new Date().toISOString(),
        mode,
        goal,
        inputPreview,
        result: data.result!,
      };
      saveToHistory(entry);
      setHistory(loadHistory());
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  }, [mode, inputType, goal, text, imageBase64]);

  const canSubmit =
    mode &&
    !loading &&
    ((inputType === "text" && text.trim().length >= 5) ||
      (inputType === "image" && imageBase64));

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
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden">
              <img src={IMG.hero} alt="" className="w-full h-full object-cover" />
            </div>
            <span className="font-semibold text-sm">Food Decision Coach</span>
          </div>
          {/* History button */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`text-sm transition-colors ${
              history.length > 0
                ? "text-white/40 hover:text-white/60"
                : "text-white/15 cursor-default"
            }`}
            disabled={history.length === 0}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="relative z-10 px-6 py-10">
        <div className="mx-auto max-w-2xl space-y-8">

          {/* History panel */}
          {showHistory && history.length > 0 && (
            <section className="space-y-3 animate-fade-in-up">
              <div className="flex items-center justify-between">
                <h2 className="text-xs uppercase tracking-wider text-white/30 font-medium">Ultime analisi</h2>
                <button onClick={() => setShowHistory(false)} className="text-xs text-white/30 hover:text-white/50">Chiudi</button>
              </div>
              <div className="space-y-2">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => loadFromHistory(h)}
                    className="w-full rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left hover:border-white/15 hover:bg-white/[0.04] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-white/30">
                          {h.mode === "menu-coach" ? "Menu" : "Spesa"}
                        </span>
                        {h.goal && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30">
                            {h.goal}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-white/20">
                        {new Date(h.date).toLocaleDateString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-white/50 mt-1 truncate">{h.inputPreview}</p>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Hero */}
          {!showHistory && (
            <>
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-2xl overflow-hidden ring-1 ring-white/10">
                  <img src={IMG.hero} alt="Food Decision Coach" className="w-full h-full object-cover" />
                </div>
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
                      onClick={() => { setMode(m.key); reset(); }}
                      className={`group relative rounded-2xl border overflow-hidden text-left transition-all duration-300 ${
                        mode === m.key
                          ? "border-white/20 ring-1 ring-white/10"
                          : "border-white/5 hover:border-white/15"
                      }`}
                    >
                      <div className="absolute inset-0">
                        <img src={m.img} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        <div className={`absolute inset-0 ${mode === m.key ? "bg-gradient-to-t from-black/90 via-black/70 to-black/40" : "bg-gradient-to-t from-black/90 via-black/75 to-black/50"}`} />
                      </div>
                      <div className="relative p-5 pt-12">
                        <div className="font-semibold text-sm">{m.label}</div>
                        <div className="mt-1 text-xs text-white/50 leading-relaxed">{m.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Step 1b: Goal selector */}
              {mode && !result && !loading && (
                <section className="space-y-3 animate-fade-in-up">
                  <h2 className="text-xs uppercase tracking-wider text-white/30 font-medium">
                    Il tuo obiettivo <span className="text-white/15">(opzionale)</span>
                  </h2>
                  <div className="grid grid-cols-3 gap-2">
                    {GOALS.map((g) => (
                      <button
                        key={g.key}
                        onClick={() => setGoal(goal === g.key ? null : g.key)}
                        className={`rounded-xl border p-3 text-center transition-all duration-200 ${
                          goal === g.key
                            ? "border-white/20 bg-white/[0.06]"
                            : "border-white/5 bg-white/[0.02] hover:border-white/10"
                        }`}
                      >
                        <div className="text-lg leading-none">{g.icon}</div>
                        <div className="text-xs font-medium mt-1.5">{g.label}</div>
                        <div className="text-[10px] text-white/30 mt-0.5 leading-tight">{g.desc}</div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Step 2: Input */}
              {mode && !result && !loading && (
                <section className="space-y-3 animate-fade-in-up">
                  <h2 className="text-xs uppercase tracking-wider text-white/30 font-medium">
                    2. {mode === "menu-coach" ? "Carica il menu" : "Carica i prodotti"}
                  </h2>

                  {/* Input type toggle */}
                  <div className="flex gap-2">
                    {(["text", "image"] as FDCInputType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => { setInputType(t); setError(null); }}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                          inputType === t ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60 hover:bg-white/5"
                        }`}
                      >
                        {t === "text" ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Testo
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Foto
                          </>
                        )}
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
                          : "Scrivi qui i prodotti da confrontare...\n\nEs: Yogurt greco Fage 0%, Yogurt Muller Bianco, Skyr Arla Naturale"
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
                      className="relative cursor-pointer rounded-2xl border-2 border-dashed border-white/10 overflow-hidden hover:border-white/20 transition-all"
                    >
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleImageChange(e.target.files?.[0] || null)}
                      />
                      {imagePreview ? (
                        <div className="p-4 space-y-3">
                          <img src={imagePreview} alt="Preview" className="mx-auto max-h-48 rounded-xl object-contain" />
                          <p className="text-xs text-white/40 text-center">Clicca per cambiare foto</p>
                        </div>
                      ) : (
                        <div className="relative">
                          <img src={IMG.camera} alt="" className="w-full h-36 object-cover opacity-20" />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/80 to-transparent" />
                          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2">
                            <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-sm text-white/40">
                              {mode === "menu-coach" ? "Scatta o carica una foto del menu" : "Scatta o carica una foto dei prodotti"}
                            </p>
                            <p className="text-xs text-white/25">Trascina qui o clicca (max 4 MB)</p>
                          </div>
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
                        ? "bg-gradient-to-r from-orange-500 to-emerald-500 text-white hover:opacity-90 active:scale-[0.98]"
                        : "bg-white/5 text-white/20 cursor-not-allowed"
                    }`}
                  >
                    Analizza
                  </button>
                </section>
              )}

              {/* Loading skeleton */}
              {loading && (
                <section className="space-y-3 animate-fade-in-up">
                  <h2 className="text-xs uppercase tracking-wider text-white/30 font-medium">Analizzo...</h2>
                  <div className="skeleton h-20 w-full" />
                  <div className="skeleton h-28 w-full" />
                  <div className="skeleton h-28 w-full" />
                  <div className="skeleton h-28 w-full" />
                  <div className="flex items-center justify-center gap-2 pt-2 text-sm text-white/30">
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    {mode === "menu-coach" ? "Leggo il menu..." : "Confronto i prodotti..."}
                  </div>
                </section>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400 animate-fade-in-up">
                  {error}
                  {errorCode === 402 && (
                    <a href={ULCredits.pricingUrl()} className="block mt-2 underline text-red-300 hover:text-white transition-colors">
                      Acquista crediti &rarr;
                    </a>
                  )}
                  {errorCode === 401 && (
                    <a href={ULCredits.loginUrl()} className="block mt-2 underline text-red-300 hover:text-white transition-colors">
                      Accedi &rarr;
                    </a>
                  )}
                </div>
              )}

              {/* Results */}
              {result && (
                <ResultView result={result} creditsInfo={creditsInfo} onReset={reset} onCopy={copyResult} copied={copied} />
              )}
            </>
          )}

          {/* Disclaimer */}
          <p className="text-[10px] text-white/20 text-center leading-relaxed max-w-md mx-auto">
            Food Decision Coach è un assistente decisionale, non un sostituto del parere medico o
            nutrizionale professionale. Le indicazioni sono orientative e basate su logiche generali.
          </p>
        </div>
      </main>

      {/* Copy toast */}
      {copied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-emerald-500/90 text-white text-sm font-medium animate-toast backdrop-blur-sm">
          Risultato copiato!
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────── */
/*  Result View                                    */
/* ────────────────────────────────────────────── */

function ResultView({ result, creditsInfo, onReset, onCopy, copied }: {
  result: FDCResult;
  creditsInfo: { used: number; balance: number } | null;
  onReset: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  if (result.mode === "menu-coach")
    return <MenuCoachView result={result} creditsInfo={creditsInfo} onReset={onReset} onCopy={onCopy} copied={copied} />;
  return <SpesaHealthyView result={result} creditsInfo={creditsInfo} onReset={onReset} onCopy={onCopy} copied={copied} />;
}

/* ── Menu Coach Result ── */
function MenuCoachView({ result, creditsInfo, onReset, onCopy, copied }: {
  result: MenuCoachResult;
  creditsInfo: { used: number; balance: number } | null;
  onReset: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs uppercase tracking-wider text-white/30 font-medium animate-fade-in-up">Il tuo consiglio</h2>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 animate-fade-in-up stagger-1">
        <p className="text-sm text-white/70 leading-relaxed">{result.summary}</p>
      </div>

      {result.suggestions.length > 0 ? (
        <div className="space-y-3">
          {result.suggestions.map((s, i) => {
            const style = SUGGESTION_STYLE[s.label];
            return (
              <div key={i} className={`rounded-2xl border bg-gradient-to-br p-0 overflow-hidden animate-fade-in-up stagger-${i + 2} ${style?.gradient || "from-white/5 to-white/[0.02] border-white/10"}`}>
                <div className="flex">
                  <div className="w-20 min-h-full flex-shrink-0 relative hidden sm:block">
                    <img src={style?.img || IMG.hero} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/60" />
                  </div>
                  <div className="flex-1 p-5">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-white/50">{s.label}</span>
                    <div className="font-semibold text-base mt-1">{s.dish}</div>
                    <div className="mt-1 text-sm text-white/50 leading-relaxed">{s.reason}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300 animate-fade-in-up stagger-2">
          Non è stato possibile analizzare il menu. Prova con un&apos;immagine più chiara o incolla il testo.
        </div>
      )}

      {result.warning && (
        <WarningCard text={result.warning} stagger={Math.min(result.suggestions.length + 2, 4)} />
      )}

      <ResultFooter creditsInfo={creditsInfo} onReset={onReset} onCopy={onCopy} copied={copied} />
    </section>
  );
}

/* ── Spesa Healthy Result ── */
function SpesaHealthyView({ result, creditsInfo, onReset, onCopy, copied }: {
  result: SpesaHealthyResult;
  creditsInfo: { used: number; balance: number } | null;
  onReset: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs uppercase tracking-wider text-white/30 font-medium animate-fade-in-up">Il tuo consiglio</h2>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 animate-fade-in-up stagger-1">
        <p className="text-sm text-white/70 leading-relaxed">{result.summary}</p>
      </div>

      {result.bestChoice.product && (
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 overflow-hidden animate-fade-in-up stagger-2">
          <div className="flex">
            <div className="w-20 min-h-full flex-shrink-0 relative hidden sm:block">
              <img src={IMG.bestChoice} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/60" />
            </div>
            <div className="flex-1 p-5">
              <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400">Scelta migliore</span>
              <div className="font-semibold text-base mt-1">{result.bestChoice.product}</div>
              <div className="mt-1 text-sm text-white/50 leading-relaxed">{result.bestChoice.reason}</div>
            </div>
          </div>
        </div>
      )}

      {result.alternative.product && (
        <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5 overflow-hidden animate-fade-in-up stagger-3">
          <div className="flex">
            <div className="w-20 min-h-full flex-shrink-0 relative hidden sm:block">
              <img src={IMG.alternative} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/60" />
            </div>
            <div className="flex-1 p-5">
              <span className="text-[10px] uppercase tracking-wider font-bold text-blue-400">Alternativa</span>
              <div className="font-semibold text-base mt-1">{result.alternative.product}</div>
              <div className="mt-1 text-sm text-white/50 leading-relaxed">{result.alternative.reason}</div>
            </div>
          </div>
        </div>
      )}

      {result.warning && <WarningCard text={result.warning} stagger={4} />}

      <ResultFooter creditsInfo={creditsInfo} onReset={onReset} onCopy={onCopy} copied={copied} />
    </section>
  );
}

/* ── Shared components ── */
function WarningCard({ text, stagger }: { text: string; stagger: number }) {
  return (
    <div className={`rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 animate-fade-in-up stagger-${stagger}`}>
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span className="text-xs uppercase tracking-wider font-bold text-amber-400">Attenzione</span>
      </div>
      <p className="text-sm text-amber-300/80 leading-relaxed">{text}</p>
    </div>
  );
}

function ResultFooter({ creditsInfo, onReset, onCopy, copied }: {
  creditsInfo: { used: number; balance: number } | null;
  onReset: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-2 animate-fade-in-up stagger-4">
      <div className="flex items-center gap-2">
        <button onClick={onReset} className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 hover:text-white/70 transition-all">
          Nuova analisi
        </button>
        <button onClick={onCopy} className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 text-sm hover:bg-white/5 hover:text-white/70 transition-all flex items-center gap-1.5">
          {copied ? (
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
          Copia
        </button>
      </div>
      {creditsInfo && (
        <span className="text-xs text-white/25">{creditsInfo.used} credito usato · {creditsInfo.balance} rimasti</span>
      )}
    </div>
  );
}
