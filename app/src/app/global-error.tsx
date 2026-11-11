"use client";

import "./globals.css";
import { focusClass } from "@/theme/controls";

/**
 * Last-resort error. This replaces the root layout, so it brings the theme
 * stylesheet and the color-scheme meta with it.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light dark" />
        <meta
          name="theme-color"
          content="#ffffff"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#0a0a0a"
          media="(prefers-color-scheme: dark)"
        />
        <title>Something went wrong — ShortMail</title>
      </head>
      <body>
        <main className="min-h-svh bg-background px-6 py-16 text-foreground">
          <div className="mx-auto max-w-lg">
            <p className="text-sm font-bold tracking-[0.04em]">ShortMail</p>
            <h1 className="mt-6 text-2xl font-bold">Something went wrong</h1>
            <p className="mt-3 text-muted">Reload the page and try again.</p>
            <button
              type="button"
              onClick={() => reset()}
              className={`mt-6 inline-flex min-h-11 items-center bg-accent px-[18px] text-base font-medium text-accent-foreground ${focusClass}`}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
