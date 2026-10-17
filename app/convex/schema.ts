import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    workosUserId: v.string(),
    vanityName: v.string(),
    displayName: v.optional(v.string()),
    isPaid: v.boolean(),
    embedAllowedOrigins: v.optional(v.array(v.string())),
    adminRole: v.optional(
      v.union(
        v.literal("super_admin"),
        v.literal("admin"),
        v.literal("moderator"),
      ),
    ),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_vanity", ["vanityName"])
    .index("by_workos", ["workosUserId"]),

  subjectHeadings: defineTable({
    ownerId: v.id("users"),
    heading: v.string(),
  }).index("by_owner", ["ownerId"]),

  faqs: defineTable({
    ownerId: v.id("users"),
    question: v.string(),
    answer: v.string(), // markdown
  }).index("by_owner", ["ownerId"]),

  events: defineTable({
    ownerId: v.id("users"),
    type: v.union(v.literal("form_view"), v.literal("send_success")),
    day: v.string(), // YYYY-MM-DD (UTC)
    ts: v.number(),
    subject: v.optional(v.string()),
    path: v.optional(v.string()),
    ref: v.optional(v.string()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_day", ["ownerId", "day"]),

  rateLimits: defineTable({
    // "send:{ip}" | "collect:{ip}" | "cap:{vanity}:{YYYY-MM-DD}"
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),

  themeSettings: defineTable({
    ownerId: v.id("users"),
    preset: v.string(),
    customCss: v.optional(v.string()), // sanitized, <=16KB
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),
});
