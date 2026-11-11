/**
 * Decide which preview resources a closed PR or deleted branch may remove.
 *
 * Matching is exact. A branch named `feature` does not select `feature-2`.
 * Production deployment names, production targets, and the canonical
 * hostnames are never selected.
 */

export const PROD_DEPLOYMENT_NAME = "hallowed-leopard-387";

export const PROTECTED_BRANCHES = new Set(["main", "master"]);

export const PROTECTED_HOSTS = new Set([
  "shortmail.nonlinearlabs.ai",
  "shortmail-gamma.vercel.app",
  "shortmail.vercel.app",
]);

/**
 * Turn a GitHub event into a branch to clean, a skip, or a refusal.
 *
 * Fork pull requests are skipped. Tag deletes are skipped. `main` and
 * `master` are refused even if a caller asks for them.
 *
 * :param eventName: `github.event_name`.
 * :param payload: Parsed GitHub event.
 * :param repository: `owner/name` of this repository.
 * :returns: A cleanup request.
 */
export function branchFromGithubEvent(eventName, payload, repository) {
  if (payload?.repository?.fork === true) {
    return { action: "skip", reason: "repository is a fork" };
  }
  if (eventName === "pull_request") {
    const head = payload?.pull_request?.head;
    const headRepo = head?.repo?.full_name;
    if (!headRepo || !repository || headRepo !== repository) {
      return { action: "skip", reason: "pull request head is not in this repository" };
    }
    return branchRequest(head?.ref);
  }
  if (eventName === "delete") {
    if (payload?.ref_type !== "branch") {
      return { action: "skip", reason: "delete event is not a branch" };
    }
    return branchRequest(payload?.ref);
  }
  if (eventName === "workflow_dispatch") {
    return branchRequest(payload?.inputs?.branch ?? payload?.branch);
  }
  return { action: "skip", reason: `event ${eventName || "unknown"} does not clean previews` };
}

function branchRequest(branch) {
  if (typeof branch !== "string" || !branch.trim()) {
    return { action: "refuse", reason: "branch name is empty" };
  }
  const name = branch.trim();
  if (PROTECTED_BRANCHES.has(name)) {
    return { action: "refuse", reason: `refusing to clean protected branch ${name}` };
  }
  if (name.includes("..") || name.startsWith("-") || /[\s\u0000]/.test(name)) {
    return { action: "refuse", reason: "branch name is not safe to clean" };
  }
  return { action: "clean", branch: name };
}

/**
 * Slug used only when a preview deployment has no `previewIdentifier`.
 *
 * Convex stores the raw git branch as the preview identifier. The reference
 * fallback lowercases and replaces characters outside the reference alphabet.
 *
 * :param branch: Git branch name.
 * :returns: `preview/<slug>`, or null when the slug would be empty.
 */
