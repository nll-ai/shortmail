import { marked } from "marked";

const ALLOWED = new Set(["P", "BR", "A", "STRONG", "EM", "UL", "OL", "LI", "CODE"]);

/**
 * Escape raw tags before markdown runs.
 *
 * :param value: Owner-authored FAQ answer.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Keep only absolute http(s) and mailto targets.
 *
 * :param raw: Href taken from parsed markdown.
 */
export function safeFaqHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;
  const compact = href.replace(/[\u0000-\u0020]+/g, "").toLowerCase();
  if (
    compact.startsWith("javascript:") ||
    compact.startsWith("data:") ||
    compact.startsWith("vbscript:")
  ) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const protocol = url.protocol.toLowerCase();
  if (protocol === "http:" || protocol === "https:") {
    if (url.username || url.password) return null;
    return url.href;
  }
  if (protocol === "mailto:") {
    if (!url.pathname.includes("@")) return null;
    return url.href;
  }
  return null;
}

function sanitizeChildren(node: ParentNode): Node[] {
  const out: Node[] = [];
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) {
      out.push(document.createTextNode(child.textContent ?? ""));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as HTMLElement;
    if (!ALLOWED.has(el.tagName)) {
      out.push(...sanitizeChildren(el));
      continue;
    }
    if (el.tagName === "BR") {
      out.push(document.createElement("br"));
      continue;
    }
    if (el.tagName === "A") {
      const href = safeFaqHref(el.getAttribute("href") ?? "");
      if (!href) {
        out.push(...sanitizeChildren(el));
        continue;
      }
      const link = document.createElement("a");
      link.href = href;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.append(...sanitizeChildren(el));
      out.push(link);
      continue;
    }
    const next = document.createElement(el.tagName.toLowerCase());
    next.append(...sanitizeChildren(el));
    out.push(next);
  }
  return out;
}

/**
 * Render an FAQ answer as inert nodes: markdown structure and safe links.
 *
 * Question text must not be passed here. Callers set that with textContent.
 *
 * :param answer: Markdown answer stored for the FAQ.
 */
export function renderFaqAnswer(answer: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const html = marked.parse(escapeHtml(answer), { async: false }) as string;
  const parsed = new DOMParser().parseFromString(html, "text/html");
  fragment.append(...sanitizeChildren(parsed.body));
  return fragment;
}
