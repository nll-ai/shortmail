/**
 * Delete one branch's Convex preview deployment and Vercel preview
 * deployments. Production is never a target: the branch resolver refuses
 * main/master, and the Convex and Vercel selectors refuse production rows.
 *
 * Usage: node scripts/cleanup-previews.mjs [--dry-run]
 *
 * Reads the GitHub event from GITHUB_EVENT_NAME and GITHUB_EVENT_PATH.
 * CLEANUP_BRANCH overrides the event for workflow_dispatch. CLEANUP_DRY_RUN
 * of `true` or `1` logs the deletes and does not call them.
 */

import { readFileSync } from "node:fs";
import {
  PROD_DEPLOYMENT_NAME,
  PROTECTED_HOSTS,
  branchFromGithubEvent,
  readCleanupConfig,
  runCleanup,
} from "./preview/cleanup-plan.mjs";

const CONVEX_API = "https://api.convex.dev/v1";
const VERCEL_API = "https://api.vercel.com";

function dryRunRequested(env, argv) {
  if (argv.includes("--dry-run")) return true;
  const value = (env.CLEANUP_DRY_RUN ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

function cleanupRequest(env) {
  if ((env.CLEANUP_BRANCH ?? "").trim()) {
    return branchFromGithubEvent(
      "workflow_dispatch",
      { inputs: { branch: env.CLEANUP_BRANCH } },
      env.GITHUB_REPOSITORY ?? "",
    );
  }
  let payload = {};
  if (env.GITHUB_EVENT_PATH) {
    payload = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  }
  return branchFromGithubEvent(
    env.GITHUB_EVENT_NAME ?? "",
    payload,
    env.GITHUB_REPOSITORY ?? "",
  );
}

function teamQuery(orgId) {
  const key = orgId.startsWith("team_") ? "teamId" : "slug";
  return `${key}=${encodeURIComponent(orgId)}`;
}

async function api(url, token, method = "GET") {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  return { status: response.status, text };
}

function errorCode(text) {
  try {
    const body = JSON.parse(text);
    const code = body.code ?? body.error?.code;
    return typeof code === "string" ? code : "";
  } catch {
    return "";
  }
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned a body that was not JSON`);
  }
}

async function listPages(firstUrl, token, rowsFrom) {
  const rows = [];
  let url = firstUrl;
  const seen = new Set();
  for (let page = 0; page < 10; page += 1) {
    if (seen.has(url)) return rows;
    seen.add(url);
    const result = await api(url, token);
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`list failed: HTTP ${result.status} ${errorCode(result.text)}`.trim());
    }
    const body = result.text ? parseJson(result.text, "list") : {};
    rows.push(...rowsFrom(body));
    const next = body.pagination?.next;
    if (next === undefined || next === null || next === "") return rows;
    if (page === 9) {
      throw new Error("list exceeded 10 pages; refusing to continue");
    }
    const parsed = new URL(url);
    parsed.searchParams.set("until", String(next));
    url = parsed.toString();
  }
  return rows;
}

function convexRows(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body.items)) return body.items;
  if (Array.isArray(body.deployments)) return body.deployments;
  throw new Error("Convex deployment list was not an array");
}

function vercelDeploymentRows(body) {
  if (!Array.isArray(body.deployments)) {
    throw new Error("Vercel deployment list was missing deployments");
  }
  return body.deployments;
}

function vercelAliasRows(body) {
  if (!Array.isArray(body.aliases)) {
    throw new Error("Vercel alias list was missing aliases");
  }
  return body.aliases;
}

function hostname(value) {
  try {
    const withProtocol = String(value).includes("://") ? String(value) : `https://${value}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return "";
  }
}

async function removeAction(action, config) {
  if (action.kind === "convex-deployment") {
    if (action.name === PROD_DEPLOYMENT_NAME) {
      throw new Error("refusing to delete the production Convex deployment");
    }
    const result = await api(
      `${CONVEX_API}/deployments/${encodeURIComponent(action.name)}/delete`,
      config.convexToken,
      "POST",
    );
    if (result.status === 404 || errorCode(result.text) === "DeploymentNotFound") {
      return "already-gone";
    }
    if (result.status < 200 || result.status >= 300) {
      throw new Error(
        `Convex delete failed: HTTP ${result.status} ${errorCode(result.text)}`.trim(),
      );
    }
    return "deleted";
  }
  if (action.kind === "vercel-alias" && PROTECTED_HOSTS.has(action.host)) {
    throw new Error(`refusing to delete protected alias ${action.host}`);
  }
  if (action.kind === "vercel-deployment" && PROTECTED_HOSTS.has(hostname(action.url))) {
    throw new Error("refusing to delete a Vercel deployment on a protected host");
  }
  const team = teamQuery(config.vercelOrgId);
  const path =
    action.kind === "vercel-alias"
      ? `/v2/aliases/${encodeURIComponent(action.id)}`
      : `/v13/deployments/${encodeURIComponent(action.id)}`;
  const result = await api(`${VERCEL_API}${path}?${team}`, config.vercelToken, "DELETE");
  if (result.status === 404) return "already-gone";
  if (result.status < 200 || result.status >= 300) {
    throw new Error(
      `Vercel delete failed: HTTP ${result.status} ${errorCode(result.text)}`.trim(),
    );
  }
  return "deleted";
}

export async function main(env = process.env, argv = process.argv) {
  const request = cleanupRequest(env);
  if (request.action === "skip") {
    console.log(`skip: ${request.reason}`);
    return;
  }
  if (request.action === "refuse") {
    throw new Error(request.reason);
  }
  const config = readCleanupConfig(env);
  const team = teamQuery(config.vercelOrgId);
  const dryRun = dryRunRequested(env, argv);
  await runCleanup({
    request,
    dryRun,
    projectId: config.vercelProjectId,
    log: (line) => console.log(line),
    listConvex: async () => {
      const result = await api(
        `${CONVEX_API}/projects/${config.convexProjectId}/list_deployments?deploymentType=preview`,
        config.convexToken,
      );
      if (result.status < 200 || result.status >= 300) {
        throw new Error(
          `Convex list failed: HTTP ${result.status} ${errorCode(result.text)}`.trim(),
        );
      }
      return convexRows(result.text ? parseJson(result.text, "Convex list") : []);
    },
    listVercel: (branch) =>
      listPages(
        `${VERCEL_API}/v7/deployments?projectId=${encodeURIComponent(config.vercelProjectId)}&branch=${encodeURIComponent(branch)}&limit=100&${team}`,
        config.vercelToken,
        vercelDeploymentRows,
      ),
    listAliases: () =>
      listPages(
        `${VERCEL_API}/v4/aliases?projectId=${encodeURIComponent(config.vercelProjectId)}&limit=100&${team}`,
        config.vercelToken,
        vercelAliasRows,
      ),
    remove: (action) => removeAction(action, config),
  });
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("cleanup-previews.mjs")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "cleanup failed");
    process.exit(1);
  });
}
