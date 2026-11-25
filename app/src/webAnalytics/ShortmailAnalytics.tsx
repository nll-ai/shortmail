"use client";

import { Analytics } from "@vercel/analytics/next";
import { beforeSendAnalytics } from "./beforeSend";

/**
 * Mount Vercel Web Analytics once for the App Router tree.
 *
 * `beforeSend` is a function prop, so this wrapper must be a client
 * component. Third-party embeds load `/widget.js` only and never render
 * this tree.
 */
export function ShortmailAnalytics() {
  return <Analytics beforeSend={beforeSendAnalytics} />;
}
