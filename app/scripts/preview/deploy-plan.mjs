/**
 * Pure decisions for the Vercel preview build.
 *
 * The shell in `scripts/vercel-build.sh` executes Convex commands. This
 * module decides which commands are allowed so a preview build cannot
 * target production, and so production data is not copied on every push.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const PROD_DEPLOYMENT_NAME = "hallowed-leopard-387";

export const PRODUCTION_HOSTS = new Set([
  "shortmail.nonlinearlabs.ai",
  "shortmail-gamma.vercel.app",
  "shortmail.vercel.app",
]);

export const DEFAULT_MAX_SNAPSHOT_BYTES = 100 * 1024 * 1024;
export const DEFAULT_EXPORT_TIMEOUT_SEC = 180;
export const DEFAULT_IMPORT_TIMEOUT_SEC = 300;

const HYDRATE_MODES = new Set(["on-create", "always", "skip"]);

/**
 * Classify a Vercel or local build from the deploy key and Vercel environment.
 *
 * A preview Vercel build with a production key is refused, and the reverse
 * is refused. Convex's own CLI also rejects a production key when
 * `VERCEL_ENV` is not `production`; this check fails before that call.
 *
 * :param env: Process environment.
 * :returns: `local`, `production`, `preview`, or `refuse` with a reason.
 */
export function classifyBuild(env) {
  const key = env.CONVEX_DEPLOY_KEY ?? "";
  const vercelEnv = env.VERCEL_ENV ?? "";
  const onVercel = env.VERCEL === "1";
  if (!key) {
    if (onVercel) {
      return {
        kind: "refuse",
        reason: "Vercel build is missing CONVEX_DEPLOY_KEY",
      };
    }
    return { kind: "local" };
  }
  const previewKey = key.startsWith("preview:");
  const prodKey = key.startsWith("prod:");
  if (!previewKey && !prodKey) {
    return {
      kind: "refuse",
      reason: "CONVEX_DEPLOY_KEY must start with prod: or preview:",
    };
  }
  if (previewKey && vercelEnv === "production") {
    return {
      kind: "refuse",
      reason: "Production Vercel build has a Convex preview deploy key",
    };
  }
  if (prodKey && vercelEnv && vercelEnv !== "production") {
    return {
      kind: "refuse",
      reason:
        "Non-production Vercel build has a Convex production deploy key. Refusing so this build cannot write to production.",
    };
  }
  if (previewKey) return { kind: "preview" };
  return { kind: "production" };
}

/**
 * Public origin stamped onto the preview Convex deployment.
 *
 * Prefers the stable branch alias (`VERCEL_BRANCH_URL`) so verification
 * links survive the next push. Production hostnames are rejected.
 *
 * :param env: Process environment.
 * :returns: `{ ok: true, origin }` or `{ ok: false, reason }`.
 */
export function previewOrigin(env) {
  const host = (env.VERCEL_BRANCH_URL || env.VERCEL_URL || "").trim();
  if (!host) {
    return {
      ok: false,
      reason: "Preview build has neither VERCEL_BRANCH_URL nor VERCEL_URL",
    };
  }
  let url;
  try {
    url = new URL(host.includes("://") ? host : `https://${host}`);
  } catch {
    return { ok: false, reason: "Preview host is not a URL" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "Preview origin must be https" };
  }
  if (PRODUCTION_HOSTS.has(url.hostname.toLowerCase())) {
    return {
      ok: false,
      reason: `Refusing to stamp production host ${url.hostname} onto a preview deployment`,
    };
  }
  return { ok: true, origin: url.origin };
}

/**
 * Branch name Convex uses as the preview identifier on Vercel.
 *
 * This is `VERCEL_GIT_COMMIT_REF`, the same value `npx convex deploy`
 * reads. `main` and `master` are refused so cleanup's protected-branch
 * rule is not the only thing standing between a preview and production.
 *
 * :param env: Process environment.
 * :returns: `{ ok: true, name }` or `{ ok: false, reason }`.
 */
export function previewName(env) {
  const name = (env.VERCEL_GIT_COMMIT_REF ?? "").trim();
  if (!name) {
    return { ok: false, reason: "VERCEL_GIT_COMMIT_REF is empty" };
  }
  if (name === "main" || name === "master") {
    return {
      ok: false,
      reason: `Refusing to create a Convex preview named ${name}`,
    };
  }
  if (name.includes("..") || name.startsWith("-") || /[\s\u0000]/.test(name)) {
    return { ok: false, reason: "Preview branch name is not safe to pass to the Convex CLI" };
  }
  return { ok: true, name };
}

/**
 * Hydration mode. Default is `on-create`.
 *
 * :param env: Process environment.
 * :returns: A mode, or `{ invalid }` when the value is not recognized.
 */