export function previewReference(branch) {
  const slug = branch
    .toLowerCase()
    .replace(/[^a-z0-9/-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return null;
  const reference = `preview/${slug}`;
  if (reference.length < 3 || reference.length > 100) return null;
  return reference;
}

/**
 * True when a Convex deployment is the production deployment or a prod type.
 *
 * :param deployment: One row from the Convex list-deployments API.
 * :returns: True when this row must never be deleted.
 */
export function isProtectedConvexDeployment(deployment) {
  const name = String(deployment?.name ?? "");
  const url = String(deployment?.deploymentUrl ?? "");
  const reference = String(deployment?.reference ?? "");
  if (name === PROD_DEPLOYMENT_NAME) return true;
  if (url.includes(PROD_DEPLOYMENT_NAME)) return true;
  if (deployment?.deploymentType === "prod") return true;
  if (reference === "production" || reference === "prod") return true;
  if (deployment?.isDefault === true && deployment?.deploymentType !== "preview") {
    return true;
  }
  return false;
}

/**
 * Whether this preview row belongs to the branch and nothing else.
 *
 * `previewIdentifier` is compared to the full branch. A missing identifier
 * may match the exact reference `preview/<branch>` or the slug reference,
 * and never a prefix.
 *
 * :param deployment: Convex deployment row.
 * :param branch: Git branch being cleaned.
 * :returns: True for an exact preview match.
 */
export function convexDeploymentMatchesBranch(deployment, branch) {
  if (deployment?.deploymentType !== "preview") return false;
  if (isProtectedConvexDeployment(deployment)) return false;
  const identifier = deployment?.previewIdentifier;
  if (typeof identifier === "string" && identifier.length > 0) {
    return identifier === branch;
  }
  const reference = String(deployment?.reference ?? "");
  if (reference === `preview/${branch}`) return true;
  const expected = previewReference(branch);
  return expected !== null && reference === expected;
}

/**
 * Select the single Convex preview for a branch, or an error.
 *
 * More than one match is an error: the cleanup stops without deleting.
 *
 * :param deployments: Rows from the list API.
 * :param branch: Git branch being cleaned.
 * :returns: `{ deployment }` or `{ error }`.
 */
export function selectConvexDeployment(deployments, branch) {
  const matches = [];
  const reference = previewReference(branch);
  for (const deployment of deployments) {
    const identifier = deployment?.previewIdentifier;
    const deploymentReference = String(deployment?.reference ?? "");
    const namesThisBranch =
      identifier === branch ||
      deploymentReference === `preview/${branch}` ||
      (reference !== null && deploymentReference === reference);
    if (namesThisBranch && isProtectedConvexDeployment(deployment)) {
      return {
        error: `refusing to delete protected Convex deployment ${deployment?.name ?? "unknown"}`,
      };
    }
    if (!convexDeploymentMatchesBranch(deployment, branch)) continue;
    matches.push(deployment);
  }
  if (matches.length > 1) {
    return {
      error: `refusing to delete ${matches.length} Convex deployments for branch ${branch}`,
    };
  }
  return { deployment: matches[0] ?? null };
}

function hostnameOf(value) {
  if (!value) return "";
  try {
    const withProtocol = String(value).includes("://") ? String(value) : `https://${value}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * True when a Vercel deployment is a non-production deployment of this branch
 * in this project.
 *
 * :param deployment: One row from `GET /v7/deployments`.
 * :param branch: Git branch being cleaned.
 * :param projectId: Expected `prj_…` id.
 * :returns: True when the row is safe to delete.
 */
export function vercelDeploymentMatchesBranch(deployment, branch, projectId) {
  if (!deployment || deployment.projectId !== projectId) return false;
  if (deployment.target === "production" || deployment.target === "staging") return false;
  const ref = deployment.meta?.githubCommitRef;
  if (ref !== branch) return false;
  const host = hostnameOf(deployment.url);
  if (PROTECTED_HOSTS.has(host)) return false;
  if (!deployment.uid) return false;
  return true;
}

/**
 * Select every Vercel deployment for the branch in this project.
 *
 * A protected hostname or production target that also carries this branch
 * ref aborts the whole Vercel delete, so a bad filter cannot continue.
 *
 * :param deployments: Rows from the list API.
 * :param branch: Git branch being cleaned.
 * :param projectId: Expected project id.
 * :returns: `{ deployments }` or `{ error }`.
 */
export function selectVercelDeployments(deployments, branch, projectId) {
  const selected = [];
  for (const deployment of deployments) {
    const ref = deployment?.meta?.githubCommitRef;
    const sameBranch = ref === branch;
    const sameProject = deployment?.projectId === projectId;
    if (sameBranch && sameProject && isUnsafeVercelDeployment(deployment)) {
      return {
        error: `refusing to delete Vercel deployment ${deployment.uid ?? deployment.url} for ${branch}`,
      };
    }
    if (vercelDeploymentMatchesBranch(deployment, branch, projectId)) {
      selected.push(deployment);
    }
  }
  return { deployments: selected };
}

function isUnsafeVercelDeployment(deployment) {
  if (deployment?.target === "production" || deployment?.target === "staging") return true;
  return PROTECTED_HOSTS.has(hostnameOf(deployment?.url));
}

/**
 * Aliases attached to the deployments already selected for deletion.
 *
 * Aliases for any other deployment, and the canonical hostnames, are left
 * alone. A protected alias pointing at a selected deployment is an error.
 *
 * :param aliases: Rows from the Vercel alias list.
 * :param deploymentIds: UIDs selected for deletion.
 * :param projectId: Expected project id.
 * :returns: `{ aliases }` or `{ error }`.
 */
export function selectAliases(aliases, deploymentIds, projectId) {
  const ids = new Set(deploymentIds);
  const selected = [];
  for (const alias of aliases) {
    const deploymentId = alias?.deploymentId || alias?.deployment?.id || alias?.deployment?.uid;
    if (!ids.has(deploymentId)) continue;
    if (alias?.projectId && alias.projectId !== projectId) continue;
    const host = hostnameOf(alias?.alias ?? alias?.host);
    if (PROTECTED_HOSTS.has(host)) {
      return { error: `refusing to delete protected alias ${host}` };
    }
    if (!host || !alias?.uid) continue;
    selected.push({ uid: alias.uid, host, deploymentId });
  }
  return { aliases: selected };
}

/**
 * Names that must be present before a real or dry-run cleanup calls the APIs.
 *
 * :param env: Process environment.
 * :returns: The ids the clients need. Throws listing the missing names.
 */
export function readCleanupConfig(env) {
  const required = [
    "CONVEX_ACCESS_TOKEN",
    "CONVEX_PROJECT_ID",
    "VERCEL_TOKEN",
    "VERCEL_PROJECT_ID",
    "VERCEL_ORG_ID",
  ];
  const missing = required.filter((name) => !(env[name] ?? "").trim());
  if (missing.length > 0) {
    throw new Error(`Missing cleanup configuration: ${missing.join(", ")}`);
  }
  if (!/^\d+$/.test(env.CONVEX_PROJECT_ID.trim())) {
    throw new Error("CONVEX_PROJECT_ID must be the numeric Convex project id");
  }
  if (!env.VERCEL_PROJECT_ID.startsWith("prj_")) {
    throw new Error("VERCEL_PROJECT_ID must be the Vercel project id");
  }
  return {
    convexToken: env.CONVEX_ACCESS_TOKEN,
    convexProjectId: env.CONVEX_PROJECT_ID.trim(),
    vercelToken: env.VERCEL_TOKEN,
    vercelProjectId: env.VERCEL_PROJECT_ID,
    vercelOrgId: env.VERCEL_ORG_ID,
  };
}

/**
 * Run the cleanup against injected clients.
 *
 * Dry-run logs the same rows and does not call `remove`.
 *
 * :param input: Request, clients, and whether to stop before deletion.
 * :returns: The actions that were removed or would be removed.
 */
export async function runCleanup(input) {
  const request = input.request;
  if (request.action === "skip") {
    input.log(`skip: ${request.reason}`);
    return [];
  }
  if (request.action === "refuse") {
    throw new Error(request.reason);
  }
  const branch = request.branch;
  const convexRows = await input.listConvex();
  const convexPick = selectConvexDeployment(convexRows, branch);
  if (convexPick.error) throw new Error(convexPick.error);

  const vercelRows = await input.listVercel(branch);
  const vercelPick = selectVercelDeployments(vercelRows, branch, input.projectId);
  if (vercelPick.error) throw new Error(vercelPick.error);

  const aliasRows = await input.listAliases();
  const aliasPick = selectAliases(
    aliasRows,
    vercelPick.deployments.map((deployment) => deployment.uid),
    input.projectId,
  );
  if (aliasPick.error) throw new Error(aliasPick.error);

  const actions = [];
  if (convexPick.deployment) {
    actions.push({
      kind: "convex-deployment",
      label: `${convexPick.deployment.name} identifier=${convexPick.deployment.previewIdentifier ?? convexPick.deployment.reference}`,
      name: convexPick.deployment.name,
    });
  }
  for (const deployment of vercelPick.deployments) {
    actions.push({
      kind: "vercel-deployment",
      label: `${deployment.uid} ref=${deployment.meta.githubCommitRef} url=${deployment.url}`,
      id: deployment.uid,
    });
  }
  for (const alias of aliasPick.aliases) {
    actions.push({
      kind: "vercel-alias",
      label: alias.host,
      id: alias.uid,
      host: alias.host,
    });
  }

  if (actions.length === 0) {
    input.log(`nothing to remove for branch ${branch}`);
    return [];
  }
  for (const action of actions) {
    if (input.dryRun) {
      input.log(`dry-run remove ${action.kind} ${action.label}`);
      continue;
    }
    const outcome = await input.remove(action);
    input.log(`removed ${action.kind} ${action.label} (${outcome})`);
  }
  return actions;
}
