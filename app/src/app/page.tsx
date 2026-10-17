import { LandingLetter } from "@/components/LandingLetter";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-svh bg-white text-neutral-900">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <span className="text-sm font-bold tracking-[0.28em] uppercase">
            ShortMail
          </span>
          <Link
            href="/dashboard"
            className="text-sm text-neutral-600 hover:text-neutral-900"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-4xl font-bold leading-tight tracking-tight">
          Fewer, shorter, better emails.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-neutral-600">
          ShortMail is one page and a 500-character limit. People write you
          short; you read everything. Nothing is stored after it&rsquo;s
          emailed.
        </p>

        <div className="mt-10 border border-neutral-300 p-6 sm:p-8">
          <p className="mb-4 text-sm font-medium">
            Try it — this form is real. Your letter lands in Eric&rsquo;s
            inbox.
          </p>
          <LandingLetter />
        </div>

        <section className="mt-14">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em]">
            Want your own page?
          </h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
            <li>Sign in and claim your page — yourname at ShortMail.</li>
            <li>Share one link anywhere: your site, your slides, your bio.</li>
            <li>
              Short letters arrive in your inbox. Premium adds analytics,
              theming, and an embeddable form.
            </li>
          </ol>
          <Link
            href="/dashboard"
            className="mt-5 inline-block border border-black px-5 py-2 text-sm font-medium hover:bg-neutral-900 hover:text-white"
          >
            Sign in to set up your page
          </Link>
        </section>

        <section className="mt-14 border-t border-neutral-200 pt-8 text-sm leading-relaxed text-neutral-600">
          <p>
            Messages are never stored: your letter is emailed to the recipient
            and then it exists only where email exists — your sent folder,
            their inbox. Senders stay anonymous unless they sign their letter.
          </p>
        </section>
      </main>

      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5 text-xs text-neutral-500">
          <span>© Nonlinear Labs · BUSL-1.1</span>
          <span>One account, one email.</span>
        </div>
      </footer>
    </div>
  );
}
