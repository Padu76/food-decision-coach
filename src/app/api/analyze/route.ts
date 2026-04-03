import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ULCredits } from "@/lib/credits";
import { getSystemPrompt, getUserPrompt } from "@/lib/prompts";
import type { FDCAnalyzeRequest, FDCResult, FDCApiResponse } from "@/lib/types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

/* ── Rate limiter semplice in-memory ── */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, max = 15): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

// Pulizia periodica
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 300_000);

/* ── Verifica utente dal JWT ── */
async function verifyUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  return { user_id: user.id, token };
}

/* ── POST /api/analyze ── */
export async function POST(req: NextRequest) {
  /* 1. Auth */
  const auth = await verifyUser(req);
  if (!auth) {
    return NextResponse.json<FDCApiResponse>(
      { ok: false, error: "Non autenticato. Effettua il login su UtilityLab." },
      { status: 401 }
    );
  }

  /* 2. Rate limit */
  if (!checkRateLimit(auth.user_id)) {
    return NextResponse.json<FDCApiResponse>(
      { ok: false, error: "Troppe richieste. Riprova tra un minuto." },
      { status: 429 }
    );
  }

  /* 3. Parse body */
  let body: FDCAnalyzeRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<FDCApiResponse>(
      { ok: false, error: "Richiesta non valida." },
      { status: 400 }
    );
  }

  const { mode, inputType, text, imageBase64 } = body;

  if (!mode || !["menu-coach", "spesa-healthy"].includes(mode)) {
    return NextResponse.json<FDCApiResponse>(
      { ok: false, error: "Modalità non valida." },
      { status: 400 }
    );
  }

  if (inputType === "text" && (!text || text.trim().length < 5)) {
    return NextResponse.json<FDCApiResponse>(
      { ok: false, error: "Inserisci almeno qualche parola." },
      { status: 400 }
    );
  }

  if (inputType === "image" && !imageBase64) {
    return NextResponse.json<FDCApiResponse>(
      { ok: false, error: "Immagine mancante." },
      { status: 400 }
    );
  }

  /* 4. Deduct credits via UtilityLab Hub */
  const creditResult = await ULCredits.deduct(auth.token, mode, { mode, inputType });

  if (!creditResult.ok) {
    if (creditResult.code === "INSUFFICIENT_CREDITS") {
      return NextResponse.json<FDCApiResponse>(
        { ok: false, error: "Crediti insufficienti. Acquista crediti per continuare." },
        { status: 402 }
      );
    }
    return NextResponse.json<FDCApiResponse>(
      { ok: false, error: "Errore nel sistema crediti." },
      { status: 500 }
    );
  }

  /* 5. Build OpenAI messages */
  const systemPrompt = getSystemPrompt(mode);
  const userText = getUserPrompt(mode, inputType === "text" ? text : undefined);

  type OAIContent =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: string } };

  const userContent: OAIContent[] = [{ type: "text", text: userText }];

  if (inputType === "image" && imageBase64) {
    userContent.push({
      type: "image_url",
      image_url: { url: imageBase64, detail: "high" },
    });
  }

  /* 6. Call OpenAI */
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    console.error("Missing OPENAI_API_KEY");
    if (creditResult.transaction_id) {
      await ULCredits.refund(auth.token, creditResult.transaction_id);
    }
    return NextResponse.json<FDCApiResponse>(
      { ok: false, error: "Configurazione server incompleta." },
      { status: 500 }
    );
  }

  let aiResult: FDCResult;
  try {
    const openaiRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.4,
        max_tokens: 800,
      }),
    });

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text();
      console.error("OpenAI error:", openaiRes.status, errBody);
      if (creditResult.transaction_id) {
        await ULCredits.refund(auth.token, creditResult.transaction_id);
      }
      return NextResponse.json<FDCApiResponse>(
        { ok: false, error: "Errore nell'analisi AI. Riprova." },
        { status: 502 }
      );
    }

    const openaiData = await openaiRes.json();
    const rawContent = openaiData.choices?.[0]?.message?.content?.trim();

    if (!rawContent) {
      if (creditResult.transaction_id) {
        await ULCredits.refund(auth.token, creditResult.transaction_id);
      }
      return NextResponse.json<FDCApiResponse>(
        { ok: false, error: "Risposta AI vuota. Riprova." },
        { status: 502 }
      );
    }

    // Parse JSON – strip possible markdown fencing
    const cleaned = rawContent.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    aiResult = JSON.parse(cleaned) as FDCResult;
  } catch (err) {
    console.error("FDC AI parse error:", err);
    if (creditResult.transaction_id) {
      await ULCredits.refund(auth.token, creditResult.transaction_id);
    }
    return NextResponse.json<FDCApiResponse>(
      { ok: false, error: "Errore nell'elaborazione. Riprova con un'immagine più chiara." },
      { status: 502 }
    );
  }

  /* 7. Return result */
  return NextResponse.json<FDCApiResponse>({
    ok: true,
    result: aiResult,
    creditsUsed: creditResult.cost ?? 1,
    balanceAfter: creditResult.balance,
  });
}
