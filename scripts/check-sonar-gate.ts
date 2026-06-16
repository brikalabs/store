/**
 * CI quality gate, enforced from SonarCloud's analysis results.
 *
 * Assigning a custom Quality Gate is a paid SonarCloud feature, but the scan
 * still computes the metrics on the free plan. So this is the single authority
 * for the gate: it waits for the analysis to finish, reads the new-code measures
 * back through the API, and applies Brika's thresholds: coverage >= 90%, 0
 * issues, 0% duplication on the code a change touches. It deliberately ignores
 * the built-in "Sonar way" conditions (ratings, security hotspots) that the
 * project does not gate on.
 *
 * "new code" means clean-as-you-code: this gates the lines a PR changes, not the
 * whole pre-existing codebase.
 */
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const PROJECT = process.env.SONAR_PROJECT_KEY ?? "brikalabs_store";
const TOKEN = process.env.SONAR_TOKEN ?? "";
const PR = process.env.SONAR_PR ?? "";
const BRANCH = process.env.SONAR_BRANCH ?? "main";
const HOST = "https://sonarcloud.io";

const MIN_COVERAGE = 90;
const MAX_DUPLICATION = 0;
const MAX_ISSUES = 0;

if (TOKEN === "") {
  console.error("SONAR_TOKEN is not set; cannot read the analysis.");
  process.exit(1);
}

const isPr = PR.length > 0;
const auth = `Basic ${btoa(TOKEN + ":")}`;
const prSuffix = isPr ? `&pullRequest=${PR}` : "";
const scope = isPr ? `pullRequest=${PR}` : `branch=${encodeURIComponent(BRANCH)}`;
const target = isPr ? `PR #${PR}` : `branch ${BRANCH}`;

/** Read `obj[key]` defensively without casting an `unknown` payload. */
function get(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

/**
 * Wait until SonarCloud finishes processing this commit's analysis, so the
 * measures we read next are fresh. The scanner writes the Compute Engine task id
 * to `.scannerwork/report-task.txt`; we poll the task until it succeeds. Absent
 * the file (e.g. running locally) we skip and let the measures fetch retry.
 */
async function waitForAnalysis(): Promise<void> {
  const path = ".scannerwork/report-task.txt";
  if (!existsSync(path)) return;
  const props = new Map<string, string>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) props.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim());
  }
  const taskId = props.get("ceTaskId");
  if (taskId === undefined) return;
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await fetch(`${HOST}/api/ce/task?id=${encodeURIComponent(taskId)}`, {
      headers: { Authorization: auth },
    });
    if (res.ok) {
      const status = get(get(await res.json(), "task"), "status");
      if (status === "SUCCESS") return;
      if (status === "FAILED" || status === "CANCELED") {
        console.error(`SonarCloud analysis ${String(status)}.`);
        process.exit(1);
      }
    }
    await sleep(3000);
  }
}

/** Flatten the `measures` array into metric -> number, reading `value` or the new-code `periods[0].value`. */
function readMeasures(body: unknown): Map<string, number> {
  const out = new Map<string, number>();
  const measures = get(get(body, "component"), "measures");
  if (!Array.isArray(measures)) return out;
  for (const item of measures) {
    const metric = get(item, "metric");
    if (typeof metric !== "string") continue;
    let raw = get(item, "value");
    if (typeof raw !== "string") {
      const periods = get(item, "periods");
      raw = get(Array.isArray(periods) ? periods[0] : undefined, "value");
    }
    if (typeof raw === "string" && Number.isFinite(Number(raw))) out.set(metric, Number(raw));
  }
  return out;
}

async function fetchMeasures(): Promise<Map<string, number>> {
  const url =
    `${HOST}/api/measures/component?component=${encodeURIComponent(PROJECT)}` +
    `&${scope}&metricKeys=new_coverage,new_duplicated_lines_density,new_violations,new_lines`;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (res.ok) {
      const measures = readMeasures(await res.json());
      if (measures.size > 0) return measures;
    } else if (res.status !== 404) {
      console.error(`SonarCloud API ${res.status}: ${await res.text()}`);
      process.exit(1);
    }
    if (attempt < 5) await sleep(3000);
  }
  return new Map();
}

await waitForAnalysis();
const measures = await fetchMeasures();
const newLines = measures.get("new_lines") ?? 0;
// Absent when a change adds no coverable lines, so there is nothing to cover.
const coverage = measures.get("new_coverage");
const duplication = measures.get("new_duplicated_lines_density") ?? 0;
const issues = measures.get("new_violations") ?? 0;

console.log(`SonarCloud new-code gate for ${target}: ${newLines} new line(s)`);
console.log(
  `  issues=${issues} (max ${MAX_ISSUES})  ` +
    `duplication=${duplication}% (max ${MAX_DUPLICATION}%)  ` +
    `coverage=${coverage ?? "n/a"}% (min ${MIN_COVERAGE}%)`,
);

const failures: string[] = [];
if (issues > MAX_ISSUES) failures.push(`${issues} new issue(s); ${MAX_ISSUES} allowed`);
if (duplication > MAX_DUPLICATION) {
  failures.push(`${duplication}% duplication on new code; ${MAX_DUPLICATION}% allowed`);
}
if (coverage !== undefined && coverage < MIN_COVERAGE) {
  failures.push(`${coverage}% coverage on new code; >= ${MIN_COVERAGE}% required`);
}

if (failures.length > 0) {
  console.error("\nQuality gate FAILED:");
  for (const failure of failures) console.error(`  - ${failure}`);
  const dashboard = `${HOST}/dashboard?id=${PROJECT}${prSuffix}`;
  console.error(`\nDetails: ${dashboard}`);
  process.exit(1);
}

console.log("\nQuality gate PASSED.");
