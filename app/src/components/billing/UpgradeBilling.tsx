"use client";

import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { useMe } from "../useMe";
import { primaryClass, controlClass } from "@/theme/controls";

async function postJson(path: string): Promise<{ url?: string; error?: string }> {
  const res = await fetch(path, { method: "POST" });
  const body = (await res.json()) as { url?: string; error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? "request_failed");
  }
  return body;
}

export function BillingBanner() {
  const params = useSearchParams();
  const billing = params.get("billing");
  if (billing === "success") {
    return (
      <p className="mb-4 border border-info-border bg-info-bg px-4 py-3 text-sm text-info-foreground">
        Payment received — Premium should unlock within a few seconds once Stripe
        confirms your subscription.
      </p>
    );
  }
  if (billing === "canceled") {
    return (
      <p className="mb-4 border px-4 py-3 text-sm text-muted">
        Checkout canceled. Your account is unchanged.
      </p>
    );
  }
  return null;
}

export function UpgradeBillingCard({ compact = false }: { compact?: boolean }) {
  const { me } = useMe();
  const founding = useQuery(api.billing.foundingStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ensureMe = useMutation(api.users.ensureMe);

  if (me === undefined || me === null) return null;

  if (me.isPaid) {
    return (
      <div className={compact ? "text-sm" : "border p-4 text-sm space-y-2"}>
        <p className="font-medium text-sm">Premium active</p>
        <p className="text-xs text-muted">
          Analytics, theming, embed, and custom vanity are unlocked.
        </p>
        <button
          type="button"
          className={controlClass}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const { url } = await postJson("/api/billing/portal");
              if (url) window.location.href = url;
            } catch (e) {
              setError(e instanceof Error ? e.message : "portal_failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          Manage billing
        </button>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    );
  }

  const foundingEligible = founding?.eligible === true;
  const priceLabel = foundingEligible ? "$36/year founding" : "$48/year";

  return (
    <div className={compact ? "text-sm space-y-2" : "border p-4 text-sm space-y-2"}>
      <p className="font-medium text-sm">Upgrade to Premium</p>
      <p className="text-xs text-muted">
        Unlimited headings and FAQs, analytics, theming, embed, and a custom
        vanity name. {priceLabel} billed annually.
      </p>
      {foundingEligible && founding?.windowEndsAtMs != null && (
        <p className="text-xs text-muted">
          Founding price — {founding.foundingCustomersCount ?? 0} of{" "}
          {founding.foundingCap ?? 100} slots used.
        </p>
      )}
      <button
        type="button"
        className={primaryClass}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await ensureMe({});
            const { url } = await postJson("/api/billing/checkout");
            if (url) window.location.href = url;
          } catch (e) {
            setError(e instanceof Error ? e.message : "checkout_failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        Upgrade to Premium
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
