/**
 * Billing configuration read from environment (Vercel + Convex).
 *
 * :param env: process.env or a test fixture map.
 */
export type BillingEnv = Record<string, string | undefined>;

export const LOOKUP_KEY_PREMIUM_YEARLY = "shortmail_premium_yearly";
export const LOOKUP_KEY_FOUNDING_YEARLY = "shortmail_premium_founding_yearly";

export const PREMIUM_CENTS_YEARLY = 4800;
export const FOUNDING_CENTS_YEARLY = 3600;

export const DEFAULT_FOUNDING_CAP = 100;
export const DEFAULT_FOUNDING_WINDOW_DAYS = 90;

export type BillingConfig = {
  foundingCap: number;
  launchAtMs: number;
  foundingWindowDays: number;
};

/**
 * Parse billing timing config. Missing launch time means founding window closed.
 */
export function readBillingConfig(env: BillingEnv): BillingConfig | null {
  const rawLaunch = env.STRIPE_BILLING_LAUNCH_AT?.trim();
  if (!rawLaunch) return null;

  const launchAtMs = Number.isFinite(Number(rawLaunch))
    ? Number(rawLaunch)
    : Date.parse(rawLaunch);
  if (!Number.isFinite(launchAtMs)) return null;

  const foundingCap = parsePositiveInt(env.STRIPE_FOUNDING_CAP, DEFAULT_FOUNDING_CAP);
  const foundingWindowDays = parsePositiveInt(
    env.STRIPE_FOUNDING_WINDOW_DAYS,
    DEFAULT_FOUNDING_WINDOW_DAYS,
  );

  return { foundingCap, launchAtMs, foundingWindowDays };
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
