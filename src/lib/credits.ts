/**
 * UtilityLab Credits SDK — chiamate HTTP verso il hub centralizzato.
 * Usato sia lato server (API route) sia lato client (per check saldo).
 */

const HUB_URL = process.env.NEXT_PUBLIC_HUB_URL || "https://www.utility-lab.it";
const TOOL_SLUG = "food-decision-coach";

export type CreditCheckResult = {
  ok: boolean;
  balance: number;
  cost: number;
  unlimited: boolean;
  transaction_id?: string;
  code?: string;
  _redirect?: string;
};

export type BalanceResult = {
  ok: boolean;
  balance: number;
  plan: string;
  total_used: number;
  total_purchased: number;
};

export const ULCredits = {
  async getBalance(accessToken: string): Promise<BalanceResult> {
    const res = await fetch(`${HUB_URL}/api/credits/balance`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.json();
  },

  async deduct(
    accessToken: string,
    action: string = "default",
    metadata: Record<string, unknown> = {}
  ): Promise<CreditCheckResult> {
    const res = await fetch(`${HUB_URL}/api/credits/deduct`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tool_slug: TOOL_SLUG,
        action,
        request_id: `${TOOL_SLUG}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        metadata,
      }),
    });

    const data = await res.json();

    if (res.status === 402) {
      data._redirect = `${HUB_URL}/pricing?from=${TOOL_SLUG}`;
    }

    return data;
  },

  async refund(accessToken: string, transactionId: string) {
    const res = await fetch(`${HUB_URL}/api/credits/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transaction_id: transactionId }),
    });
    return res.json();
  },

  pricingUrl(): string {
    return `${HUB_URL}/pricing?from=${TOOL_SLUG}`;
  },

  loginUrl(): string {
    return "/login";
  },
};
