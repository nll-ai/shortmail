import { ConvexError } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUser } from "./lib/identity";
import { MCP_WRITE_LIMIT, MCP_WRITE_WINDOW_MS } from "./lib/mcpWriteLimit";
import { bump } from "./lib/rateLimit";

/**
 * Charge one MCP write to the signed-in owner.
 *
 * Tools call this before a configuration mutation. The mutation they call
 * next still checks ownership. This does not authorize a change by itself.
 */
export const consumeWrite = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const result = await bump(
      ctx,
      `mcp:write:${user._id}`,
      MCP_WRITE_WINDOW_MS,
      MCP_WRITE_LIMIT,
    );
    if (!result.ok) throw new ConvexError("RATE_LIMITED");
    return { ok: true as const, count: result.count };
  },
});
