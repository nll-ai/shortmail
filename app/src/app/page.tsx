import type { Metadata } from "next";
import { LetterSpecimen } from "@/components/LetterSpecimen";
import { focusClass } from "@/theme/controls";

export const metadata: Metadata = {
  title: "ShortMail",
  description: "One link for short letters. 500 characters, delivered as email.",
};

const linkFocus = focusClass;

/**
 * Owner-focused marketing page.
 *
 * The letter below is a static example. Account actions go to the existing
 * dashboard gate and this component does not send mail.
 */
export default function Home() {
  return (
    <div
      className="min-h-svh bg-background text-foreground"
      style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
    >
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[42rem] items-center justify-between px-6">
          <span className="text-sm font-bold tracking-[0.04em]">ShortMail</span>
          <a
            href="/dashboard"
            className={`inline-flex min-h-11 min-w-11 items-center justify-center px-1 text-[15px] font-medium text-foreground ${linkFocus}`}
          >
            Sign in
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[42rem] px-6 pb-12 pt-14 max-sm:pt-9">
        <h1 className="text-4xl font-bold leading-[1.2] tracking-tight max-sm:text-[32px]">
          A page for the letters you want.
        </h1>
        <p className="mt-4 text-lg leading-[1.55] text-muted">
          People write you at one link. Each letter is at most 500 characters.
          It arrives as ordinary email.
        </p>
        <a
          href="/dashboard"
          className={`mt-6 inline-flex min-h-11 items-center bg-accent px-[18px] text-base font-medium text-accent-foreground ${linkFocus}`}
        >
          Create your page
        </a>

        <LetterSpecimen />

        <h2 className="mb-3.5 mt-14 text-[15px] font-semibold">A free page</h2>
        <ol className="list-decimal space-y-3 pl-5 leading-normal">
          <li>
            Create your page. A free account gets a generated link, shaped like{" "}
            <span className="[overflow-wrap:anywhere]">/send/ada-1a2b3c</span>.
            Signup does not let you choose that name.
          </li>
          <li>
            You can publish up to 5 subject headings. Visitors pick one of
            yours, or write their own. A free account can also save 3 FAQ
            entries. Visitors see those answers under the questions on the letter page.
          </li>
          <li>
            The letter arrives as email. Analytics, theming, an embed, and a
            custom link name are paid-account features. This page does not take
            payment.
          </li>
        </ol>

        <h2 className="mb-3.5 mt-14 text-[15px] font-semibold">What is kept</h2>
        <p className="leading-[1.55] text-muted">
          The letter is delivered as email to you. ShortMail does not keep the
          letter body in its database. The visitor&apos;s name and email are
          required, and both are on the email you receive, so the visitor is
          not anonymous. ShortMail does not put a copy in the visitor&apos;s
          sent folder. It does store the subject, including whether a reply was
          requested, and aggregate events for page views and successful sends.
          Before a letter can be delivered, the visitor proves they can open
          that inbox. ShortMail stores a hash of the address and a hash of
          that browser&apos;s proof for up to 30 days, not a copy of the letter.
        </p>
      </main>

      <footer className="mt-12 border-t border-line">
        <div className="mx-auto flex max-w-[42rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-5 text-[13px] text-muted">
          <span>© Nonlinear Labs · BUSL-1.1</span>
          <a
            href="/connect"
            className={`inline-flex min-h-11 items-center text-foreground ${linkFocus}`}
          >
            Connect an agent
          </a>
          <span>One account, one email.</span>
        </div>
      </footer>
    </div>
  );
}
