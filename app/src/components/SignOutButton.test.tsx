import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const buttonSource = readFileSync(
  new URL("./SignOutButton.tsx", import.meta.url),
  "utf8",
);
const dashboardSource = readFileSync(
  new URL("../app/dashboard/page.tsx", import.meta.url),
  "utf8",
);

describe("dashboard sign-out", () => {
  it("posts the AuthKit signOut action from the dashboard", () => {
    expect(buttonSource).toContain('from "@workos-inc/authkit-nextjs"');
    expect(buttonSource).toContain("signOut");
    expect(buttonSource).toContain("<form");
    expect(buttonSource).toContain('type="submit"');
    expect(buttonSource).toMatch(/>\s*Sign out\s*</);
    expect(buttonSource).toContain("min-h-11");
    expect(buttonSource).toContain("text-foreground");
    expect(buttonSource).not.toContain("text-[#171717]");
    expect(buttonSource).not.toContain("outline-[#171717]");
    expect(buttonSource).not.toContain("localStorage");
    expect(buttonSource).not.toContain("sessionStorage");
    expect(buttonSource).not.toContain('method="GET"');
    expect(buttonSource).not.toContain('method="get"');

    expect(dashboardSource).toContain("<SignOutButton />");
    expect(dashboardSource).toContain("Signed in as");
    expect(dashboardSource).not.toContain('href="/logout"');
    expect(dashboardSource).not.toContain('href="/sign-out"');
  });

  it("does not add a GET sign-out route or a second stored session", () => {
    expect(buttonSource).not.toContain("document.cookie");
    expect(dashboardSource).not.toContain("switchToOrganization");
    expect(dashboardSource).not.toContain("Add account");
    for (const route of ["logout", "sign-out", "signout"]) {
      expect(
        existsSync(new URL(`../app/${route}/route.ts`, import.meta.url)),
      ).toBe(false);
    }
    const provider = readFileSync(
      new URL("./ConvexClientProvider.tsx", import.meta.url),
      "utf8",
    );
    expect(provider).not.toContain("localStorage");
    expect(provider).toContain("if (!user) return null");
  });
});
