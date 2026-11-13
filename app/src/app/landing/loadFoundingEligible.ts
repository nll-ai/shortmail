import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

/**
 * Read public founding eligibility for the marketing page.
 *
 * This is the only Convex query allowed on `/`. On failure, founding is
 * treated as closed so copy shows the standard annual price only.
 *
 * :returns: Whether checkout would offer the founding yearly price.
 */
export async function loadFoundingEligible(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return false;
  try {
    const client = new ConvexHttpClient(url);
    const status = await client.query(api.billing.foundingStatus, {});
    return status.eligible === true;
  } catch {
    return false;
  }
}
