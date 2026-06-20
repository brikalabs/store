#!/usr/bin/env bun
/**
 * Spec coverage report. Cross-links the acceptance-criterion codes in
 * `docs/specs/*.md` with the tests that cite them, so "what is built and still
 * passing" is generated, never hand-maintained.
 *
 * A test covers a criterion by putting its code (e.g. `SCOPE-003-AC2`) in the test
 * title. This script:
 *   1. parses every spec, its status, and its `-AC<n>` codes out of the markdown,
 *   2. greps the test suites for those codes,
 *   3. prints a per-area matrix plus two gap lists (uncovered criteria, status drift).
 *
 * Exit code is non-zero when `--strict` is passed and any drift exists, so CI can
 * gate on it. Without `--strict` it is a report (always exits 0 unless it errors).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";

const ROOT = join(import.meta.dir, "..");
const SPECS_DIR = join(ROOT, "docs/specs");
const STRICT = process.argv.includes("--strict");

const STATUSES = ["DONE", "WIP", "TODO", "HOLD", "GONE"] as const;
type Status = (typeof STATUSES)[number];

const AC_CODE = /\b([A-Z]+-\d+-AC\d+)\b/g;
const SPEC_HEADING = /^##\s+([A-Z]+-\d+)\b/;
const STATUS_LINE = /\*\*Status:\*\*\s*\[([A-Z]+)\]/;

interface Spec {
  code: string;
  status: Status;
  area: string;
  criteria: string[];
}

/** Parse all specs, their declared status, and their acceptance-criterion codes. */
function parseSpecs(): Spec[] {
  const specs: Spec[] = [];
  for (const file of readdirSync(SPECS_DIR).filter((f) => f.endsWith(".md"))) {
    if (file === "README.md" || file === "INDEX.md" || file === "_template.md") continue;
    const area = file.replace(/\.md$/, "");
    const lines = readFileSync(join(SPECS_DIR, file), "utf8").split("\n");
    let current: Spec | null = null;
    for (const line of lines) {
      const heading = SPEC_HEADING.exec(line);
      if (heading) {
        current = { code: heading[1], status: "TODO", area, criteria: [] };
        specs.push(current);
        continue;
      }
      if (current === null) continue;
      const status = STATUS_LINE.exec(line);
      if (status && (STATUSES as readonly string[]).includes(status[1])) {
        current.status = status[1] as Status;
      }
      for (const m of line.matchAll(AC_CODE)) {
        if (m[1].startsWith(current.code) && !current.criteria.includes(m[1])) {
          current.criteria.push(m[1]);
        }
      }
    }
  }
  return specs;
}

/** Every AC code cited anywhere in the test suites. */
async function citedInTests(): Promise<Set<string>> {
  const cited = new Set<string>();
  const patterns = ["**/*.test.ts", "apps/web/e2e/**/*.spec.ts"];
  for (const pattern of patterns) {
    for await (const rel of new Glob(pattern).scan({ cwd: ROOT })) {
      if (rel.includes("node_modules")) continue;
      for (const m of readFileSync(join(ROOT, rel), "utf8").matchAll(AC_CODE)) cited.add(m[1]);
    }
  }
  return cited;
}

const specs = parseSpecs();
const cited = await citedInTests();

const allCriteria = specs.flatMap((s) => s.criteria);
const covered = allCriteria.filter((c) => cited.has(c));
const uncovered = allCriteria.filter((c) => !cited.has(c));

// Status drift: a DONE spec with an uncovered criterion, or a TODO/HOLD spec that
// unexpectedly has a covering test.
const drift: string[] = [];
for (const s of specs) {
  const miss = s.criteria.filter((c) => !cited.has(c));
  if (s.status === "DONE" && miss.length > 0) {
    drift.push(`${s.code} is [DONE] but ${miss.length} criteria have no test: ${miss.join(", ")}`);
  }
  if ((s.status === "TODO" || s.status === "HOLD") && s.criteria.some((c) => cited.has(c))) {
    drift.push(`${s.code} is [${s.status}] but has covering tests; update its status.`);
  }
}

const byArea = new Map<string, Spec[]>();
for (const s of specs) byArea.set(s.area, [...(byArea.get(s.area) ?? []), s]);

console.log("Spec coverage\n=============\n");
for (const [area, list] of [...byArea].sort()) {
  console.log(`# ${area}`);
  for (const s of list) {
    const cov = s.criteria.filter((c) => cited.has(c)).length;
    console.log(
      `  [${s.status}] ${s.code}  ${cov}/${s.criteria.length} criteria covered`.padEnd(2),
    );
  }
  console.log("");
}

console.log(
  `Totals: ${specs.length} specs, ${covered.length}/${allCriteria.length} criteria covered.`,
);

if (uncovered.length > 0) {
  console.log(`\nUncovered criteria (${uncovered.length}):`);
  for (const c of uncovered) console.log(`  - ${c}`);
}

if (drift.length > 0) {
  console.log(`\nStatus drift (${drift.length}):`);
  for (const d of drift) console.log(`  ! ${d}`);
}

if (STRICT && drift.length > 0) {
  console.error("\nspec:coverage --strict failed: resolve the status drift above.");
  process.exit(1);
}
