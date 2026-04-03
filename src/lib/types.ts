export type FDCMode = "menu-coach" | "spesa-healthy";
export type FDCInputType = "text" | "image";
export type FDCGoal = "dimagrire" | "energia" | "equilibrio" | null;

/* ── Request ── */
export interface FDCAnalyzeRequest {
  mode: FDCMode;
  inputType: FDCInputType;
  goal?: FDCGoal;
  text?: string;
  imageBase64?: string;
}

/* ── Menu Coach response ── */
export interface MenuCoachSuggestion {
  label: string;
  dish: string;
  reason: string;
}

export interface MenuCoachResult {
  mode: "menu-coach";
  suggestions: MenuCoachSuggestion[];
  warning?: string;
  summary: string;
}

/* ── Spesa Healthy response ── */
export interface SpesaHealthyResult {
  mode: "spesa-healthy";
  bestChoice: {
    product: string;
    reason: string;
  };
  alternative: {
    product: string;
    reason: string;
  };
  warning?: string;
  summary: string;
}

export type FDCResult = MenuCoachResult | SpesaHealthyResult;

/* ── History entry (localStorage) ── */
export interface FDCHistoryEntry {
  id: string;
  date: string;
  mode: FDCMode;
  goal: FDCGoal;
  inputPreview: string;
  result: FDCResult;
}

/* ── API response envelope ── */
export interface FDCApiResponse {
  ok: boolean;
  result?: FDCResult;
  error?: string;
  creditsUsed?: number;
  balanceAfter?: number;
}
