import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { faqAnswerLinkDecisions } from "@/widget/faqAnswer";
import { PageActionError, pageErrorMessage } from "./errors";
import type { PageGateway } from "./pageGateway";

const READ = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const WRITE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

const IDEMPOTENT = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const DESTROY = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const INSTRUCTIONS =
  "ShortMail configuration for the signed-in page owner only. " +
  "You cannot read or send letters. Every change applies to the authenticated owner's page. " +
  "Removing a heading or FAQ does nothing unless confirm is true. " +
  "FAQ answers are markdown. The public page keeps http(s) and mailto links and drops every other link, leaving the link text. " +
  "Subject headings and FAQs are ordered lists. Pass every id, in the order they should appear. " +
  "A free account stores 5 headings and 3 FAQs. Vanity name, theme, and embed origins require a paid account. " +
  "There is no separate intro field. The public page says \"Send a shortmail to\" plus the display name.";

/**
 * Register the configuration tools on one server instance.
 *
 * :param server: Fresh server for this HTTP request.
 * :param gateway: Convex client already authenticated as the owner.
 */
export function registerPageTools(server: McpServer, gateway: PageGateway): void {
  server.registerTool(
    "get_page_config",
    {
      title: "Get page config",
      description:
        "Read the signed-in owner's page: slug, display name, account email, ordered subject headings, ordered FAQs, theme, and embed origins. Ids are for later edits. They are not shown on the public page.",
      annotations: READ,
    },
    async () => getPageConfig(gateway),
  );

  server.registerTool(
    "describe_public_page",
    {
      title: "Describe the public page",
      description:
        "Describe what visitors see at /send/<slug>: the intro line, subject headings in order, and FAQ questions and markdown answers. Each link is marked kept or dropped using the same safe-link rule as the dashboard. Does not include letter contents.",
      annotations: READ,
    },
    async () => describePublicPage(gateway),
  );

  server.registerTool(
    "add_subject_heading",
    {
      title: "Add subject heading",
      description:
        "Add a subject heading at the end of the signed-in owner's list. Visitors pick a heading when they write. A free account stops at 5.",
      inputSchema: { heading: z.string() },
      annotations: WRITE,
    },
    async ({ heading }) => addSubjectHeading(gateway, heading),
  );

  server.registerTool(
    "edit_subject_heading",
    {
      title: "Edit subject heading",
      description:
        "Replace the text of one of the signed-in owner's subject headings. The id comes from get_page_config. Another owner's id is rejected.",
      inputSchema: { id: z.string(), heading: z.string() },
      annotations: IDEMPOTENT,
    },
    async ({ id, heading }) => editSubjectHeading(gateway, id, heading),
  );

  server.registerTool(
    "remove_subject_heading",
    {
      title: "Remove subject heading",
      description:
        "Delete one of the signed-in owner's subject headings. This cannot be undone. Pass confirm true to delete. Any other confirm value returns the heading and deletes nothing. Another owner's id is rejected.",
      inputSchema: { id: z.string(), confirm: z.boolean() },
      annotations: DESTROY,
    },
    async ({ id, confirm }) => removeSubjectHeading(gateway, id, confirm),
  );

  server.registerTool(
    "reorder_subject_headings",
    {
      title: "Reorder subject headings",
      description:
        "Set the display order of the signed-in owner's subject headings. Pass every current id, first to last. An id from another owner is rejected and nothing is reordered. An id that was just deleted is skipped. A heading added since the last read stays at the end.",
      inputSchema: { ids: z.array(z.string()) },
      annotations: IDEMPOTENT,
    },
    async ({ ids }) => reorderSubjectHeadings(gateway, ids),
  );

  server.registerTool(
    "add_faq",
    {
      title: "Add FAQ",
      description:
        "Add a FAQ at the end of the signed-in owner's list. The answer is markdown. The public page keeps http(s) and mailto links and drops other links, the same rule as the dashboard. A free account stops at 3 FAQs.",
      inputSchema: { question: z.string(), answer: z.string() },
      annotations: WRITE,
    },
    async ({ question, answer }) => addFaq(gateway, question, answer),
  );

  server.registerTool(
    "edit_faq",
    {
      title: "Edit FAQ",
      description:
        "Replace the question and markdown answer of one of the signed-in owner's FAQs. Unsafe links are stored and dropped when the page renders. Another owner's id is rejected.",
      inputSchema: { id: z.string(), question: z.string(), answer: z.string() },
      annotations: IDEMPOTENT,
    },
    async ({ id, question, answer }) => editFaq(gateway, id, question, answer),
  );

  server.registerTool(
    "remove_faq",
    {
      title: "Remove FAQ",
      description:
        "Delete one of the signed-in owner's FAQs. This cannot be undone. Pass confirm true to delete. Any other confirm value returns the FAQ and deletes nothing. Another owner's id is rejected.",
      inputSchema: { id: z.string(), confirm: z.boolean() },
      annotations: DESTROY,
    },
    async ({ id, confirm }) => removeFaq(gateway, id, confirm),
  );

  server.registerTool(
    "reorder_faqs",
    {
      title: "Reorder FAQs",
      description:
        "Set the display order of the signed-in owner's FAQs. Pass every current id, first to last. An id from another owner is rejected and nothing is reordered.",
      inputSchema: { ids: z.array(z.string()) },
      annotations: IDEMPOTENT,
    },
    async ({ ids }) => reorderFaqs(gateway, ids),
  );

  server.registerTool(
    "update_display_name",
    {
      title: "Update display name",
      description:
        "Set the name visitors see. The public page introduces the owner as \"Send a shortmail to\" plus this name. Empty names are rejected.",
      inputSchema: { displayName: z.string() },
      annotations: IDEMPOTENT,
    },
    async ({ displayName }) => updateDisplayName(gateway, displayName),
  );

  server.registerTool(
    "update_vanity_name",
    {
      title: "Update vanity name",
      description:
        "Change the paid account's public slug, the path segment in /send/<slug>. Lowercase letters, numbers, dashes, and underscores. A free account cannot change it.",
      inputSchema: { vanityName: z.string() },
      annotations: IDEMPOTENT,
    },
    async ({ vanityName }) => updateVanityName(gateway, vanityName),
  );

  server.registerTool(
    "set_embed_allowed_origins",
    {
      title: "Set embed origins",
      description:
        "Replace the paid account's embed allow-list. Origins must be https, or http://localhost for development. Other entries are dropped. At most 20 are kept. An empty list means the form may be embedded anywhere. A free account cannot set this.",
      inputSchema: { origins: z.array(z.string()) },
      annotations: IDEMPOTENT,
    },
    async ({ origins }) => setEmbedAllowedOrigins(gateway, origins),
  );

  server.registerTool(
    "save_theme",
    {
      title: "Save theme",
      description:
        "Save the paid account's theme preset and optional custom CSS. Presets are default, midnight, paper, and contrast. Custom CSS is sanitized with the same rules as the theming page. The result is the CSS that was stored. A free account cannot set a theme.",
      inputSchema: { preset: z.string(), customCss: z.string().optional() },
      annotations: IDEMPOTENT,
    },
    async ({ preset, customCss }) => saveTheme(gateway, preset, customCss),
  );
}

