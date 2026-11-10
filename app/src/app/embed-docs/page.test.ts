import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EmbedDocsPage from "./page";

describe("embed docs", () => {
  it("shows the canonical widget snippet", () => {
    const html = renderToStaticMarkup(createElement(EmbedDocsPage));

    expect(html).toContain(
      "src=&quot;https://shortmail.nonlinearlabs.ai/widget.js&quot;",
    );
    expect(html).not.toContain(
      "src=&quot;https://shortmail-gamma.vercel.app/widget.js&quot;",
    );
    expect(html).toContain("DNS has not been cut over");
  });
});
