/**
 * Write budget for the remote MCP server.
 *
 * One bucket per owner. Dashboard clicks do not use this key. The window
 * is fixed at one minute. A rejected write still counts, so a loop of bad
 * ids cannot outrun the limit.
 */

export const MCP_WRITE_LIMIT = 30;
export const MCP_WRITE_WINDOW_MS = 60 * 1000;
