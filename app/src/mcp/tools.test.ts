import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { MCP_WRITE_LIMIT } from "../../convex/lib/mcpWriteLimit";
import schema from "../../convex/schema";
import { modules } from "../../convex/test.setup";
import type { PageGateway } from "./pageGateway";
import { pageGateway } from "./pageGateway";
import {
  addFaq,
  addSubjectHeading,
  describePublicPage,
  editFaq,
  editSubjectHeading,
  getPageConfig,
  removeFaq,
  removeSubjectHeading,
  reorderFaqs,
  reorderSubjectHeadings,
  saveTheme,
  setEmbedAllowedOrigins,
  updateDisplayName,
  updateVanityName,
} from "./tools";

const OWNER = { subject: "owner-subject", email: "owner@example.com" };
const OTHER = { subject: "other-subject", email: "other@example.com" };

function testDb() {
  return convexTest({ schema, modules });
}

function gateway(
  t: ReturnType<typeof testDb>,
  identity: { subject: string; email: string },
): PageGateway {
  const client = t.withIdentity(identity);
  const query = client.query as (reference: unknown, args: unknown) => Promise<unknown>;
  const mutation = client.mutation as (reference: unknown, args: unknown) => Promise<unknown>;
  return pageGateway({ query, mutation });
}

async function seed(t: ReturnType<typeof testDb>, ownerPaid = false) {
  return t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      email: OWNER.email,
      workosUserId: OWNER.subject,
      vanityName: "owner",
      displayName: "Owner",
      isPaid: ownerPaid,
      createdAt: 1,
    });
    const otherId = await ctx.db.insert("users", {
      email: OTHER.email,
      workosUserId: OTHER.subject,
      vanityName: "other",
      displayName: "Other",
      isPaid: true,
      createdAt: 2,
    });
    return { ownerId, otherId };
  });
}

function textOf(result: { content: ReadonlyArray<{ type: string; text?: string }> }): string {
  const block = result.content[0];
  if (!block || block.type !== "text" || !block.text) throw new Error("expected text");
  return block.text;
}

function bodyOf(result: { content: ReadonlyArray<{ type: string; text?: string }> }): {
  [key: string]: unknown;
} {
  return JSON.parse(textOf(result)) as { [key: string]: unknown };
}

