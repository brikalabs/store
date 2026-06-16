#!/usr/bin/env bun
/**
 * `@unenforced` tracker.
 *
 * Some limits, rules, and contract fields are declared before they are wired up.
 * Rather than let them masquerade as guarantees, the spot is tagged with an
 * `@unenforced` comment (free text after a colon explains what is still missing).
 * This script lists every such marker so the gap between "declared" and
 * "enforced" stays visible. It is informational: it prints a report and always
 * exits 0, so it never fails a build.
 *
 * Two marker forms are recognised (see docs/CONVENTIONS.md):
 *   - the typed helper `unenforced(value, "reason")` from @brika/registry-core;
 *   - the `// [at]unenforced: reason` comment, for gaps with no value to wrap.
 *
 * Usage: `bun run unenforced`
 */
import { $ } from "bun";

// Match the comment tag and the typed-helper call. Exclude this scanner and the
// helper's own definition file so neither shows up as a self-match.
const PATHSPECS = [
  "*.ts",
  "*.tsx",
  ":(exclude)scripts/list-unenforced.ts",
  ":(exclude)packages/registry-core/src/unenforced.ts",
] as const;

const result = await $`git grep -n --untracked -e ${"@unenforced"} -e ${"unenforced("} -- ${PATHSPECS}`
  .nothrow()
  .quiet();
const lines = result.stdout.toString().trim().split("\n").filter(Boolean);

if (lines.length === 0) {
  console.log("list-unenforced: no @unenforced markers found.");
  process.exit(0);
}

console.log(`Found ${lines.length} unenforced marker(s):\n`);
for (const line of lines) {
  // `git grep -n` prints `path:lineno:content`.
  const [path, lineno, ...rest] = line.split(":");
  console.log(`  ${path}:${lineno}`);
  console.log(`    ${rest.join(":").trim()}`);
}
process.exit(0);
