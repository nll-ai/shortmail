"use client";

import { focusClass } from "@/theme/controls";

/**
 * Route error boundary. The copy stays generic so an internal message is
 * not the thing a visitor has to read.
 */
export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      className="min-h-svh bg-background px-6 py-16 text-foreground"
      style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
    >
      <div className="mx-auto max-w-lg">
        <p className="text-sm font-bold tracking-[0.04em]">ShortMail</p>
        <h1 className="mt-6 text-2xl font-bold">Something went wrong</h1>
        <p className="mt-3 text-muted">
          This page could not be shown. Your letter, if you were writing one,
          is still in this tab.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className={`mt-6 inline-flex min-h-11 items-center bg-accent px-[18px] text-base font-medium text-accent-foreground ${focusClass}`}
        >
          Try again
        </button>
      </div>
    </main>
  );
}