export function hydrateMode(env) {
  const raw = (env.SHORTMAIL_PREVIEW_HYDRATE ?? "on-create").trim() || "on-create";
  if (!HYDRATE_MODES.has(raw)) return { invalid: raw };
  return raw;
}

/**
 * Whether this build should export production and import into the preview.
 *
 * `on-create` skips when the preview deployment already has
 * `SHORTMAIL_PREVIEW_HYDRATED_AT`. `always` imports on every build.
 * `skip` never imports.
 *
 * :param mode: Hydration mode.
 * :param markerPresent: True when the preview deployment already recorded a hydrate.
 * :returns: True when this build should copy production data.
 */
export function shouldHydrate(mode, markerPresent) {
  if (mode === "skip") return false;
  if (mode === "always") return true;
  return !markerPresent;
}

/**
 * Reject an export that is empty or larger than the configured cap.
 *
 * :param bytes: Zip size in bytes.
 * :param maxBytes: Inclusive upper bound.
 */
export function assertSnapshotSize(bytes, maxBytes) {
  if (!Number.isInteger(bytes) || bytes < 0) {
    throw new Error("snapshot size is not a byte count");
  }
  if (bytes === 0) {
    throw new Error("production snapshot is empty; refusing to import it");
  }
  if (bytes > maxBytes) {
    throw new Error(
      `production snapshot is ${bytes} bytes, over the ${maxBytes} byte limit. Raise SHORTMAIL_PREVIEW_EXPORT_MAX_BYTES if this copy is intentional.`,
    );
  }
}

function boundedSeconds(raw, fallback, label) {
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) {
    return { error: `${label} must be a whole number of seconds` };
  }
  const value = Number(raw);
  if (value < 30 || value > 900) {
    return { error: `${label} must be between 30 and 900 seconds` };
  }
  return value;
}

function boundedBytes(raw) {
  if (raw === undefined || raw === "") return DEFAULT_MAX_SNAPSHOT_BYTES;
  if (!/^\d+$/.test(raw)) {
    return { error: "SHORTMAIL_PREVIEW_EXPORT_MAX_BYTES must be a whole number" };
  }
  const value = Number(raw);
  if (value < 1 || value > 1024 * 1024 * 1024) {
    return { error: "SHORTMAIL_PREVIEW_EXPORT_MAX_BYTES must be between 1 and 1073741824" };
  }
  return value;
}

/**
 * Build the preview plan, or a refusal the shell must print and exit on.
 *
 * The plan contains no secret values. The env file is written separately.
 *
 * :param env: Process environment.
 * :returns: A JSON-ready plan.
 */
export function buildPlan(env) {
  const kind = classifyBuild(env);
  if (kind.kind !== "preview") return kind;

  const name = previewName(env);
  if (!name.ok) return { kind: "refuse", reason: name.reason };
  const origin = previewOrigin(env);
  if (!origin.ok) return { kind: "refuse", reason: origin.reason };

  const mode = hydrateMode(env);
  if (typeof mode !== "string") {
    return {
      kind: "refuse",
      reason: `SHORTMAIL_PREVIEW_HYDRATE must be on-create, always, or skip (got ${mode.invalid})`,
    };
  }

  const exportTimeoutSec = boundedSeconds(
    env.SHORTMAIL_PREVIEW_EXPORT_TIMEOUT_SEC,
    DEFAULT_EXPORT_TIMEOUT_SEC,
    "SHORTMAIL_PREVIEW_EXPORT_TIMEOUT_SEC",
  );
  if (typeof exportTimeoutSec !== "number") {
    return { kind: "refuse", reason: exportTimeoutSec.error };
  }
  const importTimeoutSec = boundedSeconds(
    env.SHORTMAIL_PREVIEW_IMPORT_TIMEOUT_SEC,
    DEFAULT_IMPORT_TIMEOUT_SEC,
    "SHORTMAIL_PREVIEW_IMPORT_TIMEOUT_SEC",
  );
  if (typeof importTimeoutSec !== "number") {
    return { kind: "refuse", reason: importTimeoutSec.error };
  }
  const maxSnapshotBytes = boundedBytes(env.SHORTMAIL_PREVIEW_EXPORT_MAX_BYTES);
  if (typeof maxSnapshotBytes !== "number") {
    return { kind: "refuse", reason: maxSnapshotBytes.error };
  }

  if (!(env.WORKOS_CLIENT_ID ?? "").trim()) {
    return {
      kind: "refuse",
      reason: "Preview build is missing WORKOS_CLIENT_ID",
    };
  }

  const allowlist = (env.SHORTMAIL_EMAIL_ALLOWLIST ?? "")
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const sink = (env.SHORTMAIL_PREVIEW_EMAIL_SINK ?? "").trim().toLowerCase();
  if (sink && !allowlist.includes(sink)) {
    return {
      kind: "refuse",
      reason:
        "SHORTMAIL_PREVIEW_EMAIL_SINK must be one of the addresses in SHORTMAIL_EMAIL_ALLOWLIST",
    };
  }

  const prodKey = env.CONVEX_PROD_DEPLOY_KEY ?? "";
  if (mode !== "skip" && !prodKey.startsWith("prod:")) {
    return {
      kind: "refuse",
      reason:
        "Preview hydration needs CONVEX_PROD_DEPLOY_KEY set to a production deploy key (prod:…). Set SHORTMAIL_PREVIEW_HYDRATE=skip to build without copying data.",
    };
  }
  if (prodKey && prodKey === (env.CONVEX_DEPLOY_KEY ?? "")) {
    return {
      kind: "refuse",
      reason: "CONVEX_PROD_DEPLOY_KEY and CONVEX_DEPLOY_KEY are the same value",
    };
  }

  return {
    kind: "preview",
    previewName: name.name,
    origin: origin.origin,
    hydrateMode: mode,
    scrub: env.SHORTMAIL_PREVIEW_SCRUB === "1",
    removeResend: !(env.SHORTMAIL_PREVIEW_RESEND_API_KEY ?? "").trim(),
    exportTimeoutSec,
    importTimeoutSec,
    maxSnapshotBytes,
  };
}

