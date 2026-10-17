/**
 * The [RN]/[NRN] subject-tag protocol, owned here (codebase-design review
 * finding 5). Writers (send flow) tag; readers (analytics) parse. The
 * grammar is frozen — already-stored rows keep the exact format below.
 */

export type TaggedSubject = { name: string; replyNeeded: boolean };

export function tagSubject(subject: string, replyNeeded: boolean): string {
  return `${replyNeeded ? "[RN]" : "[NRN]"} ${subject}`;
}

/** Legacy/untagged subjects parse as replyNeeded=false. */
export function parseSubjectTag(stored: string | undefined): TaggedSubject {
  const match = stored?.match(/^\[(RN|NRN)\]\s*(.*)$/);
  if (match) return { name: match[2], replyNeeded: match[1] === "RN" };
  return { name: stored ?? "", replyNeeded: false };
}
