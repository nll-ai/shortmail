import { createServer, type Server } from "node:http";
import { existsSync, writeFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { convexTest } from "convex-test";
import { afterAll, describe, expect, it } from "vitest";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.setup";
import { handleMcpRequest, unauthorized } from "./http";
import { pageGateway } from "./pageGateway";

/**
 * Fixture end-to-end check.
 *
 * A real MCP client talks to the Streamable HTTP handler. The database is
 * convex-test, in memory. This is not a Vercel preview.
 */

const OWNER = { subject: "owner-subject", email: "owner@example.com" };
const OTHER = { subject: "other-subject", email: "other@example.com" };
const RESOURCE = "http://127.0.0.1/mcp";

const t = convexTest({ schema, modules });

function gatewayFor(identity: { subject: string; email: string }) {
  const client = t.withIdentity(identity);
  const query = client.query as (reference: unknown, args: unknown) => Promise<unknown>;
  const mutation = client.mutation as (reference: unknown, args: unknown) => Promise<unknown>;
  return pageGateway({ query, mutation });
}

const tokens = new Map<string, { subject: string; email: string }>([
  ["owner-token", OWNER],
  ["other-token", OTHER],
]);

async function handle(request: Request): Promise<Response> {
  return handleMcpRequest(request, {
    resource: RESOURCE,
    authenticate: async (incoming) => {
      const header = incoming.headers.get("authorization") ?? "";
      const token = header.replace(/^Bearer\s+/i, "");
      const identity = tokens.get(token);
      if (!identity) return { ok: false, response: unauthorized(RESOURCE) };
      return { ok: true, gateway: gatewayFor(identity) };
    },
  });
}

function listen(): Promise<{ server: Server; url: string }> {
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(key, value);
      else if (Array.isArray(value)) for (const item of value) headers.append(key, item);
    }
    const request = new Request(`http://127.0.0.1${req.url ?? "/"}`, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(chunks),
    });
    const response = await handle(request);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("no port");
      resolve({ server, url: `http://127.0.0.1:${address.port}/mcp` });
    });
  });
}

async function connect(url: string, token: string): Promise<Client> {
  const client = new Client({ name: "shortmail-fixture", version: "0.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

describe("MCP HTTP fixture", () => {
  let server: Server | undefined;
  let url = "";

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  });

  it("lists tools and reorders headings, and rejects the other owner", async () => {
    await t.run(async (ctx) => {
      const ownerId = await ctx.db.insert("users", {
        email: OWNER.email,
        workosUserId: OWNER.subject,
        vanityName: "owner",
        displayName: "Owner",
        isPaid: true,
        createdAt: 1,
      });
      await ctx.db.insert("users", {
        email: OTHER.email,
        workosUserId: OTHER.subject,
        vanityName: "other",
        displayName: "Other",
        isPaid: true,
        createdAt: 2,
      });
      await ctx.db.insert("subjectHeadings", { ownerId, heading: "Alpha", position: 0 });
      await ctx.db.insert("subjectHeadings", { ownerId, heading: "Beta", position: 1 });
    });

    ({ server, url } = await listen());
    const bare = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: "{}",
    });
    expect(bare.status).toBe(401);
    expect(bare.headers.get("www-authenticate")).toContain("resource_metadata");

    const owner = await connect(url, "owner-token");
    const listed = await owner.listTools();
    const names = listed.tools.map((tool) => tool.name).sort();
    expect(names).toContain("reorder_subject_headings");
    expect(names).toContain("get_page_config");
    const remove = listed.tools.find((tool) => tool.name === "remove_subject_heading");
    expect(remove?.annotations?.destructiveHint).toBe(true);
    expect(names.join(" ")).not.toMatch(/letter|submitSend/);

    const config = await owner.callTool({ name: "get_page_config", arguments: {} });
    const configText = toolText(config);
    const page = JSON.parse(configText) as {
      subjectHeadings: { id: string; heading: string }[];
    };
    expect(page.subjectHeadings.map((row) => row.heading)).toEqual(["Alpha", "Beta"]);

    const reordered = await owner.callTool({
      name: "reorder_subject_headings",
      arguments: { ids: [page.subjectHeadings[1].id, page.subjectHeadings[0].id] },
    });
    const after = JSON.parse(toolText(reordered)) as {
      subjectHeadings: { heading: string }[];
    };
    expect(after.subjectHeadings.map((row) => row.heading)).toEqual(["Beta", "Alpha"]);

    const other = await connect(url, "other-token");
    const denied = await other.callTool({
      name: "reorder_subject_headings",
      arguments: { ids: [page.subjectHeadings[1].id, page.subjectHeadings[0].id] },
    });
    expect("isError" in denied && denied.isError).toBe(true);
    expect(toolText(denied)).toBe("That item is not on your page.");

    const still = JSON.parse(
      toolText(await owner.callTool({ name: "get_page_config", arguments: {} })),
    ) as { subjectHeadings: { heading: string }[] };
    expect(still.subjectHeadings.map((row) => row.heading)).toEqual(["Beta", "Alpha"]);

    const transcript = [
      "LABEL: fixture. In-memory convex-test behind the real MCP HTTP handler.",
      "Not the Vercel preview. Not production.",
      "",
      "tools:",
      ...listed.tools.map(
        (tool) =>
          `- ${tool.name} destructiveHint=${String(tool.annotations?.destructiveHint ?? false)}`,
      ),
      "",
      "owner reorder Alpha, Beta -> Beta, Alpha:",
      toolText(reordered),
      "",
      "other owner reorder rejected:",
      toolText(denied),
      "",
      "owner config after the rejected call:",
      toolText(await owner.callTool({ name: "get_page_config", arguments: {} })),
    ].join("\n");
    if (existsSync("/opt/cursor/artifacts")) {
      writeFileSync("/opt/cursor/artifacts/mcp-fixture-reorder.txt", `${transcript}\n`);
    }

    await owner.close();
    await other.close();
  }, 30_000);
});

function toolText(result: unknown): string {
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