describe("MCP page tools", () => {
  it("reads only the signed-in owner's page", async () => {
    const t = testDb();
    const { ownerId, otherId } = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("subjectHeadings", { ownerId, heading: "Talks", position: 0 });
      await ctx.db.insert("subjectHeadings", { ownerId: otherId, heading: "Secret heading", position: 0 });
      await ctx.db.insert("faqs", {
        ownerId,
        question: "Where?",
        answer: "Here",
        position: 0,
      });
    });

    const config = bodyOf(await getPageConfig(gateway(t, OWNER)));
    expect(config.slug).toBe("owner");
    expect(config.accountEmail).toBe(OWNER.email);
    expect(config.publicPath).toBe("/send/owner");
    expect(config.publicIntro).toBe("Send a shortmail to Owner");
    expect(config.subjectHeadings).toEqual([
      expect.objectContaining({ heading: "Talks", position: 0 }),
    ]);
    expect(textOf(await getPageConfig(gateway(t, OTHER)))).not.toContain("Talks");
    expect(textOf(await getPageConfig(gateway(t, OWNER)))).not.toContain("Secret heading");
  });

  it("describes the public page and drops unsafe FAQ links", async () => {
    const t = testDb();
    const { ownerId } = await seed(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("faqs", {
        ownerId,
        question: "Book?",
        answer: "Use [Calendly](https://calendly.com/example) or [bad](javascript:alert(1)).",
        position: 0,
      });
    });

    const described = bodyOf(await describePublicPage(gateway(t, OWNER)));
    expect(described.intro).toBe("Send a shortmail to Owner");
    expect(described.path).toBe("/send/owner");
    const faqs = described.faqs as { links: { href: string; kept: boolean }[] }[];
    expect(faqs[0]?.links).toEqual([
      { href: "https://calendly.com/example", kept: true },
      { href: "javascript:alert(1)", kept: false },
    ]);
  });

  it("adds, edits, reorders, and removes a subject heading", async () => {
    const t = testDb();
    await seed(t, true);
    const owner = gateway(t, OWNER);

    const added = bodyOf(await addSubjectHeading(owner, "Second"));
    await addSubjectHeading(owner, "First");
    const headings = added.subjectHeadings as { id: string; heading: string }[];
    const second = headings.find((row) => row.heading === "Second");
    expect(second).toBeDefined();

    await editSubjectHeading(owner, second!.id, "Second edited");
    const before = bodyOf(await getPageConfig(owner));
    const rows = before.subjectHeadings as { id: string; heading: string }[];
    const ordered = bodyOf(
      await reorderSubjectHeadings(
        owner,
        [...rows].sort((a, b) => a.heading.localeCompare(b.heading)).map((row) => row.id),
      ),
    );
    expect(
      (ordered.subjectHeadings as { heading: string }[]).map((row) => row.heading),
    ).toEqual(["First", "Second edited"]);

    const target = (ordered.subjectHeadings as { id: string; heading: string }[])[0];
    const held = bodyOf(await removeSubjectHeading(owner, target.id, false));
    expect(held).toMatchObject({ deleted: false, needsConfirm: true });
    expect((await getPageConfig(owner)).isError).toBeUndefined();
    expect(textOf(await getPageConfig(owner))).toContain(target.heading);

    const removed = bodyOf(await removeSubjectHeading(owner, target.id, true));
    expect(removed).toEqual({ deleted: true, id: target.id });
    expect(textOf(await getPageConfig(owner))).not.toContain(target.heading);
  });

  it("adds, edits, reorders, and removes a FAQ", async () => {
    const t = testDb();
    await seed(t, true);
    const owner = gateway(t, OWNER);
    await addFaq(owner, "Second?", "B");
    const first = bodyOf(await addFaq(owner, "First?", "A"));
    const faqs = first.faqs as { id: string; question: string }[];
    const second = faqs.find((row) => row.question === "Second?");
    await editFaq(owner, second!.id, "Second edited?", "Still B");
    const current = bodyOf(await getPageConfig(owner));
    const rows = current.faqs as { id: string; question: string }[];
    const reordered = bodyOf(
      await reorderFaqs(
        owner,
        [...rows].reverse().map((row) => row.id),
      ),
    );
    expect((reordered.faqs as { question: string }[]).map((row) => row.question)).toEqual(
      [...rows].reverse().map((row) => row.question),
    );
    const removedRow = (reordered.faqs as { id: string; question: string }[])[0];
    expect(bodyOf(await removeFaq(owner, removedRow.id, false)).needsConfirm).toBe(true);
    expect(textOf(await getPageConfig(owner))).toContain(removedRow.question);
    await removeFaq(owner, removedRow.id, true);
    expect(textOf(await getPageConfig(owner))).not.toContain(removedRow.question);
  });

  it("rejects another owner's headings and FAQs", async () => {
    const t = testDb();
    const { ownerId, otherId } = await seed(t, true);
    const ids = await t.run(async (ctx) => {
      const heading = await ctx.db.insert("subjectHeadings", {
        ownerId,
        heading: "Keep me",
        position: 0,
      });
      const foreignHeading = await ctx.db.insert("subjectHeadings", {
        ownerId: otherId,
        heading: "Do not touch",
        position: 0,
      });
      const faq = await ctx.db.insert("faqs", {
        ownerId,
        question: "Mine?",
        answer: "Yes",
        position: 0,
      });
      const foreignFaq = await ctx.db.insert("faqs", {
        ownerId: otherId,
        question: "Theirs?",
        answer: "No",
        position: 0,
      });
      return { heading, foreignHeading, faq, foreignFaq };
    });
    const owner = gateway(t, OWNER);

    for (const result of [
      await editSubjectHeading(owner, ids.foreignHeading, "Stolen"),
      await removeSubjectHeading(owner, ids.foreignHeading, true),
      await reorderSubjectHeadings(owner, [ids.foreignHeading, ids.heading]),
      await editFaq(owner, ids.foreignFaq, "Stolen?", "Nope"),
      await removeFaq(owner, ids.foreignFaq, true),
      await reorderFaqs(owner, [ids.foreignFaq, ids.faq]),
    ]) {
      expect(result.isError).toBe(true);
      expect(textOf(result)).toBe("That item is not on your page.");
    }

    const dryRun = await removeSubjectHeading(owner, ids.foreignHeading, false);
    expect(dryRun.isError).toBe(true);
    expect(textOf(dryRun)).toBe("That item is not on your page.");

    const heading = await t.run(async (ctx) => ctx.db.get(ids.foreignHeading));
    const faq = await t.run(async (ctx) => ctx.db.get(ids.foreignFaq));
    const mine = await t.run(async (ctx) => ctx.db.get(ids.heading));
    expect(heading?.heading).toBe("Do not touch");
    expect(heading?.position).toBe(0);
    expect(faq?.question).toBe("Theirs?");
    expect(mine?.heading).toBe("Keep me");
    expect(mine?.position).toBe(0);
  });

  it("stops a free account at the heading and FAQ limits", async () => {
    const t = testDb();
    await seed(t, false);
    const owner = gateway(t, OWNER);
    for (const heading of ["a", "b", "c", "d", "e"]) {
      expect((await addSubjectHeading(owner, heading)).isError).toBeUndefined();
    }
    const blocked = await addSubjectHeading(owner, "f");
    expect(blocked.isError).toBe(true);
    expect(textOf(blocked)).toContain("5 subject headings");
    for (const question of ["1", "2", "3"]) {
      expect((await addFaq(owner, question, "answer")).isError).toBeUndefined();
    }
    const faqBlocked = await addFaq(owner, "4", "answer");
    expect(faqBlocked.isError).toBe(true);
    expect(textOf(faqBlocked)).toContain("3 FAQs");
  });

  it("rate-limits writes and does not count reads", async () => {
    const t = testDb();
    await seed(t, true);
    const owner = gateway(t, OWNER);
    for (let i = 0; i < 5; i += 1) {
      expect((await getPageConfig(owner)).isError).toBeUndefined();
    }
    for (let i = 0; i < MCP_WRITE_LIMIT; i += 1) {
      const result = await addSubjectHeading(owner, `h${i}`);
      expect(result.isError, textOf(result)).toBeUndefined();
    }
    const limited = await addSubjectHeading(owner, "too many");
    expect(limited.isError).toBe(true);
    expect(textOf(limited)).toBe("Too many page changes. Wait a minute and try again.");
    const config = bodyOf(await getPageConfig(owner));
    expect(config.subjectHeadings).toHaveLength(MCP_WRITE_LIMIT);
  });

  it("updates the display name, vanity, embed origins, and theme", async () => {
    const t = testDb();
    await seed(t, true);
    const owner = gateway(t, OWNER);

    const named = bodyOf(await updateDisplayName(owner, "Ada Lovelace"));
    expect(named.publicIntro).toBe("Send a shortmail to Ada Lovelace");

    const renamed = bodyOf(await updateVanityName(owner, "Ada_Page"));
    expect(renamed.slug).toBe("ada_page");
    expect(renamed.publicPath).toBe("/send/ada_page");

    const taken = await updateVanityName(owner, "other");
    expect(taken.isError).toBe(true);
    expect(textOf(taken)).toBe("That vanity name is already taken.");

    const origins = bodyOf(
      await setEmbedAllowedOrigins(owner, [
        "https://example.com/",
        "http://evil.example",
        "http://localhost:3000",
      ]),
    );
    expect(origins.embedAllowedOrigins).toEqual([
      "https://example.com",
      "http://localhost:3000",
    ]);

    const theme = bodyOf(
      await saveTheme(
        owner,
        "midnight",
        "button { background: #111; color: white; letter-spacing: 0.02em; }",
      ),
    );
    expect(theme.theme).toMatchObject({ tier: "premium", preset: "midnight" });
    expect(JSON.stringify(theme.theme)).toContain("#111");

    const unknown = await saveTheme(owner, "neon", undefined);
    expect(unknown.isError).toBe(true);
    expect(textOf(unknown)).toContain("Unknown theme preset");
  });

  it("keeps paid settings on a free account unchanged", async () => {
    const t = testDb();
    await seed(t, false);
    const owner = gateway(t, OWNER);
    for (const result of [
      await updateVanityName(owner, "newname"),
      await setEmbedAllowedOrigins(owner, ["https://example.com"]),
      await saveTheme(owner, "midnight", undefined),
    ]) {
      expect(result.isError).toBe(true);
      expect(textOf(result)).toBe("That setting is available on a paid account.");
    }
    const config = bodyOf(await getPageConfig(owner));
    expect(config.slug).toBe("owner");
    expect(config.theme).toEqual({ tier: "free" });
  });

  it("registers no letter tool", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("./tools.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/sendShortmail|submitSend/);
    expect(source).toContain("destructiveHint: true");
    expect(source).toContain("reorder_subject_headings");
    expect(source).toContain("reorder_faqs");
  });
});