/**
 * Write the Convex env file for a preview deployment.
 *
 * `RESEND_API_KEY` from the build environment is ignored. The only key that
 * may be written is `SHORTMAIL_PREVIEW_RESEND_API_KEY`.
 *
 * :param env: Process environment.
 * :param destination: File path to create or replace.
 * :param origin: Preview origin from the plan.
 */
export function writePreviewEnvFile(env, destination, origin) {
  const plan = buildPlan(env);
  if (plan.kind !== "preview") {
    throw new Error(plan.reason ?? "refusing to write preview env outside a preview build");
  }
  if (origin !== plan.origin) {
    throw new Error("preview origin does not match the plan");
  }
  const lines = [
    line("SHORTMAIL_PREVIEW", "1"),
    line("SHORTMAIL_PUBLIC_ORIGIN", origin),
    line("WORKOS_CLIENT_ID", env.WORKOS_CLIENT_ID.trim()),
  ];
  const optional = [
    ["SUPER_ADMIN_EMAIL", env.SUPER_ADMIN_EMAIL],
    ["SHORTMAIL_EMAIL_ALLOWLIST", env.SHORTMAIL_EMAIL_ALLOWLIST],
    ["SHORTMAIL_PREVIEW_EMAIL_SINK", env.SHORTMAIL_PREVIEW_EMAIL_SINK],
  ];
  for (const [name, value] of optional) {
    if ((value ?? "").trim()) lines.push(line(name, value.trim()));
  }
  const previewKey = (env.SHORTMAIL_PREVIEW_RESEND_API_KEY ?? "").trim();
  if (previewKey) lines.push(line("RESEND_API_KEY", previewKey));
  writeFileSync(destination, `${lines.join("\n")}\n`, { mode: 0o600 });
}

function line(name, value) {
  if (/[\r\n\u0000]/.test(value)) {
    throw new Error(`${name} contains a newline and cannot be written to the env file`);
  }
  if (/[^A-Za-z0-9_@.+/:%,-]/.test(value)) {
    return `${name}="${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  }
  return `${name}=${value}`;
}

function isDirectRun() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

function readFlag(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) {
    throw new Error(`missing ${name}`);
  }
  return process.argv[index + 1];
}

if (isDirectRun()) {
  const command = process.argv[2];
  if (command === "plan") {
    process.stdout.write(`${JSON.stringify(buildPlan(process.env))}\n`);
  } else if (command === "should-hydrate") {
    const mode = readFlag("--mode");
    const present = readFlag("--present") === "yes";
    process.stdout.write(shouldHydrate(mode, present) ? "yes\n" : "no\n");
  } else if (command === "write-env") {
    const destination = readFlag("--out");
    const origin = readFlag("--origin");
    writePreviewEnvFile(process.env, destination, origin);
  } else if (command === "assert-snapshot") {
    const file = readFlag("--file");
    const maxBytes = Number(readFlag("--max"));
    const bytes = readFileSync(file).length;
    assertSnapshotSize(bytes, maxBytes);
  } else {
    process.stderr.write(
      "usage: deploy-plan.mjs plan|should-hydrate|write-env|assert-snapshot\n",
    );
    process.exit(2);
  }
}
