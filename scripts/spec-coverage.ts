#!/usr/bin/env bun
/**
 * Spec coverage report. Cross-links the acceptance-criterion codes in the per-spec files
 * (docs/specs/<group>/*.md) with the tests that cite them, so "what is built and still
 * passing" is generated, never hand-maintained.
 *
 * A test covers a criterion by putting its code (e.g. SCOPE-003-AC2) in the test title.
 * This prints a per-group matrix plus two gap lists (uncovered criteria, status drift).
 * With --strict it exits non-zero on drift, so CI can gate on it.
 */
import { citedInTests, loadSpecs, STATUS_LABEL } from "./spec-lib";

const STRICT = process.argv.includes("--strict");

const specs = loadSpecs();
const cited = await citedInTests();

const allCriteria = specs.flatMap((s) => s.criteria);
const covered = allCriteria.filter((c) => cited.has(c));
const uncovered = allCriteria.filter((c) => !cited.has(c));

const drift: string[] = [];
for (const s of specs) {
  const miss = s.criteria.filter((c) => !cited.has(c));
  if (s.status === "done" && miss.length > 0) {
    drift.push(`${s.id} is [DONE] but ${miss.length} criteria have no test: ${miss.join(", ")}`);
  }
  if ((s.status === "todo" || s.status === "hold") && s.criteria.some((c) => cited.has(c))) {
    drift.push(`${s.id} is ${STATUS_LABEL[s.status]} but has covering tests; update its status.`);
  }
}

const byGroup = new Map<string, typeof specs>();
for (const s of specs) byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), s]);

console.log("Spec coverage\n=============\n");
for (const [group, list] of [...byGroup].sort()) {
  console.log(`# ${group}`);
  for (const s of list) {
    const cov = s.criteria.filter((c) => cited.has(c)).length;
    console.log(`  ${STATUS_LABEL[s.status]} ${s.id}  ${cov}/${s.criteria.length} covered`);
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
