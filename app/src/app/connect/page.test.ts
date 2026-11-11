import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ConnectPage from "./page";

describe("connect page", () => {
  it("tells Cursor and Claude how to reach the MCP server", () => {
    const html = renderToStaticMarkup(createElement(ConnectPage));
    expect(html).toContain("https://shortmail.nonlinearlabs.ai/mcp");
    expect(html).toContain("mcpServers");
    expect(html).toContain("claude mcp add --transport http shortmail");
    expect(html).toContain("fair-rose-65.authkit.app");
    expect(html).toContain("warm-respect-91-staging.authkit.app");
    expect(html).toContain("Dynamic Client Registration");
    expect(html).not.toContain("sk_");
  });
});
