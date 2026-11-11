// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

const OWNER = { subject: "owner-subject", email: "owner@example.com" };
const OTHER = { subject: "other-subject", email: "other@example.com" };

function testDb() {
  return convexTest({ schema, modules });
}

async function seedPair(t: ReturnType<typeof testDb>) {
  return t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      email: OWNER.email,
      workosUserId: OWNER.subject,
      vanityName: "owner",
      isPaid: false,
      createdAt: 1,
    });
    const otherId = await ctx.db.insert("users", {
      email: OTHER.email,
      workosUserId: OTHER.subject,
      vanityName: "other",
      isPaid: true,
      createdAt: 2,
    });
    return { ownerId, otherId };
  });
}

describe("subject heading and FAQ order mutations", () => {
  it("keeps legacy rows in creation order and appends a new heading at the end", async () => {
    const t = testDb();
    const { ownerId } = await seedPair(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("subjectHeadings", { ownerId, heading: "First" });
      await ctx.db.insert("subjectHeadings", { ownerId, heading: "Second" });
    });
    const asOwner = t.withIdentity(OWNER);

    await asOwner.mutation(api.forms.addSubjectHeading, { heading: "Third" });
    const rows = await asOwner.query(api.forms.myHeadings, {});

    expect(rows.map((row) => row.heading)).toEqual(["First", "Second", "Third"]);
    expect(rows.map((row) => row.position)).toEqual([0, 1, 2]);
  });

  it("persists a heading reorder and serves that order on the public page", async () => {
    const t = testDb();
    const { ownerId } = await seedPair(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("subjectHeadings", { ownerId, heading: "First" });
      await ctx.db.insert("subjectHeadings", { ownerId, heading: "Second" });
      await ctx.db.insert("subjectHeadings", { ownerId, heading: "Third" });
    });
    const asOwner = t.withIdentity(OWNER);
    const before = await asOwner.query(api.forms.myHeadings, {});

    await asOwner.mutation(api.forms.reorderSubjectHeadings, {
      ids: [before[2]._id, before[0]._id, before[1]._id],
    });
    const after = await asOwner.query(api.forms.myHeadings, {});
    const config = await t.query(internal.public.configForVanity, { vanity: "owner" });

    expect(after.map((row) => row.heading)).toEqual(["Third", "First", "Second"]);
    expect(after.map((row) => row.position)).toEqual([0, 1, 2]);
    expect(config?.headings).toEqual(["Third", "First", "Second"]);
  });

  it("appends a heading the reorder request did not include and skips a deleted id", async () => {
    const t = testDb();
    const { ownerId } = await seedPair(t);
    const ids = await t.run(async (ctx) => {
      const first = await ctx.db.insert("subjectHeadings", { ownerId, heading: "First" });
      const second = await ctx.db.insert("subjectHeadings", { ownerId, heading: "Second" });
      const third = await ctx.db.insert("subjectHeadings", { ownerId, heading: "Third" });
      const extra = await ctx.db.insert("subjectHeadings", { ownerId, heading: "Extra" });
      await ctx.db.delete(second);
      return { first, second, third, extra };
    });
    const asOwner = t.withIdentity(OWNER);

    await asOwner.mutation(api.forms.reorderSubjectHeadings, {
      ids: [ids.third, ids.second, ids.first],
    });
    const rows = await asOwner.query(api.forms.myHeadings, {});

    expect(rows.map((row) => row.heading)).toEqual(["Third", "First", "Extra"]);
  });

  it("rejects another account's heading without changing either list", async () => {
    const t = testDb();
    const { ownerId, otherId } = await seedPair(t);
    const foreignId = await t.run(async (ctx) => {
      await ctx.db.insert("subjectHeadings", { ownerId, heading: "Mine", position: 0 });
      return ctx.db.insert("subjectHeadings", { ownerId: otherId, heading: "Theirs", position: 0 });
    });
    const asOwner = t.withIdentity(OWNER);
    const before = await asOwner.query(api.forms.myHeadings, {});

    await expect(
      asOwner.mutation(api.forms.reorderSubjectHeadings, {
        ids: [foreignId, before[0]._id],
      }),
    ).rejects.toThrow(/NOT_FOUND/);

    const after = await asOwner.query(api.forms.myHeadings, {});
    const foreign = await t.run(async (ctx) => ctx.db.get(foreignId));
    expect(after.map((row) => row.heading)).toEqual(["Mine"]);
    expect(after[0]?.position).toBe(0);
    expect(foreign?.heading).toBe("Theirs");
    expect(foreign?.position).toBe(0);
  });

  it("refuses an unauthenticated reorder", async () => {
    const t = testDb();
    await expect(t.mutation(api.forms.reorderSubjectHeadings, { ids: [] })).rejects.toThrow(
      /Unauthenticated/,
    );
  });

  it("still blocks a free account at the heading limit", async () => {
    const t = testDb();
    await seedPair(t);
    const asOwner = t.withIdentity(OWNER);
    for (const heading of ["a", "b", "c", "d", "e"]) {
      await asOwner.mutation(api.forms.addSubjectHeading, { heading });
    }
    await expect(asOwner.mutation(api.forms.addSubjectHeading, { heading: "f" })).rejects.toThrow(
      /FREE_LIMIT_REACHED/,
    );
    const rows = await asOwner.query(api.forms.myHeadings, {});
    expect(rows).toHaveLength(5);
  });

  it("reorders FAQs, then puts a new FAQ at the end", async () => {
    const t = testDb();
    const { ownerId } = await seedPair(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("faqs", { ownerId, question: "First?", answer: "A" });
      await ctx.db.insert("faqs", { ownerId, question: "Second?", answer: "B" });
    });
    const asOwner = t.withIdentity(OWNER);
    const before = await asOwner.query(api.forms.myFaqs, {});

    await asOwner.mutation(api.forms.reorderFaqs, {
      ids: [before[1]._id, before[0]._id],
    });
    await asOwner.mutation(api.forms.addFaq, { question: "Third?", answer: "C" });
    const after = await asOwner.query(api.forms.myFaqs, {});
    const config = await t.query(internal.public.configForVanity, { vanity: "owner" });

    expect(after.map((row) => row.question)).toEqual(["Second?", "First?", "Third?"]);
    expect(config?.faqs.map((faq) => faq.question)).toEqual(["Second?", "First?", "Third?"]);
  });

  it("rejects a FAQ that belongs to someone else", async () => {
    const t = testDb();
    const { otherId } = await seedPair(t);
    const foreignId = await t.run(async (ctx) => {
      return ctx.db.insert("faqs", {
        ownerId: otherId,
        question: "Secret?",
        answer: "No",
        position: 0,
      });
    });
    const asOwner = t.withIdentity(OWNER);

    await expect(
      asOwner.mutation(api.forms.reorderFaqs, { ids: [foreignId] }),
    ).rejects.toThrow(/NOT_FOUND/);
    const foreign = await t.run(async (ctx) => ctx.db.get(foreignId));
    expect(foreign?.position).toBe(0);
  });

  it("backfills missing positions in creation order and leaves an explicit order alone", async () => {
    const t = testDb();
    const { ownerId, otherId } = await seedPair(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("subjectHeadings", { ownerId, heading: "Alpha" });
      await ctx.db.insert("subjectHeadings", { ownerId, heading: "Beta" });
      await ctx.db.insert("faqs", {
        ownerId: otherId,
        question: "Created first?",
        answer: "A",
        position: 1,
      });
      await ctx.db.insert("faqs", {
        ownerId: otherId,
        question: "Created second?",
        answer: "B",
        position: 0,
      });
    });

    const first = await t.mutation(internal.migrate.backfillListOrder, {});
    const second = await t.mutation(internal.migrate.backfillListOrder, {});
    const headings = await t.run(async (ctx) => {
      return ctx.db
        .query("subjectHeadings")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .collect();
    });
    const faqs = await t.run(async (ctx) => {
      return ctx.db
        .query("faqs")
        .withIndex("by_owner", (q) => q.eq("ownerId", otherId))
        .collect();
    });

    expect(first).toEqual({ headings: 2, faqs: 0 });
    expect(second).toEqual({ headings: 0, faqs: 0 });
    const byCreation = [...headings].sort((a, b) => a._creationTime - b._creationTime);
    expect(byCreation.map((row) => [row.heading, row.position])).toEqual([
      ["Alpha", 0],
      ["Beta", 1],
    ]);
    const byPosition = [...faqs].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    expect(byPosition.map((row) => [row.question, row.position])).toEqual([
      ["Created second?", 0],
      ["Created first?", 1],
    ]);
  });
});
