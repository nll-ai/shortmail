import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const script = path.join(appRoot, "scripts", "vercel-build.sh");

function stubBin(): { dir: string; log: string } {
  const dir = mkdtempSync(path.join(tmpdir(), "shortmail-stub-"));
  const log = path.join(dir, "commands.log");
  writeFileSync(
    path.join(dir, "npx"),
    `#!/bin/bash
echo "npx $*" >> "$STUB_LOG"
echo "DEPLOY_KEY_KIND=\${CONVEX_DEPLOY_KEY%%:*}" >> "$STUB_LOG"
if [[ "$*" == *"--names-only"* ]]; then
  printf '%s\\n' "\${STUB_ENV_NAMES:-WORKOS_CLIENT_ID}"
fi
if [[ "$*" == *export* ]]; then
  path=""
  args=("$@")
  for ((i=0; i<\${#args[@]}; i++)); do
    if [[ "\${args[$i]}" == "--path" ]]; then path="\${args[$((i+1))]}"; fi
  done
  # Convex export errors when --path already exists. mktemp of a .zip file
  # creates that file, which is the PR 42 hydration failure.
  if [[ -e "$path" ]]; then
    echo "EXPORT_PATH_EXISTED=yes" >> "$STUB_LOG"
    echo "Error: Path $path already exists." >&2
    exit 1
  fi
  echo "EXPORT_PATH_EXISTED=no" >> "$STUB_LOG"
  python3 -c 'import sys; open(sys.argv[1],"wb").write(b"x"*int(sys.argv[2]))' "$path" "\${STUB_EXPORT_BYTES:-8}"
fi
exit 0
`,
  );
  writeFileSync(
    path.join(dir, "timeout"),
    `#!/bin/bash
echo "timeout $*" >> "$STUB_LOG"
shift
exec "$@"
`,
  );
  chmodSync(path.join(dir, "npx"), 0o755);
  chmodSync(path.join(dir, "timeout"), 0o755);
  writeFileSync(log, "");
  return { dir, log };
}

