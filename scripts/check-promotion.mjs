import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function assertPromotionSource(pr, repository) {
  if (pr.base.ref === "dev") return false;
  if (pr.base.ref !== "main" || pr.head.ref !== "dev" || pr.head.repo?.full_name !== repository) {
    throw new Error("Main accepts promotion PRs from this repository's dev branch only.");
  }
  return true;
}

export function deploymentState(runs, sha) {
  // The latest attempt must succeed: an older success cannot mask a failed reset.
  const run = runs.filter(run => run.head_sha === sha && run.head_branch === "dev"
    && ["push", "workflow_dispatch"].includes(run.event)
    && run.path === ".github/workflows/deploy-lanes.yml")
    .sort((a, b) => b.id - a.id)[0];
  if (!run || run.status !== "completed") return "pending";
  return run.conclusion === "success" ? "success" : "failure";
}

export async function checkPromotion({ event, repository, token, fetcher = fetch,
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)), attempts = 90 }) {
  const pr = event.pull_request;
  if (!assertPromotionSource(pr, repository)) return;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const url = `https://api.github.com/repos/${repository}/actions/workflows/deploy-lanes.yml/runs?branch=dev&head_sha=${pr.head.sha}&per_page=100`;
    const response = await fetcher(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(`Cannot verify dev deployment: GitHub HTTP ${response.status}.`);
    const state = deploymentState((await response.json()).workflow_runs, pr.head.sha);
    if (state === "success") return;
    if (state === "failure") throw new Error("The latest dev deployment for this commit failed; deploy successfully before promoting.");
    if (attempt + 1 < attempts) await pause(10000);
  }
  throw new Error("No successful dev deployment for this commit. Rerun this check after dev deployment completes.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
  await checkPromotion({ event, repository: process.env.GITHUB_REPOSITORY, token: process.env.GH_TOKEN });
}