export { INSTRUCTIONS };

export async function getPageConfig(gateway: PageGateway): Promise<CallToolResult> {
  try {
    return ok(await gateway.getConfig());
  } catch (error) {
    return fail(error);
  }
}

export async function describePublicPage(gateway: PageGateway): Promise<CallToolResult> {
  try {
    const config = await gateway.getConfig();
    return ok({
      path: config.publicPath,
      intro: config.publicIntro,
      displayName: config.displayName,
      subjectHeadings: config.subjectHeadings.map((row) => row.heading),
      faqs: config.faqs.map((faq) => ({
        question: faq.question,
        answer: faq.answer,
        links: faqAnswerLinkDecisions(faq.answer),
      })),
      theme: config.theme,
      note:
        "Links with kept false are removed when the public page renders. The link text stays. This is the same rule as the dashboard. Letters are not available from this server.",
    });
  } catch (error) {
    return fail(error);
  }
}

export async function addSubjectHeading(
  gateway: PageGateway,
  heading: string,
): Promise<CallToolResult> {
  if (!heading.trim()) return fail(new PageActionError("heading_required"));
  try {
    const created = await gateway.addSubjectHeading(heading);
    const config = await gateway.getConfig();
    return ok({ added: created, subjectHeadings: config.subjectHeadings });
  } catch (error) {
    return fail(error);
  }
}

export async function editSubjectHeading(
  gateway: PageGateway,
  id: string,
  heading: string,
): Promise<CallToolResult> {
  if (!heading.trim()) return fail(new PageActionError("heading_required"));
  try {
    await gateway.editSubjectHeading(id, heading);
    const config = await gateway.getConfig();
    return ok({ subjectHeadings: config.subjectHeadings });
  } catch (error) {
    return fail(error);
  }
}