function run(overrides: Record<string, string | undefined>): { status: number; log: string; stdout: string } {
  const { dir, log } = stubBin();
  const fullEnv: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${dir}:${process.env.PATH ?? ""}`,
    STUB_LOG: log,
  };
  for (const key of [
    "VERCEL",
    "VERCEL_ENV",
    "VERCEL_GIT_COMMIT_REF",
    "VERCEL_BRANCH_URL",
    "VERCEL_URL",
    "CONVEX_DEPLOY_KEY",
    "CONVEX_PROD_DEPLOY_KEY",
    "WORKOS_CLIENT_ID",
    "SUPER_ADMIN_EMAIL",
    "SHORTMAIL_EMAIL_ALLOWLIST",
    "SHORTMAIL_PREVIEW_EMAIL_SINK",
    "SHORTMAIL_PREVIEW_RESEND_API_KEY",
    "SHORTMAIL_PREVIEW_HYDRATE",
    "SHORTMAIL_PREVIEW_SCRUB",
    "SHORTMAIL_PREVIEW_EXPORT_MAX_BYTES",
    "RESEND_API_KEY",
    "STUB_ENV_NAMES",
    "STUB_EXPORT_BYTES",
  ]) {
    delete fullEnv[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) fullEnv[key] = value;
  }
  let status = 0;
  let stdout = "";
  try {
    stdout = execFileSync(script, {
      cwd: appRoot,
      env: fullEnv,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const failed = error as { status?: number; stdout?: string };
    status = failed.status ?? 1;
    stdout = failed.stdout ?? "";
  }
  let recorded = "";
  try {
    recorded = execFileSync("cat", [log], { encoding: "utf8" });
  } catch {
    recorded = "";
  }
  return { status, log: recorded, stdout };
}

const preview = {
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: "feat/widgets",
  VERCEL_BRANCH_URL: "shortmail-git-feat-widgets-eric-mas-projects-a230afd1.vercel.app",
  CONVEX_DEPLOY_KEY: "preview:team:shortmail|preview-token",
  CONVEX_PROD_DEPLOY_KEY: "prod:hallowed-leopard-387|prod-token",
  WORKOS_CLIENT_ID: "client_test",
  SUPER_ADMIN_EMAIL: "eric@example.com",
  SHORTMAIL_EMAIL_ALLOWLIST: "eric@example.com",
  RESEND_API_KEY: "re_production_secret",
};

describe("vercel-build.sh", () => {
  it("deploys a preview, exports with the prod key, and imports without --prod", () => {
    const result = run(preview);
    expect(result.status).toBe(0);
    expect(result.log).toContain(
      "npx convex deploy --preview-name feat/widgets --cmd npm run build --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL --preview-run devSeed:seedDemo",
    );
    expect(result.log).toContain("npx convex export --prod --path");
    expect(result.log).toContain("DEPLOY_KEY_KIND=prod");
    expect(result.log).toMatch(
      /npx convex import --preview-name feat\/widgets --replace --yes /,
    );
    const importLine = result.log
      .split("\n")
      .find((line) => line.startsWith("npx convex import"));
    expect(importLine).toBeDefined();
    expect(importLine).not.toContain("--prod");
    expect(result.log).toContain("npx convex env --preview-name feat/widgets remove RESEND_API_KEY");
    expect(result.log).toContain("npx convex run --preview-name feat/widgets devSeed:seedDemo {}");
    expect(result.log).toContain(
      "npx convex run --preview-name feat/widgets migrate:backfillListOrder {}",
    );
    expect(result.log).not.toContain("re_production_secret");
    expect(result.log).not.toContain("prod-token");
    expect(result.log).toContain("timeout 180 npx convex export --prod --path");
    expect(result.log).toContain("timeout 300 npx convex import");
  });

  it("retries hydration when the marker is missing and the export path is new", () => {
    const result = run({
      ...preview,
      STUB_ENV_NAMES: "WORKOS_CLIENT_ID\nSHORTMAIL_PUBLIC_ORIGIN",
    });
    expect(result.status, result.log).toBe(0);
    expect(result.log).toContain("EXPORT_PATH_EXISTED=no");
    expect(result.log).toContain("npx convex export --prod --path");
    expect(result.log).toContain(
      "npx convex env --preview-name feat/widgets set SHORTMAIL_PREVIEW_HYDRATED_AT",
    );
    expect(result.log).not.toContain("EXPORT_PATH_EXISTED=yes");
  });

  it("does not export again when the preview was already hydrated", () => {
    const result = run({
      ...preview,
      STUB_ENV_NAMES: "WORKOS_CLIENT_ID\nSHORTMAIL_PREVIEW_HYDRATED_AT",
    });
    expect(result.status).toBe(0);
    expect(result.log).not.toContain("convex export");
    expect(result.log).not.toContain("convex import");
    expect(result.stdout).toContain("Skipping production snapshot");
  });

  it("fails before import when the snapshot is over the size limit", () => {
    const result = run({
      ...preview,
      SHORTMAIL_PREVIEW_EXPORT_MAX_BYTES: "4",
      STUB_EXPORT_BYTES: "8",
    });
    expect(result.status).not.toBe(0);
    expect(result.log).toContain("convex export");
    expect(result.log).not.toContain("convex import");
    expect(result.log).not.toContain("SHORTMAIL_PREVIEW_HYDRATED_AT");
  });

  it("scrubs only when the flag is set", () => {
    const result = run({ ...preview, SHORTMAIL_PREVIEW_SCRUB: "1" });
    expect(result.status).toBe(0);
    expect(result.log).toContain(
      "npx convex run --preview-name feat/widgets previewScrub:scrubPii {}",
    );
  });

  it("deploys production without a preview name or an import", () => {
    const result = run({
      VERCEL: "1",
      VERCEL_ENV: "production",
      CONVEX_DEPLOY_KEY: "prod:hallowed-leopard-387|prod-token",
    });
    expect(result.status).toBe(0);
    expect(result.log).toContain(
      "npx convex deploy --cmd npm run build --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL",
    );
    expect(result.log).toContain("npx convex run --prod migrate:backfillListOrder {}");
    expect(result.log).not.toContain("--preview-name");
    expect(result.log).not.toContain("convex import");
    expect(result.log).not.toContain("convex export");
  });

  it("refuses a preview Vercel build that was given the production key", () => {
    const result = run({
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "feat/widgets",
      CONVEX_DEPLOY_KEY: "prod:hallowed-leopard-387|prod-token",
      WORKOS_CLIENT_ID: "client_test",
    });
    expect(result.status).not.toBe(0);
    expect(result.log).not.toContain("convex deploy");
    expect(result.log).not.toContain("convex import");
  });
});
