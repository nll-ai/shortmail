import { existsSync, writeFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { describe, expect, it } from "vitest";

/**
 * Real preview check.
 *
 * Skipped unless SHORTMAIL_MCP_PREVIEW_URL is the preview origin, for example
 * https://shortmail-git-branch-eric-mas-projects-a230afd1.vercel.app
 * A signed-in reorder also needs SHORTMAIL_MCP_ACCESS_TOKEN. CI does not set
 * either variable. The fixture HTTP test covers the client without this URL.
 */

const previewUrl = process.env.SHORTMAIL_MCP_PREVIEW_URL?.replace(/\/$/, "");
const accessToken = process.env.SHORTMAIL_MCP_ACCESS_TOKEN;

(previewUrl ? describe : describe.skip)("Vercel preview MCP", () => {
  it("serves protected-resource metadata and challenges an MCP client", async () => {
    const origin = previewUrl!;
    const metadataResponse = await fetch(
      `${origin}/.well-known/oauth-protected-resource/mcp`,
    );
    expect(metadataResponse.status).toBe(200);
    const metadata = (await metadataResponse.json()) as {
      resource: string;
      authorization_servers: string[];
      bearer_methods_supported: string[];
    };
    expect(metadata.resource).toBe(`${origin}/mcp`);
    expect(metadata.authorization_servers[0]).toMatch(/authkit\.app$/);
    expect(metadata.bearer_methods_supported).toEqual(["header"]);

    const denied = await fetch(`${origin}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "shortmail-preview-check", version: "0.0.0" },
        },
      }),
    });
    expect(denied.status).toBe(401);
    const challenge = denied.headers.get("www-authenticate") ?? "";
    expect(challenge).toContain("resource_metadata");
    expect(challenge).toContain("/.well-known/oauth-protected-resource/mcp");

    const client = new Client({ name: "shortmail-preview-check", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`));
    let clientError = "";
    try {
      await client.connect(transport);
      clientError = "connect succeeded without a token";
    } catch (error) {
      clientError = error instanceof Error ? error.message : String(error);
    }
    expect(clientError).not.toBe("connect succeeded without a token");

    const lines = [
      "LABEL: Vercel preview. Unauthenticated discovery only.",
      `origin: ${origin}`,
      "",
      "GET /.well-known/oauth-protected-resource/mcp",
      JSON.stringify(metadata, null, 2),
      "",
      `POST /mcp without a token -> ${denied.status}`,
      challenge,
      "",
      "MCP client connect without a token:",
      clientError,
    ];
    if (existsSync("/opt/cursor/artifacts")) {
      writeFileSync("/opt/cursor/artifacts/mcp-preview-unauthenticated.txt", `${lines.join("\n")}\n`);
    }
  }, 30_000);

  (accessToken ? it : it.skip)("reorders headings with a real access token", async () => {
    const client = new Client({ name: "shortmail-preview-check", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${previewUrl}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
    await client.connect(transport);
    const listed = await client.listTools();
    const configResult = await client.callTool({ name: "get_page_config", arguments: {} });
    const configText = text(configResult);
    const config = JSON.parse(configText) as {
      subjectHeadings: { id: string; heading: string }[];
    };
    expect(config.subjectHeadings.length).toBeGreaterThan(1);
    const ids = config.subjectHeadings.map((row) => row.id);
    const swapped = [ids[1], ids[0], ...ids.slice(2)];
    const reordered = await client.callTool({
      name: "reorder_subject_headings",
      arguments: { ids: swapped },
    });
    const after = JSON.parse(text(reordered)) as {
      subjectHeadings: { id: string; heading: string }[];
    };
    expect(after.subjectHeadings.map((row) => row.id)).toEqual(swapped);
    await client.callTool({
      name: "reorder_subject_headings",
      arguments: { ids },
    });
    const lines = [
      "LABEL: Vercel preview. Authenticated MCP client.",
      `origin: ${previewUrl}`,
      "",
      "tools:",
      ...listed.tools.map((tool) => `- ${tool.name}`),
      "",
      "reorder:",
      text(reordered),
    ];
    if (existsSync("/opt/cursor/artifacts")) {
      writeFileSync("/opt/cursor/artifacts/mcp-preview-reorder.txt", `${lines.join("\n")}\n`);
    }
    await client.close();
  }, 30_000);
});

function text(result: unknown): string {
  if (!result || typeof result !== "object" || !("content" in result)) {
    throw new Error("tool returned no text");
  }
  const content = (result as { content: unknown }).content;
  if (!Array.isArray(content)) throw new Error("tool returned no text");
  const block = content.find(
    (item) => item && typeof item === "object" && (item as { type?: string }).type === "text",
  ) as { text?: string } | undefined;
  if (!block?.text) throw new Error("tool returned no text");
  return block.text;
}
