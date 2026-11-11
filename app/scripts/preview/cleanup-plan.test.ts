import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  branchFromGithubEvent,
  readCleanupConfig,
  runCleanup,
  selectAliases,
  selectConvexDeployment,
  selectVercelDeployments,
} from "./cleanup-plan.mjs";

const projectId = "prj_cXq7wahRknr1gCAijhAy4dS6HckH";

function convex(overrides: Record<string, unknown>) {
  return {
    name: "happy-otter-123",
    deploymentType: "preview",
    previewIdentifier: "feat/widgets",
    reference: "preview/feat/widgets",
    deploymentUrl: "https://happy-otter-123.convex.cloud",
    isDefault: false,
    ...overrides,
  };
}

function vercel(overrides: Record<string, unknown>) {
  return {
    uid: "dpl_feature",
    projectId,
    target: null,
    url: "shortmail-abc-eric-mas-projects-a230afd1.vercel.app",
    meta: { githubCommitRef: "feat/widgets" },
    ...overrides,
  };
}

describe("branchFromGithubEvent", () => {
  const repo = "nll-ai/shortmail";

  it("uses the head branch when a same-repo pull request closes", () => {
    expect(
      branchFromGithubEvent(
        "pull_request",
        {
          pull_request: {
            head: { ref: "feat/widgets", repo: { full_name: repo } },
          },
        },
        repo,
      ),
    ).toEqual({ action: "clean", branch: "feat/widgets" });
  });

  it("skips fork pull requests and tag deletes", () => {
    expect(
      branchFromGithubEvent(
        "pull_request",
        {
          pull_request: {
            head: { ref: "feat/widgets", repo: { full_name: "stranger/shortmail" } },
          },
        },
        repo,
      ).action,
    ).toBe("skip");
    expect(
      branchFromGithubEvent("delete", { ref_type: "tag", ref: "v1" }, repo).action,
    ).toBe("skip");
    expect(
      branchFromGithubEvent("delete", { ref_type: "branch", ref: "feat/widgets", repository: { fork: true } }, repo).action,
    ).toBe("skip");
  });

  it("refuses main even from a branch delete", () => {
    expect(branchFromGithubEvent("delete", { ref_type: "branch", ref: "main" }, repo)).toEqual({
      action: "refuse",
      reason: "refusing to clean protected branch main",
    });
  });
});

describe("selectConvexDeployment", () => {
  it("matches the branch exactly and ignores longer names", () => {
    const rows = [
      convex({ name: "happy-otter-123", previewIdentifier: "feat/widgets" }),
      convex({ name: "other-otter-124", previewIdentifier: "feat/widgets-2" }),
      convex({
        name: "hallowed-leopard-387",
        deploymentType: "prod",
        previewIdentifier: null,
        reference: "production",
        deploymentUrl: "https://hallowed-leopard-387.convex.cloud",
      }),
    ];
    expect(selectConvexDeployment(rows, "feat/widgets").deployment.name).toBe("happy-otter-123");
    expect(selectConvexDeployment(rows, "feat/widgets-2").deployment.name).toBe("other-otter-124");
    expect(selectConvexDeployment(rows, "feat").deployment).toBeNull();
  });

  it("refuses a protected deployment that is labeled with the branch", () => {
    const prod = convex({
      name: "hallowed-leopard-387",
      deploymentType: "prod",
      previewIdentifier: "feat/widgets",
      deploymentUrl: "https://hallowed-leopard-387.convex.cloud",
    });
    expect(selectConvexDeployment([prod], "feat/widgets").error).toMatch(/protected Convex deployment/);
  });

  it("does not select the production deployment when the identifier is missing", () => {
    const prod = convex({
      name: "hallowed-leopard-387",
      deploymentType: "prod",
      previewIdentifier: null,
      reference: "production",
      deploymentUrl: "https://hallowed-leopard-387.convex.cloud",
    });
    expect(selectConvexDeployment([prod], "production").deployment).toBeNull();
    expect(selectConvexDeployment([prod], "hallowed-leopard-387").deployment).toBeNull();
  });

  it("refuses when two previews match one branch", () => {
    const rows = [
      convex({ name: "happy-otter-123" }),
      convex({ name: "glad-otter-456" }),
    ];
    expect(selectConvexDeployment(rows, "feat/widgets").error).toMatch(/refusing to delete 2/);
  });

  it("matches a reference only when the preview identifier is absent", () => {
    const row = convex({
      previewIdentifier: null,
      reference: "preview/feat/widgets",
    });
    expect(selectConvexDeployment([row], "feat/widgets").deployment.name).toBe("happy-otter-123");
    expect(selectConvexDeployment([row], "feat/widgets-extra").deployment).toBeNull();
  });
});

describe("selectVercelDeployments", () => {
  it("keeps every preview for the branch and drops production and other branches", () => {
    const rows = [
      vercel({ uid: "dpl_a" }),
      vercel({ uid: "dpl_b", url: "shortmail-def-eric-mas-projects-a230afd1.vercel.app" }),
      vercel({
        uid: "dpl_other",
        meta: { githubCommitRef: "feat/widgets-2" },
      }),
      vercel({
        uid: "dpl_prod",
        target: "production",
        url: "shortmail-gamma.vercel.app",
        meta: { githubCommitRef: "main" },
      }),
      vercel({
        uid: "dpl_food",
        meta: { githubCommitRef: "feat/widget" },
      }),
    ];
    const selected = selectVercelDeployments(rows, "feat/widgets", projectId);
    expect(selected.deployments?.map((row: { uid: string }) => row.uid)).toEqual(["dpl_a", "dpl_b"]);
  });

  it("refuses a production target that claims the same branch", () => {
    const rows = [
      vercel({
        uid: "dpl_prod",
        target: "production",
        url: "shortmail.nonlinearlabs.ai",
        meta: { githubCommitRef: "feat/widgets" },
      }),
    ];
    expect(selectVercelDeployments(rows, "feat/widgets", projectId).error).toMatch(/refusing/);
  });

  it("does not select a deployment from another project", () => {
    const rows = [vercel({ projectId: "prj_other" })];
    expect(selectVercelDeployments(rows, "feat/widgets", projectId).deployments).toEqual([]);
  });
});

