import type { Metadata } from "next";
import Link from "next/link";
import { focusClass } from "@/theme/controls";

export const metadata: Metadata = {
  title: "Could not sign in — ShortMail",
  description: "The sign-in attempt did not finish.",
};

/**
 * Shown when the AuthKit callback cannot finish a sign-in. Sign-in itself
 * is the WorkOS page. This is the page ShortMail controls after that.
 */
export default function AuthErrorPage() {
  return (
    <main
      className="min-h-svh bg-background px-6 py-16 text-foreground"
      style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
    >
      <div className="mx-auto max-w-lg border border-line bg-surface p-6 sm:p-8">
        <p className="text-sm font-bold tracking-[0.04em]">ShortMail</p>
        <h1 className="mt-6 text-lg font-semibold">Could not sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The sign-in attempt did not finish. Start again from the home page.
          Nothing was changed on your account.
        </p>
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
