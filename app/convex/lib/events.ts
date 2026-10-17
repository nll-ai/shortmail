import { MutationCtx } from "../_generated/server";
import { utcDay } from "./days";

export type EventRow = {
  ownerId: import("../_generated/dataModel").Id<"users">;
  type: "form_view" | "send_success";
  subject?: string;
  path?: string;
  ref?: string;
};

/**
 * The single writer of `events` rows (codebase-design review finding 6):
 * one row shape, one day-key source (lib/days), used by the analytics
 * beacon collector and the send-success recorder alike.
 */
export async function insertEventRow(
  ctx: MutationCtx,
  event: EventRow,
): Promise<void> {
  await ctx.db.insert("events", {
    ownerId: event.ownerId,
    type: event.type,
    day: utcDay(),
    ts: Date.now(),
    subject: event.subject,
    path: event.path,
    ref: event.ref,
  });
}
