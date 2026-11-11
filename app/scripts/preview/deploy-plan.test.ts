import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSnapshotSize,
  buildPlan,
  classifyBuild,
  previewOrigin,
  shouldHydrate,
  writePreviewEnvFile,
} from "./deploy-plan.mjs";

const previewEnv = {
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "feat/widgets",
  VERCEL_BRANCH_URL: "shortmail-git-feat-widgets-eric-mas-projects-a230afd1.vercel.app",
  CONVEX_DEPLOY_KEY: "preview:team:shortmail|preview-token",
  CONVEX_PROD_DEPLOY_KEY: "prod:hallowed-leopard-387|prod-token",
  WORKOS_CLIENT_ID: "client_test",
  SUPER_ADMIN_EMAIL: "eric@example.com",
  SHORTMAIL_EMAIL_ALLOWLIST: "eric@example.com",
};

describe("classifyBuild", () => {
  it("keeps a local build local when no deploy key is set", () => {
    expect(classifyBuild({})).toEqual({ kind: "local" });
  });

  it("refuses a Vercel build with no key and a preview build with a prod key", () => {
    expect(classifyBuild({ VERCEL: "1" }).kind).toBe("refuse");
    expect(
      classifyBuild({
        VERCEL: "1",
        VERCEL_ENV: "preview",
        CONVEX_DEPLOY_KEY: "prod:hallowed-leopard-387|token",
      }).kind,
    ).toBe("refuse");
    expect(
      classifyBuild({
        VERCEL: "1",
        VERCEL_ENV: "production",
        CONVEX_DEPLOY_KEY: "preview:team:shortmail|token",
      }).kind,
    ).toBe("refuse");
  });

  it("accepts the matching key for each Vercel environment", () => {
    expect(classifyBuild(previewEnv).kind).toBe("preview");
    expect(
      classifyBuild({
        VERCEL: "1",
        VERCEL_ENV: "production",
        CONVEX_DEPLOY_KEY: "prod:hallowed-leopard-387|token",
      }).kind,
    ).toBe("production");
  });
});

describe("previewOrigin", () => {
  it("uses the branch alias and rejects production hosts", () => {
    expect(previewOrigin(previewEnv)).toEqual({
      ok: true,
      origin: "https://shortmail-git-feat-widgets-eric-mas-projects-a230afd1.vercel.app",
    });
    expect(
      previewOrigin({
        VERCEL_BRANCH_URL: "shortmail.nonlinearlabs.ai",
      }).ok,
    ).toBe(false);
    expect(previewOrigin({ VERCEL_URL: "shortmail-gamma.vercel.app" }).ok).toBe(false);
  });
});

describe("shouldHydrate", () => {
  it("copies on creation, every push, or never", () => {
    expect(shouldHydrate("on-create", false)).toBe(true);
    expect(shouldHydrate("on-create", true)).toBe(false);
    expect(shouldHydrate("always", true)).toBe(true);
    expect(shouldHydrate("skip", false)).toBe(false);
  });
});

describe("assertSnapshotSize", () => {
  it("rejects an empty or oversized snapshot", () => {
    expect(() => assertSnapshotSize(0, 100)).toThrow(/empty/);
    expect(() => assertSnapshotSize(101, 100)).toThrow(/over the 100 byte limit/);
    expect(() => assertSnapshotSize(100, 100)).not.toThrow();
  });
});

describe("buildPlan", () => {
  it("plans a preview without copying secret values into the plan", () => {
    const plan = buildPlan(previewEnv);
    expect(plan).toMatchObject({
      kind: "preview",
      previewName: "feat/widgets",
      hydrateMode: "on-create",
      scrub: false,
      removeResend: true,
    });
    expect(JSON.stringify(plan)).not.toContain("prod-token");
    expect(JSON.stringify(plan)).not.toContain("preview-token");
  });

  it("refuses a sink that is not allowlisted and a missing production export key", () => {
    expect(
      buildPlan({ ...previewEnv, SHORTMAIL_PREVIEW_EMAIL_SINK: "other@example.com" }).kind,
    ).toBe("refuse");
    const { CONVEX_PROD_DEPLOY_KEY: _ignored, ...withoutProd } = previewEnv;
    expect(buildPlan(withoutProd).kind).toBe("refuse");
    expect(buildPlan({ ...withoutProd, SHORTMAIL_PREVIEW_HYDRATE: "skip" }).kind).toBe(
      "preview",
    );
  });
});

describe("writePreviewEnvFile", () => {
  it("sets preview mode and never writes the production Resend key", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "shortmail-env-"));
    const destination = path.join(directory, "preview.env");
    try {
      writePreviewEnvFile(
        {
          ...previewEnv,
          RESEND_API_KEY: "re_production_secret",
          SHORTMAIL_PREVIEW_RESEND_API_KEY: "re_preview_secret",
        },
        destination,
        "https://shortmail-git-feat-widgets-eric-mas-projects-a230afd1.vercel.app",
      );
      const written = readFileSync(destination, "utf8");
      expect(written).toContain("SHORTMAIL_PREVIEW=1");
      expect(written).toContain(
        "SHORTMAIL_PUBLIC_ORIGIN=https://shortmail-git-feat-widgets-eric-mas-projects-a230afd1.vercel.app",
      );
      expect(written).toContain("RESEND_API_KEY=re_preview_secret");
      expect(written).toContain(
        "WORKOS_AUTHKIT_ISSUER=https://warm-respect-91-staging.authkit.app",
      );
      expect(written).toContain(
        "SHORTMAIL_MCP_RESOURCE=https://shortmail-git-feat-widgets-eric-mas-projects-a230afd1.vercel.app/mcp",
      );
      expect(written).not.toContain("re_production_secret");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("omits RESEND_API_KEY when no preview key is configured", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "shortmail-env-"));
    const destination = path.join(directory, "preview.env");
    try {
      writePreviewEnvFile(
        { ...previewEnv, RESEND_API_KEY: "re_production_secret" },
        destination,
        "https://shortmail-git-feat-widgets-eric-mas-projects-a230afd1.vercel.app",
      );
      const written = readFileSync(destination, "utf8");
      expect(written).not.toContain("RESEND_API_KEY");
      expect(written).not.toContain("re_production_secret");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
