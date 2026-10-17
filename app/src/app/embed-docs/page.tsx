import Link from "next/link";

export const metadata = { title: "ShortMail embed docs" };

const CODE_SNIPPET = `<script src="https://shortmail-gamma.vercel.app/widget.js" defer></script>
<shortmail-widget vanity="your-vanity"></shortmail-widget>`;

export default function EmbedDocsPage() {
  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <h1 className="text-2xl font-bold">Embed ShortMail anywhere</h1>
      <p className="text-sm text-gray-600">
        ShortMail embeds as a <strong>web component with an isolated shadow
        root</strong> — not an iframe. Your site&apos;s CSS cannot break the
        form, and the form cannot restyle your site.
      </p>

      <section>
        <h2 className="text-lg font-semibold">1. Add the script tag</h2>
        <pre className="mt-2  bg-gray-900 p-4 text-xs text-gray-100 overflow-x-auto">
          {CODE_SNIPPET}
        </pre>
        <p className="mt-2 text-xs text-gray-500">
          Replace <code>your-vanity</code> with your vanity name (Dashboard →
          Your send page). Premium accounts only.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">2. Style it (optional)</h2>
        <p className="mt-2 text-sm text-gray-600">
          Configure colors and fonts in Dashboard → Theming; embedded forms
          pick up your theme automatically. For deeper styling from the host
          page, use <code>::part()</code>:
        </p>
        <pre className="mt-2  bg-gray-900 p-4 text-xs text-gray-100 overflow-x-auto">
          {`shortmail-widget::part(button) { border-radius: 8px; }`}
        </pre>
        <p className="mt-2 text-xs text-gray-500">
          Exposed parts: <code>form</code>, <code>input</code>,{" "}
          <code>button</code>, <code>heading</code>, <code>faq</code>.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">
          3. Restrict where it may embed (optional)
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          By default your form can be embedded anywhere. In Dashboard → Embed
          you can allow-list specific origins; non-matching sites render a
          &quot;not allowed&quot; state instead of your form.
        </p>
      </section>

      <section className=" border border-amber-300 bg-amber-50 p-4">
        <h2 className="text-sm font-semibold text-amber-900">
          Trust model — please read
        </h2>
        <p className="mt-1 text-sm text-amber-900">
          The host page can read what visitors type into an embedded widget
          (that is true of every non-iframe embed). Embed only on sites you
          control or trust. Messages always go to <em>your</em> inbox — a
          hostile host cannot redirect them.
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
