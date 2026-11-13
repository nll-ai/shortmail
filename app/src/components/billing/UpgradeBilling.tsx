"use client";

import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { useMe } from "../useMe";
import { primaryClass, controlClass } from "@/theme/controls";
import { portalErrorMessage } from "@/lib/billing/apiErrors";

type JsonBody = { url?: string; error?: string; message?: string };

async function postJson(path: string, init?: RequestInit): Promise<JsonBody> {
  const res = await fetch(path, { method: "POST", ...init });
  const body = (await res.json()) as JsonBody;
  if (!res.ok) {
    const msg = body.message ?? portalErrorMessage(body.error) ?? body.error ?? "request_failed";
    throw new Error(msg);
  }
  return body;
}

function readAndStripBillingParam(): string | null {
  if (typeof window === "undefined") return null;
  const current = new URLSearchParams(window.location.search).get("billing");
  if (!current) return null;
  const url = new URL(window.location.href);
  url.searchParams.delete("billing");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", next);
  return current;
}

export function BillingBanner() {
  const { me } = useMe();
  const params = useSearchParams();
  const flashBilling = useMemo(() => {
    if (params.get("billing")) return readAndStripBillingParam();
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (params.get("billing")) readAndStripBillingParam();
  }, [params]);

  if (me?.isPaid) return null;

  const billing = flashBilling ?? params.get("billing");

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
              setError(
                e instanceof Error ? e.message : portalErrorMessage(undefined),
              );
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
            setError(e instanceof Error ? e.message : "Checkout failed — please try again.");
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
