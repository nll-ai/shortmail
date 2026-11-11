import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { PageActionError, pageErrorCode } from "./errors";

export type HeadingRecord = {
  id: string;
  heading: string;
  position: number | null;
};

export type FaqRecord = {
  id: string;
  question: string;
  answer: string;
  position: number | null;
};

export type ThemeRecord =
  | { tier: "free" }
  | { tier: "premium"; preset: string; customCss: string | null };

export type PageConfig = {
  accountEmail: string;
  slug: string;
  displayName: string;
  publicPath: string;
  publicIntro: string;
  isPaid: boolean;
  embedAllowedOrigins: string[];
  theme: ThemeRecord;
  subjectHeadings: HeadingRecord[];
  faqs: FaqRecord[];
};

export type ConvexCaller = {
  query: (reference: unknown, args: unknown) => Promise<unknown>;
  mutation: (reference: unknown, args: unknown) => Promise<unknown>;
};

type MeRow = {
  email: string;
  vanityName: string;
  displayName?: string;
  isPaid: boolean;
  embedAllowedOrigins: string[];
};

type HeadingRow = { _id: string; heading: string; position?: number };
type FaqRow = { _id: string; question: string; answer: string; position?: number };
type ThemeRow =
  | { tier: "free" }
  | { tier: "premium"; preset: string; customCss: string | null }
  | null;

/**
 * Calls the same Convex queries and mutations the dashboard uses.
 *
 * The caller is whoever Convex authenticated. There is no owner id argument.
 */
export type PageGateway = {
  getConfig: () => Promise<PageConfig>;
  addSubjectHeading: (heading: string) => Promise<{ id: string }>;
  editSubjectHeading: (id: string, heading: string) => Promise<void>;
  removeSubjectHeading: (id: string) => Promise<void>;
  reorderSubjectHeadings: (ids: string[]) => Promise<void>;
  addFaq: (question: string, answer: string) => Promise<{ id: string }>;
  editFaq: (id: string, question: string, answer: string) => Promise<void>;
  removeFaq: (id: string) => Promise<void>;
  reorderFaqs: (ids: string[]) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updateVanityName: (vanityName: string) => Promise<void>;
  setEmbedAllowedOrigins: (origins: string[]) => Promise<string[]>;
  saveTheme: (preset: string, customCss?: string) => Promise<void>;
};

/**
 * Adapt a Convex client that is already authenticated as one owner.
 *
 * :param client: `ConvexHttpClient` after `setAuth`, or a convex-test identity.
 * :returns: Page operations. Writes charge the MCP rate limit first.
 */
export function pageGateway(client: ConvexCaller): PageGateway {
  return {
    getConfig: () => readConfig(client),
    addSubjectHeading: (heading) =>
      write(client, async () => {
        const id = await client.mutation(api.forms.addSubjectHeading, { heading });
        return { id: String(id) };
      }),
    editSubjectHeading: (id, heading) =>
      write(client, async () => {
        await client.mutation(api.forms.editSubjectHeading, { id, heading });
      }),
    removeSubjectHeading: (id) =>
      write(client, async () => {
        await client.mutation(api.forms.removeSubjectHeading, { id });
      }),
    reorderSubjectHeadings: (ids) =>
      write(client, async () => {
        await client.mutation(api.forms.reorderSubjectHeadings, { ids });
      }),
    addFaq: (question, answer) =>
      write(client, async () => {
        const id = await client.mutation(api.forms.addFaq, { question, answer });
        return { id: String(id) };
      }),
    editFaq: (id, question, answer) =>
      write(client, async () => {
        await client.mutation(api.forms.editFaq, { id, question, answer });
      }),
    removeFaq: (id) =>
      write(client, async () => {
        await client.mutation(api.forms.removeFaq, { id });
      }),
    reorderFaqs: (ids) =>
      write(client, async () => {
        await client.mutation(api.forms.reorderFaqs, { ids });
      }),
    updateDisplayName: (displayName) =>
      write(client, async () => {
        await client.mutation(api.forms.updateDisplayName, { displayName });
      }),
    updateVanityName: (vanityName) =>
      write(client, async () => {
        await client.mutation(api.forms.updateVanityName, { vanityName });
      }),
    setEmbedAllowedOrigins: (origins) =>
      write(client, async () => {
        const cleaned = await client.mutation(api.users.setEmbedAllowedOrigins, { origins });
        return cleaned as string[];
      }),
    saveTheme: (preset, customCss) =>
      write(client, async () => {
        await client.mutation(api.theming.saveTheme, { preset, customCss });
      }),
  };
}

/**
 * HTTP client for the deployment this Next.js process was built against.
 *
 * :param convexUrl: Deployment URL (`*.convex.cloud`).
 * :param accessToken: AuthKit access token already verified for this resource.
 * :returns: Gateway bound to that token's user.
 */
export function convexPageGateway(convexUrl: string, accessToken: string): PageGateway {
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(accessToken);
  return pageGateway({
    query: (reference, args) =>
      (client.query as (reference: unknown, args: unknown) => Promise<unknown>)(reference, args),
    mutation: (reference, args) =>
      (client.mutation as (reference: unknown, args: unknown) => Promise<unknown>)(reference, args),
  });
}

async function readConfig(client: ConvexCaller): Promise<PageConfig> {
  return call(async () => {
    await client.mutation(api.users.ensureMe, {});
    const [me, headings, faqs, theme] = await Promise.all([
      client.query(api.users.me, {}) as Promise<MeRow | null>,
      client.query(api.forms.myHeadings, {}) as Promise<HeadingRow[]>,
      client.query(api.forms.myFaqs, {}) as Promise<FaqRow[]>,
      client.query(api.theming.myTheme, {}) as Promise<ThemeRow>,
    ]);
    if (!me) throw new PageActionError("Unauthenticated");
    const displayName = me.displayName?.trim() ? me.displayName : me.email;
    return {
      accountEmail: me.email,
      slug: me.vanityName,
      displayName,
      publicPath: `/send/${me.vanityName}`,
      publicIntro: `Send a shortmail to ${displayName}`,
      isPaid: me.isPaid,
      embedAllowedOrigins: me.embedAllowedOrigins,
      theme: theme?.tier === "premium"
        ? { tier: "premium", preset: theme.preset, customCss: theme.customCss }
        : { tier: "free" },
      subjectHeadings: headings.map((row) => ({
        id: row._id,
        heading: row.heading,
        position: row.position ?? null,
      })),
      faqs: faqs.map((row) => ({
        id: row._id,
        question: row.question,
        answer: row.answer,
        position: row.position ?? null,
      })),
    };
  });
}

async function write<T>(client: ConvexCaller, fn: () => Promise<T>): Promise<T> {
  return call(async () => {
    await client.mutation(api.users.ensureMe, {});
    await client.mutation(api.mcp.consumeWrite, {});
    return fn();
  });
}

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof PageActionError) throw error;
    throw new PageActionError(pageErrorCode(error));
  }
}