describe("selectAliases", () => {
  it("removes aliases of the selected deployments and keeps every other host", () => {
    const aliases = [
      {
        uid: "als_branch",
        alias: "shortmail-git-feat-widgets-eric-mas-projects-a230afd1.vercel.app",
        deploymentId: "dpl_a",
        projectId,
      },
      {
        uid: "als_other",
        alias: "shortmail-git-other-eric-mas-projects-a230afd1.vercel.app",
        deploymentId: "dpl_other",
        projectId,
      },
      {
        uid: "als_gamma",
        alias: "shortmail-gamma.vercel.app",
        deploymentId: "dpl_prod",
        projectId,
      },
    ];
    const selected = selectAliases(aliases, ["dpl_a"], projectId);
    expect(selected.aliases?.map((alias: { host: string }) => alias.host)).toEqual([
      "shortmail-git-feat-widgets-eric-mas-projects-a230afd1.vercel.app",
    ]);
  });

  it("refuses a protected alias attached to a deployment that was selected", () => {
    const aliases = [
      {
        uid: "als_gamma",
        alias: "shortmail-gamma.vercel.app",
        deploymentId: "dpl_a",
        projectId,
      },
    ];
    expect(selectAliases(aliases, ["dpl_a"], projectId).error).toMatch(/protected alias/);
  });
});

describe("runCleanup", () => {
  const deployment = vercel({ uid: "dpl_a" });
  const convexRow = convex({});

  function clients(removed: string[]) {
    return {
      request: { action: "clean" as const, branch: "feat/widgets" },
      projectId,
      listConvex: async () => [convexRow],
      listVercel: async () => [deployment],
      listAliases: async () => [
        {
          uid: "als_branch",
          alias: "shortmail-git-feat-widgets-eric-mas-projects-a230afd1.vercel.app",
          deploymentId: "dpl_a",
          projectId,
        },
      ],
      remove: async (action: { kind: string; label: string }) => {
        removed.push(action.kind);
        return "deleted";
      },
      log: () => {},
    };
  }

  it("does not delete in dry-run and logs each planned row", () => {
    const removed: string[] = [];
    const logs: string[] = [];
    return runCleanup({ ...clients(removed), dryRun: true, log: (line: string) => logs.push(line) }).then(
      (actions) => {
        expect(removed).toEqual([]);
        expect(actions).toHaveLength(3);
        expect(logs.join("\n")).toContain("dry-run remove convex-deployment happy-otter-123");
        expect(logs.join("\n")).toContain("dry-run remove vercel-deployment dpl_a");
        expect(logs.join("\n")).toContain("dry-run remove vercel-alias");
      },
    );
  });

  it("deletes the matched Convex preview, Vercel deployments, and their aliases", async () => {
    const removed: string[] = [];
    const actions = await runCleanup({ ...clients(removed), dryRun: false });
    expect(removed).toEqual(["convex-deployment", "vercel-deployment", "vercel-alias"]);
    expect(actions.map((action: { kind: string }) => action.kind)).toEqual(removed);
  });

  it("stops before any delete when the Convex match is ambiguous", async () => {
    const removed: string[] = [];
    await expect(
      runCleanup({
        ...clients(removed),
        dryRun: false,
        listConvex: async () => [convexRow, convex({ name: "glad-otter-456" })],
      }),
    ).rejects.toThrow(/refusing to delete 2/);
    expect(removed).toEqual([]);
  });
});

describe("readCleanupConfig", () => {
  it("names missing settings and does not echo values", () => {
    expect(() => readCleanupConfig({})).toThrow(
      /CONVEX_ACCESS_TOKEN, CONVEX_PROJECT_ID, VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_ORG_ID/,
    );
    expect(() =>
      readCleanupConfig({
        CONVEX_ACCESS_TOKEN: "secret-token",
        CONVEX_PROJECT_ID: "shortmail",
        VERCEL_TOKEN: "vercel-token",
        VERCEL_PROJECT_ID: projectId,
        VERCEL_ORG_ID: "eric-mas-projects-a230afd1",
      }),
    ).toThrow(/numeric Convex project id/);
  });
});

describe("cleanup-previews.mjs", () => {
  it("skips a fork delete without calling the APIs", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "shortmail-event-"));
    const eventPath = path.join(directory, "event.json");
    writeFileSync(
      eventPath,
      JSON.stringify({
        ref: "feat/widgets",
        ref_type: "branch",
        repository: { fork: true, full_name: "nll-ai/shortmail" },
      }),
    );
    const stdout = execFileSync("node", ["scripts/cleanup-previews.mjs"], {
      cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname), "../.."),
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        GITHUB_EVENT_NAME: "delete",
        GITHUB_EVENT_PATH: eventPath,
        GITHUB_REPOSITORY: "nll-ai/shortmail",
      } as unknown as NodeJS.ProcessEnv,
    });
    expect(stdout).toContain("skip: repository is a fork");
  });
});