export async function removeSubjectHeading(
  gateway: PageGateway,
  id: string,
  confirm: boolean,
): Promise<CallToolResult> {
  try {
    if (confirm !== true) {
      const config = await gateway.getConfig();
      const item = config.subjectHeadings.find((row) => row.id === id);
      if (!item) return fail(new PageActionError("NOT_FOUND"));
      return ok({ deleted: false, needsConfirm: true, item });
    }
    await gateway.removeSubjectHeading(id);
    return ok({ deleted: true, id });
  } catch (error) {
    return fail(error);
  }
}

export async function reorderSubjectHeadings(
  gateway: PageGateway,
  ids: string[],
): Promise<CallToolResult> {
  try {
    await gateway.reorderSubjectHeadings(ids);
    const config = await gateway.getConfig();
    return ok({ subjectHeadings: config.subjectHeadings });
  } catch (error) {
    return fail(error);
  }
}

export async function addFaq(
  gateway: PageGateway,
  question: string,
  answer: string,
): Promise<CallToolResult> {
  if (!question.trim() || !answer.trim()) return fail(new PageActionError("faq_fields_required"));
  try {
    const created = await gateway.addFaq(question, answer);
    const config = await gateway.getConfig();
    return ok({ added: created, faqs: config.faqs });
  } catch (error) {
    return fail(error);
  }
}

export async function editFaq(
  gateway: PageGateway,
  id: string,
  question: string,
  answer: string,
): Promise<CallToolResult> {
  if (!question.trim() || !answer.trim()) return fail(new PageActionError("faq_fields_required"));
  try {
    await gateway.editFaq(id, question, answer);
    const config = await gateway.getConfig();
    return ok({ faqs: config.faqs });
  } catch (error) {
    return fail(error);
  }
}

export async function removeFaq(
  gateway: PageGateway,
  id: string,
  confirm: boolean,
): Promise<CallToolResult> {
  try {
    if (confirm !== true) {
      const config = await gateway.getConfig();
      const item = config.faqs.find((row) => row.id === id);
      if (!item) return fail(new PageActionError("NOT_FOUND"));
      return ok({ deleted: false, needsConfirm: true, item });
    }
    await gateway.removeFaq(id);
    return ok({ deleted: true, id });
  } catch (error) {
    return fail(error);
  }
}

export async function reorderFaqs(gateway: PageGateway, ids: string[]): Promise<CallToolResult> {
  try {
    await gateway.reorderFaqs(ids);
    const config = await gateway.getConfig();
    return ok({ faqs: config.faqs });
  } catch (error) {
    return fail(error);
  }
}

export async function updateDisplayName(
  gateway: PageGateway,
  displayName: string,
): Promise<CallToolResult> {
  if (!displayName.trim()) return fail(new PageActionError("display_name_required"));
  try {
    await gateway.updateDisplayName(displayName);
    const config = await gateway.getConfig();
    return ok({
      displayName: config.displayName,
      publicIntro: config.publicIntro,
    });
  } catch (error) {
    return fail(error);
  }
}

export async function updateVanityName(
  gateway: PageGateway,
  vanityName: string,
): Promise<CallToolResult> {
  try {
    await gateway.updateVanityName(vanityName);
    const config = await gateway.getConfig();
    return ok({ slug: config.slug, publicPath: config.publicPath });
  } catch (error) {
    return fail(error);
  }
}

export async function setEmbedAllowedOrigins(
  gateway: PageGateway,
  origins: string[],
): Promise<CallToolResult> {
  try {
    const stored = await gateway.setEmbedAllowedOrigins(origins);
    return ok({ embedAllowedOrigins: stored });
  } catch (error) {
    return fail(error);
  }
}

export async function saveTheme(
  gateway: PageGateway,
  preset: string,
  customCss?: string,
): Promise<CallToolResult> {
  try {
    await gateway.saveTheme(preset, customCss);
    const config = await gateway.getConfig();
    return ok({ theme: config.theme });
  } catch (error) {
    return fail(error);
  }
}

function ok(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function fail(error: unknown): CallToolResult {
  const code = error instanceof PageActionError ? error.code : "REJECTED";
  return {
    isError: true,
    content: [{ type: "text", text: pageErrorMessage(code) }],
  };
}
