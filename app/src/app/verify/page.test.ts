import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import VerifyPage from "./page";

describe("verify page", () => {
  it("tells the visitor to paste the code back into the form", () => {
    const html = renderToStaticMarkup(createElement(VerifyPage));
    expect(html).toContain("paste this code");
    expect(html).toContain("does not send the letter");
    expect(html).toContain("Copy your code");
  });
});
