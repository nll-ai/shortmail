import type { Metadata } from "next";
import Link from "next/link";
import { focusClass } from "@/theme/controls";

export const metadata: Metadata = {
  title: "Page not found — ShortMail",
};

/**
 * Unknown route, and a vanity the server could not find.
 */
export default function NotFound() {
  return (
    <main
      className="min-h-svh bg-background px-6 py-16 text-foreground"
      style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
    >
      <div className="mx-auto max-w-lg">
        <p className="text-sm font-bold tracking-[0.04em]">ShortMail</p>
        <h1 className="mt-6 text-2xl font-bold">Page not found</h1>
        <p className="mt-3 text-muted">That link does not match a ShortMail page.</p>
        <Link
          href="/"
          className={`mt-6 inline-flex min-h-11 items-center bg-accent px-[18px] text-base font-medium text-accent-foreground ${focusClass}`}
        >
          Back home
        </Link>
      </div>
    </main>
  );
}
