/**
 * The single spelling of the public embed-config contract (codebase-design
 * review, finding 9): convex/public.ts validates against it (`returns:`),
 * SendForm declares it, the send page imports it — one shape, one owner.
 */

export type EmbedConfig = {
  vanityName: string;
  displayName: string;
  headings: string[];
  faqs: { question: string; answer: string }[];
  isPaid: boolean;
  theme: { preset: string; customCss: string | null } | null;
};
