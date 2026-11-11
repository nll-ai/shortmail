import Link from "next/link";
import { embedSnippet } from "../../embed/widget-url";
import { codeBlockClass } from "@/theme/controls";

export const metadata = { title: "ShortMail embed docs" };

const CODE_SNIPPET = embedSnippet("your-vanity");

export default function EmbedDocsPage() {
  return (
    <main className="mx-auto min-h-svh max-w-3xl space-y-6 bg-background p-8 text-foreground">
      <h1 className="text-2xl font-bold">Embed ShortMail anywhere</h1>
      <p className="text-sm text-muted">
        ShortMail embeds as a <strong>web component with an isolated shadow
        root</strong> — not an iframe. Your site&apos;s CSS cannot break the
        form, and the form cannot restyle your site.
      </p>

      <section>
        <h2 className="text-lg font-semibold">1. Add the script tag</h2>
        <pre className={codeBlockClass}>
          {CODE_SNIPPET}
        </pre>
        <p className="mt-2 text-xs text-muted">
          Replace <code>your-vanity</code> with your vanity name (Dashboard →
          Your send page). Premium accounts only.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">2. Style it (optional)</h2>
        <p className="mt-2 text-sm text-muted">
          Configure colors and fonts in Dashboard → Theming; embedded forms
          pick up your theme automatically. For deeper styling from the host
          page, use <code>::part()</code>:
        </p>
        <pre className={codeBlockClass}>
          {`shortmail-widget::part(button) { border-radius: 8px; }`}
        </pre>
        <p className="mt-2 text-xs text-muted">
          Exposed parts: <code>form</code>, <code>input</code>,{" "}
          <code>button</code>, <code>heading</code>, <code>faq</code>.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">
          3. Restrict where it may embed (optional)
        </h2>
        <p className="mt-2 text-sm text-muted">
          By default your form can be embedded anywhere. In Dashboard → Embed
          you can allow-list specific origins; non-matching sites render a
          &quot;not allowed&quot; state instead of your form.
        </p>
      </section>

      <section className="border border-warning-border bg-warning-bg p-4 text-warning-foreground">
        <h2 className="text-sm font-semibold">
          Trust model — please read
        </h2>
        <p className="mt-1 text-sm">
          The host page can read what visitors type into an embedded widget,
          including the browser proof that lets them send again without a new
          code (that is true of every non-iframe embed). Embed only on sites
          you control or trust. A confirmation on one site does not carry to
          another site, and ShortMail does not use a third-party cookie for it.
          Messages always go to <em>your</em> inbox — a hostile host cannot
          redirect them. A cached copy of widget.js that does not send a
          session proof fails closed: the letter is not delivered. This
          proof is part of the Convex widget. The snippet above loads it
          from https://shortmail.nonlinearlabs.ai/widget.js. DNS has not
          been cut over, so until then that hostname still serves the older
          FastAPI app, which does not ask for this proof. Pages that already
          load widget.js from https://shortmail-gamma.vercel.app keep using
          the Convex widget.
        </p>
      </section>

      <p>
        <Link href="/dashboard" className="text-sm underline">
          ← Back to dashboard
        </Link>
      </p>
    </main>
  );
}
