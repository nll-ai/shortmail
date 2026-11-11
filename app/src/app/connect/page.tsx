import type { Metadata } from "next";
import { focusClass } from "@/theme/controls";

export const metadata: Metadata = {
  title: "Connect ShortMail to your agent",
  description: "Change your ShortMail page from Cursor, Claude, or another MCP client.",
};

const linkFocus = focusClass;
const MCP_URL = "https://shortmail.nonlinearlabs.ai/mcp";

const CURSOR_CONFIG = `{
  "mcpServers": {
    "shortmail": {
      "url": "${MCP_URL}"
    }
  }
}`;

/**
 * Public setup for the remote MCP server.
 *
 * The page does not sign the visitor in and does not change a page.
 */
export default function ConnectPage() {
  return (
    <div
      className="min-h-svh bg-background text-foreground"
      style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}
    >
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[42rem] items-center justify-between px-6">
          <a href="/" className={`inline-flex min-h-11 items-center text-sm font-bold tracking-[0.04em] ${linkFocus}`}>
            ShortMail
          </a>
          <a
            href="/dashboard"
            className={`inline-flex min-h-11 items-center px-1 text-[15px] font-medium text-foreground ${linkFocus}`}
          >
            Dashboard
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[42rem] px-6 pb-16 pt-14 max-sm:pt-9">
        <h1 className="text-4xl font-bold leading-[1.2] tracking-tight max-sm:text-[32px]">
          Connect ShortMail to your agent
        </h1>
        <p className="mt-4 text-lg leading-[1.55] text-muted">
          Cursor, Claude, and other MCP clients can edit the page that belongs
          to the person who signs in. The server does not read or send letters.
        </p>
        <p className="mt-4 leading-[1.55]">
          Server URL:{" "}
          <code className="[overflow-wrap:anywhere]">{MCP_URL}</code>
        </p>

        <h2 className="mb-3.5 mt-14 text-[15px] font-semibold">Cursor</h2>
        <p className="leading-[1.55] text-muted">
          Add a remote MCP server with that URL, or put this in{" "}
          <code>.cursor/mcp.json</code>. Cursor opens a WorkOS sign-in. Use the
          same account as the ShortMail dashboard.
        </p>
        <pre className="mt-4 overflow-x-auto border border-line bg-code p-4 text-xs text-code-foreground">
          {CURSOR_CONFIG}
        </pre>

        <h2 className="mb-3.5 mt-14 text-[15px] font-semibold">Claude</h2>
        <p className="leading-[1.55] text-muted">
          In Claude Desktop or claude.ai, open Settings, then Connectors, and
          add a custom connector with the server URL.
        </p>
        <p className="mt-3 leading-[1.55] text-muted">
          Claude Code:
        </p>
        <pre className="mt-4 overflow-x-auto border border-line bg-code p-4 text-xs text-code-foreground">
          {`claude mcp add --transport http shortmail ${MCP_URL}`}
        </pre>

        <h2 className="mb-3.5 mt-14 text-[15px] font-semibold">What the agent can change</h2>
        <ul className="list-disc space-y-3 pl-5 leading-normal">
          <li>Subject headings: add, edit, remove, and reorder.</li>
          <li>
            FAQs: add, edit, remove, and reorder. Answers are markdown. The
            public page keeps http(s) and mailto links and drops every other
            link, the same rule as the dashboard.
          </li>
          <li>
            Display name. The public page says “Send a shortmail to” plus that
            name. There is no separate intro field.
          </li>
          <li>Paid accounts: vanity name, theme, and embed origins.</li>
        </ul>
        <p className="mt-4 leading-[1.55] text-muted">
          Removing a heading or FAQ does nothing until the tool is called with
          confirmation. A free account stores 5 headings and 3 FAQs. Writes are
          limited to 30 a minute.
        </p>

        <h2 className="mb-3.5 mt-14 text-[15px] font-semibold">WorkOS setup</h2>
        <p className="leading-[1.55] text-muted">
          A preview signs in with the staging AuthKit
          (<code>warm-respect-91-staging.authkit.app</code>). The production
          server URL uses the production AuthKit
          (<code>fair-rose-65.authkit.app</code>). The issuer follows the
          deployment, not a single hardcoded domain.
        </p>
        <ol className="mt-4 list-decimal space-y-3 pl-5 leading-normal">
          <li>
            Enable Client ID Metadata Document and Dynamic Client Registration
            under Connect, then Configuration. Cursor and Claude need one of
            those so they can register without a shared API key.
          </li>
          <li>
            Add resource indicator <code>{MCP_URL}</code> and set it as the
            default. Add{" "}
            <code>https://shortmail-*-eric-mas-projects-a230afd1.vercel.app/mcp</code>{" "}
            so preview hosts can be used. A wildcard cannot be the default.
          </li>
          <li>
            Do not add a new redirect URI on the ShortMail AuthKit application.
            MCP clients register their own callback.
          </li>
        </ol>
        <p className="mt-4 leading-[1.55] text-muted">
          On a preview deployment, connect to the branch alias ending in{" "}
          <code>/mcp</code>, not the one-off deployment hostname. The token
          audience has to match that URL.
        </p>
      </main>
    </div>
  );
}
