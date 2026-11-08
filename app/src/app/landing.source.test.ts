import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "./page";

const PRIVACY =
  "The letter is delivered as email to you. ShortMail does not keep the letter body in its database. The visitor's name and email are required, and both are on the email you receive, so the visitor is not anonymous. ShortMail does not put a copy in the visitor's sent folder. It does store the subject, including whether a reply was requested, and aggregate events for page views and successful sends. Before a letter can be delivered, the visitor proves they can open that inbox. ShortMail stores a hash of the address and a hash of that browser's proof for up to 30 days, not a copy of the letter.";

describe("homepage", () => {
  it("offers two account links and the approved copy", () => {
    const html = renderToStaticMarkup(createElement(Home));
    const create = html.match(
      /<a[^>]*href="\/dashboard"[^>]*>Create your page<\/a>/g,
    );
    const signIn = html.match(
      /<a[^>]*href="\/dashboard"[^>]*>Sign in<\/a>/g,
    );

    expect(create).toHaveLength(1);
    expect(signIn).toHaveLength(1);
    expect(html.replaceAll("&#x27;", "'")).toContain(PRIVACY);
    expect(html).toContain(
      "Visitors see those answers under the questions on the letter page.",
    );
    expect(html).toContain("189/500");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("shortmail-widget");
    expect(html).not.toContain("cce87ae9c1d7");
  });

  it("does not import the live send demo", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(source).toContain("min-h-11");
    expect(source).toContain("focus-visible:outline-2");
    expect(source).toContain(
      'fontFamily: "var(--font-geist-sans), sans-serif"',
    );
    expect(source).not.toContain("LandingLetter");
    expect(source).not.toContain("sendUrl");
    expect(source).not.toContain("configUrl");
    expect(source).not.toContain("shortmail-widget");
    expect(
      existsSync(new URL("../components/LandingLetter.tsx", import.meta.url)),
    ).toBe(false);
  });

  it("leaves the widget send path and shared files unchanged", () => {
    const widget = readFileSync(
      new URL("../widget/shortmail-widget.ts", import.meta.url),
      "utf8",
    );
    expect(widget).toContain("/api/send/");
    expect(widget).toContain("session_secret");

    const repoRoot = new URL("../../..", import.meta.url);
    // CI fetches refs/remotes/origin/main without touching a checked-out main.
    // Local runs fall back to main when origin/main is absent.
    const hasOriginMain =
      spawnSync("git", ["rev-parse", "--verify", "refs/remotes/origin/main"], {
        cwd: repoRoot,
        encoding: "utf8",
      }).status === 0;
    const base = hasOriginMain ? "origin/main" : "main";
    const diff = spawnSync(
      "git",
      [
        "diff",
        base,
        "--",
        "app/src/widget/formSkin.ts",
        "app/src/app/layout.tsx",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    expect(diff.status).toBe(0);
    expect(diff.stdout).toBe("");
  });
});
